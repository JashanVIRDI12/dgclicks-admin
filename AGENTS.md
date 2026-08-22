<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# DG Clicks — Company OS

Internal task manager. Read `README.md` for the architecture; this file covers
the rules that are easy to get wrong.

## Working style

Build one module at a time and wait for approval before starting the next.
Never rewrite unrelated files. Prefer improving the foundation over adding to
it. No placeholder code, no TODOs, no dead code — including abstractions with
no caller.

## Version-specific traps

- `middleware.ts` is gone; use `src/proxy.ts` with a default export named
  `proxy`. Renaming only the file leaves it silently inert.
- `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` are all
  async. `await` them. `cookies()` can only be **written** from a server action
  or route handler, never during a server render — which is why the active
  workspace is switched by an action rather than inferred from the page.
- `next lint` was removed. Use `npm run lint` (`eslint .`).
- Tailwind v4 is CSS-first: tokens live in `src/app/globals.css`, and there is
  no `tailwind.config.ts`.
- `typedRoutes` is on. `href` and `router.push` take a generated `Route` union,
  not `string`. Runtime-derived paths are narrowed once, in
  `features/auth/callback-url.ts`.
- Global `PageProps<"/route">` / `LayoutProps<"/route">` types are generated.
  Run `npx next typegen` after adding a route if types look stale.
- shadcn's `form` component is a deprecated stub in v4. Use `field`
  (`Field`, `FieldLabel`, `FieldError`, `FieldGroup`, `FieldSeparator`) with
  React Hook Form's `register`.
- This `CommandDialog` does **not** wrap its children in `<Command>` the way
  upstream shadcn does. Render `<Command>` yourself, or cmdk's input and list
  have no context to attach to.
- Mongoose 9 renamed `FilterQuery` to `QueryFilter` and types filter values
  against the schema, so a `RegExp` where a string or enum is declared is a type
  error even though the driver accepts it. Build such queries as a plain record.
- `.lean<T>()` takes the non-null type: `.lean<TaskDoc>()`, never
  `.lean<TaskDoc | null>()`. The null comes from the query, not the generic.
- A shared helper generic over two different `Model<T>`s collapses into an
  uncallable union. `resolveDropPosition` in `features/tasks/position.ts` takes
  callbacks instead, which also keeps that module free of Mongoose.
- `populate()` rejects a `readonly` array, so the shared configs in
  `features/tasks/server/populate.ts` are typed `PopulateOptions[]` — adding
  `as const` there is a compile error at every call site.
- The MongoDB driver dropped `contentType` from `openUploadStream` options; it
  lives in `metadata` now.
- The React Compiler lint rules are errors, not suggestions. Three recur:
  `setState` inside an effect (derive it, or sync during render with a tracked
  previous value — see `board-workspace.tsx`), RHF's `watch()` making the
  compiler skip a whole component (use `Controller`, as `board-form-dialog.tsx`
  does), and calling an impure function such as `Date.now()` during render.
- TanStack Query's `initialData` seeds a key **once**. A server component that
  re-renders with a fresher snapshot is ignored, which silently makes
  `router.refresh()` a no-op for anything that query owns — `useBoard` adopts
  the new snapshot in an effect keyed on its identity for exactly this reason.
- Server actions ship a refreshed RSC payload back automatically; **route
  handlers do not**. A mutation reached through `fetch` — the assistant is the
  one that exists — has to invalidate the query cache and call
  `router.refresh()` itself, or the writes land and nothing on screen moves.

## Non-negotiables

- **Validate on the server.** Client validation is UX. Every mutation goes
  through `createAction`, every route handler through `withRoute`; both parse
  input with Zod before the handler runs.
- **Re-check auth in every action.** A guarded layout protects the page it
  renders, not the actions that page calls. `src/proxy.ts` is optimistic and
  proves nothing.
- **Check the resource, not just the session.** `createAction` proves who is
  calling; `assertBoardAccess` / `assertTaskAccess` prove they may touch that
  record. Every board, task, comment and attachment operation needs both.
- **Managing a workspace is not `auth: ["admin"]`.** Renaming a workspace,
  changing its people, handing out invite links, creating boards, setting a
  board's permissions and deleting the workspace all go through
  `assertWorkspaceManager`, which folds in the creator and global admins on top
  of the stored `managers`. A global role check in place of it locks the owner
  out of the workspace they made — which is exactly the bug this replaced;
  `assertWorkspaceMember` in place of it lets any member re-permission the
  workspace. What still stays `auth: ["admin"]` is per-board and per-record:
  archiving, deleting or reordering a board, deleting a task, and removing
  someone else's comment or attachment.
- **Never list boards without a viewer.** `listBoards(workspaceId, viewerId)`
  applies the `private` visibility filter inside the query, and the sidebar,
  dashboard, my tasks, calendar, reports, activity and search all derive their
  board ids from it. The viewer is positional so this cannot be forgotten;
  querying `BoardModel` directly to list boards bypasses it and leaks a private
  board into every one of those screens at once.
- **Never widen `role` input.** It is `input: false` in the auth config so a
  sign-up payload cannot assign it.
- **Never import `lib/env.ts`, `lib/auth/auth.ts` or `lib/db/*` from a client
  component.** They are `server-only` and will fail the build — correctly.
  `features/tasks/position.ts` and `features/tasks/recurrence.ts` are
  deliberately *not* server-only: the board computes the same midpoints and
  dates locally for its optimistic drops and its repeat preview, and a second
  implementation would eventually disagree with the server's.
- **One connection.** Do not call `mongoose.connect()`. Use
  `connectToDatabase()` and register models on the exported `db` connection.
  GridFS opens its bucket on the same `Db`; `/api/health` asserts this holds.

## Claims and races

Recurrence generates work on a **read** path, so two people opening the same
board at the same moment both try to spawn. The rule is claimed with one atomic
`findOneAndUpdate` on a **top-level** field that clears `recurrence` and returns
the before-image — the only copy of the rule ever handed out.

This is not theoretical. An earlier version compared a token nested inside the
subdocument:

```ts
// WRONG — six concurrent board loads produced three duplicate tasks
findOneAndUpdate(
  { _id, "recurrence.lastSpawnedAt": null, "recurrence.nextOccurrenceAt": due },
  { $set: { "recurrence.lastSpawnedAt": new Date() } },
)
```

The nested paths did not constrain the update the way a top-level path does, and
every caller matched. **Put claim conditions on top-level fields.** If you add
another read-triggered write, race it with a dozen concurrent requests before
believing it works.

## Conventions

- Server components by default; `"use client"` only where interactivity or a
  browser API requires it. Push the boundary down (see
  `components/layout/app-shell-content.tsx`).
- Feature code lives in `src/features/<module>/`. Route files stay thin.
- Zustand holds UI state only. Server data belongs to TanStack Query.
- File names are kebab-case; components PascalCase; one concept per file.
- Imports: external, then `@/` aliases, then relative.
- Colour-carrying chips set one `--chip-color` variable and let `.chip-tinted`
  in `globals.css` derive the fill, text and hairline with `color-mix`. Nine
  label colours cost nine tokens, not twenty-seven, and none of them need a
  dark-mode counterpart at the component level.
- Drag-and-drop sends neighbour ids, never an index. Positions are fractional
  and an index is stale the moment anyone else reorders the same column.

## Motion

**The closed list below was deliberately reopened** when the product moved to a
premium, motion-led direction. Orchestrated motion — view transitions, spring
physics, staggered reveals, completion flourishes — is now in scope.

Two rules survive that change and are not negotiable:

- `prefers-reduced-motion` is honoured globally in `globals.css`. Nothing may
  defeat it with inline styles, and the interface must be fully usable with
  every animation disabled.
- Motion is never the only carrier of meaning. If an animation communicates
  something — saved, completed, failed — a static affordance says it too.

The reader can also switch off the decorative layer independently, via
`data-effects="off"`. That hides ornament only; it must never disable a
transition that tells someone what just happened.

The original list, still the baseline for anything that does not need more:

- `components/common/fade-in.tsx` for page and view entrances.
- dnd-kit's own transforms and `DragOverlay` for anything being dragged.
- Tailwind transitions on `shadow-*`, `opacity`, `colors` and `transform` for
  hover and press states.

`prefers-reduced-motion` is honoured globally in `globals.css`. Do not defeat it
with inline styles.
