# DG Clicks — Company OS

Internal task manager. Boards, columns, cards and repeats, for a team that
manages work rather than customers.

Built so far: the foundation, authentication, the Tasks module, and an AI
workspace assistant —
workspaces, boards, four views, a task drawer with checklists, subtasks,
comments, attachments and time tracking, recurring tasks, reports, and a
command palette.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Radix) · MongoDB + Mongoose · Better Auth · TanStack Query ·
dnd-kit · React Hook Form + Zod · Zustand · Motion · date-fns · Sonner

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI
npm run dev
```

The app refuses to boot with invalid configuration rather than failing later at
request time, so a missing variable shows up immediately with the name of what
is missing.

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas connection string. |
| `MONGODB_DB_NAME` | no | Falls back to the database in the URI. |
| `BETTER_AUTH_SECRET` | yes | 32+ chars. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | yes | Absolute origin, e.g. `http://localhost:3000` |
| `RESEND_API_KEY` | for password reset | Resend API key; set with `RESEND_FROM_EMAIL`. |
| `RESEND_FROM_EMAIL` | for password reset | Sender on a verified domain, including an optional display name. |
| `OPENROUTER_API_KEY` | for AI assistant | Server-only OpenRouter key. Set with `OPENROUTER_MODEL`. |
| `OPENROUTER_MODEL` | for AI assistant | A model id that supports tool calling. |
| `ALLOWED_EMAIL_DOMAINS` | no | Comma-separated. **Empty means any email can register.** |

Empty optional values are treated as unset rather than failing validation.
Attachments need no configuration — they are stored on the same cluster.

### Access control

Sign-in is email and password only. Social providers were deliberately left out
for now; the catch-all route handler at `/api/auth/[...all]` already serves the
callback path, so adding one later is a config change rather than a rewrite.

Password reset uses Better Auth&apos;s one-hour, single-use tokens and Resend for
delivery. Configure both Resend variables to enable the public forgot-password
form. Successful resets revoke existing sessions; signed-in users can change
their password from `/settings/security`, which also revokes other sessions.

`ALLOWED_EMAIL_DOMAINS` is enforced when a user record is created, so it applies
to every route that can create an account — including any provider added later,
and including anyone arriving on an invite link. Left empty, **anyone who
reaches the sign-up page can register**; set it to your company domain before
exposing this app. It is read once at boot, so restart the dev server after
changing it. Existing accounts are unaffected — the check runs at sign-up only,
so an admin on a personal address keeps working after the domain is set.

People join a workspace through an invite link rather than being created by an
admin; see [Invites](#invites).

## Deploying to Vercel

Set every variable in the table above under **both** the Production and Preview
environments, and leave them enabled for the Build step as well as Runtime —
`lib/env.ts` parses at module load, so a missing variable fails `next build`,
not just the first request.

Two of them behave differently once there is a real URL:

- `BETTER_AUTH_URL` must be the production origin, not a preview one. Invite
  links and password-reset emails are built from it and are opened on other
  people's machines. Preview deployments still sign in: the app adds its own
  `VERCEL_URL`, `VERCEL_BRANCH_URL` and `VERCEL_PROJECT_PRODUCTION_URL` hosts to
  Better Auth's trusted origins, which is why it does not need a wildcard on
  `*.vercel.app` — anyone can deploy under that domain.
- `ALLOWED_EMAIL_DOMAINS` must be set **before** the deployment URL is shared.
  Empty, anyone who finds the URL can register, create their own workspace and
  spend your OpenRouter credits. It is also what closes the window on the
  administrator rule below.

Then, in order:

1. Deploy with `ALLOWED_EMAIL_DOMAINS` already set.
2. Register your own account immediately. **The first account ever created
   becomes the administrator** — there is no other path to one, since `role` is
   `input: false`. The domain allowlist is what stops a stranger taking it.
3. Check `/api/health`. It reports `sharedClient: true` when Mongoose and the
   driver are on one connection pool, which is what keeps a serverless instance
   inside the Atlas connection limit.

Atlas must allow connections from Vercel's egress IPs — either `0.0.0.0/0` in
the Network Access list, or a dedicated egress IP if you are on a plan that
offers one.

### Limits worth knowing

- **Attachments are capped at 4 MB** by `LIMITS.attachmentBytes`, because Vercel
  rejects a request body over 4.5 MB at the edge before the route handler runs.
  Raising the cap means moving uploads off the request body entirely — a signed
  direct-to-storage URL — not just changing the number.
- **The assistant holds a 50s budget** under the route's `maxDuration = 60`, the
  Hobby ceiling. It stops itself and saves the thread rather than being cut off
  mid-loop with its tool calls already committed. On a paid plan, raise
  `maxDuration` in `app/api/assistant/route.ts` and `RUN_BUDGET_MS` in
  `assistant-runner.ts` together — the second must stay comfortably below the
  first.
- **Recurrence has no scheduler.** Occurrences are generated when someone opens
  a board, the dashboard or the calendar. Nothing runs at midnight.

### Response headers

`next.config.ts` sets `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and — in production only — HSTS.

There is deliberately **no `Content-Security-Policy` yet**. A correct one for an
app this size needs per-request nonces threaded through the RSC payload; a
careless one fails open while breaking the board. It is the next hardening step,
not a solved problem. Attachment downloads do not depend on it: that route
allowlists which content types may render inline and forces everything else to
download — see [Attachments](#attachments).

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (type-checks as part of the build) |
| `npm run typecheck` | Types only |
| `npm run lint` | ESLint (`next lint` was removed in Next 16) |
| `npm run db:drop-crm` | One-off teardown of the removed CRM's collections |

## Architecture

```
src/
├── app/            Routes only — thin, delegating to features/
│   ├── (auth)/     Signed-out screens
│   ├── (app)/      Authenticated screens, guarded by its layout
│   └── api/        Route handlers
├── features/       One folder per module: components, schemas, actions, server/
├── components/
│   ├── ui/         shadcn primitives — generated, edit deliberately
│   ├── layout/     App shell
│   └── common/     Cross-feature presentational pieces
├── lib/            Infrastructure: auth, db, api, actions, errors, env
├── providers/      Client providers, composed in one place
├── config/         Site identity and the navigation registry
├── stores/         Zustand — UI state only, never server data
├── hooks/          Shared React hooks
├── types/          ActionResult, ApiResult, Paginated
└── proxy.ts        Optimistic redirects (replaces middleware.ts)
```

Business logic lives in `features/*/server/` and `features/*/actions/`. Route
files stay thin. UI components receive data, they do not fetch it — except the
board and the task drawer, which are TanStack Query resources so that a drag can
be optimistic.

### One MongoClient, three consumers

Better Auth's adapter needs a `Db` synchronously at module load; Mongoose
connects asynchronously; GridFS needs a bucket on the same connection. Rather
than run separate pools against one cluster, `lib/db/client.ts` owns a single
lazily-connecting `MongoClient`, `lib/db/connect.ts` adopts it into Mongoose via
`Connection.setClient()`, and the attachment service opens its `GridFSBucket` on
the same `Db`.

The database name is folded into the connection string rather than passed to
`client.db(name)`, because `setClient()` reads the name from the URI — applying
it on only one side would silently split auth collections and application data
across two databases.

`GET /api/health` asserts this holds: it pings through both paths and reports
whether they share a client.

### Authorisation happens four times

1. `src/proxy.ts` — **optimistic** cookie-presence check. No database access, and
   a forged cookie gets past it. It exists so signed-out users land on sign-in
   instead of a flash of empty chrome.
2. `app/(app)/layout.tsx` — validates the session server-side.
3. Every server action and route handler — `requireSessionOrThrow()`.
4. Every board and task operation — `assertBoardAccess` / `assertTaskAccess`,
   which walk up to the workspace, check membership, and then check whether the
   board is visible to this caller at all.

Step 3 proves *who* is calling. Step 4 proves they may touch *this record* and,
for mutations, whether they are an editor rather than a view-only member —
without it, any signed-in user could pass another board id directly to an
action.

`assertTaskAccess` delegates to `assertBoardAccess`, so a board's visibility
rule covers its tasks, comments, checklists, time entries and attachments
without any of them repeating it.

### Validation

Every schema in `features/*/schemas/` is used twice: React Hook Form uses it for
immediate feedback, and the server action re-parses the payload against the same
rules. The client copy is a convenience; the server copy is the one that
decides. `createAction` and `withRoute` both run `parseInput` before the handler
sees anything.

Actions resolve to an `ActionResult` rather than throwing — a throw crossing the
server-action boundary reaches the browser as an opaque digest, which is useless
to a form. `applyActionErrors` maps the returned `fieldErrors` onto the exact
inputs that were wrong.

### Roles

Users carry a single `role` (`admin` | `member`), declared with `input: false`
so it cannot be set from a sign-up payload. **The first account created becomes
the admin** — without that there is no route to one, since nothing can promote a
user from outside. Everyone after is a member.

The global role is the outermost ring. Inside it sit two narrower grants that do
not need it: **workspace managers** run one workspace (below), and **board
editors** manage one board's details, columns, labels and task work. Board
ordering, archiving, deletion, board permission settings, permanent task
deletion and removing another person's comment or attachment remain admin-only.

Role checks live in the actions (`auth: ["admin"]`), not just the UI. Hiding a
button is a courtesy; the action is the boundary. Where a right is per-resource
rather than global, the action pairs `auth: true` with a resource check —
`assertWorkspaceManager`, `assertBoardEditAccess` — because the session proves
who is calling and only the record proves what they may touch.

There is deliberately no screen for changing a role. Promote someone by editing
the `user` collection directly:

```js
db.user.updateOne({ email: "them@example.com" }, { $set: { role: "admin" } })
```

Sessions cache the role in a signed cookie for five minutes, so a change takes
up to that long to take effect. Signing out and back in is immediate.

### Workspace access

Membership lets you work *inside* a workspace. Changing the workspace itself is
a separate, smaller grant: its **managers**, set from **Settings → Permissions**.

| | Member | Manager | Admin |
| --- | --- | --- | --- |
| See and work on the boards they can reach | ✓ | ✓ | ✓ |
| Rename the workspace | | ✓ | ✓ |
| Remove members | | ✓ | ✓ |
| Appoint other managers | | ✓ | ✓ |
| Create and revoke invite links | | ✓ | ✓ |
| Create boards | | ✓ | ✓ |
| Delete the workspace | | | ✓ |

Three people are managers whatever the stored list says: anyone listed on the
workspace, **the creator** — so a workspace can never be left with nobody able
to run it, and so the field can default to empty on workspaces that predate it
without a backfill — and **any global admin**, so a workspace cannot lock them
out. That rule is `canManageWorkspace` on the client and `assertWorkspaceManager`
on the server; the client copy exists only to decide what to render.

Deleting is the one thing a manager does not get. It destroys every board, task,
comment and file in the workspace and there is nothing to undo it with.

Two smaller rules follow from the same place. A manager must already be a
member — administering a workspace you cannot open is a setting with no effect —
and removing someone from the workspace drops their management with them, so a
manager id left behind cannot silently hand the role back the day they are
re-added. Live invite links are shown only to managers, because the link
contains the token and the token is the credential.

**The members list shows the workspace's own members and nobody else.** It
briefly listed every account in the app with tick boxes, which turned the screen
that answers "who is in this workspace" into a company directory that happened to
be sorted by name. Joining is by invite link only, so the list is a record rather
than a picker: a manager can remove someone from it, and that is all.

### Board access

Workspace membership is the floor. Each board then sets one of three modes,
edited from the board toolbar → **Permissions** (admins only):

| Mode | Can see it | Can edit it |
| --- | --- | --- |
| `workspace` | workspace members | workspace members |
| `restricted` | workspace members | admins + editors |
| `private` | admins + editors | admins + editors |

`workspace` is the default for new boards. Administrators keep both rights under
every mode — a board that could lock its administrators out would need a
database edit to recover.

**`private` hides rather than disables.** The filter runs inside the Mongo query
in `listBoards`, so a private board never reaches the process rendering the
boards index, the sidebar, dashboard counts, my tasks, the calendar, reports,
activity or command-palette search. Requesting its URL directly returns 404, not
403: telling someone they are forbidden confirms the board exists and names it.

Every one of those screens derives its board ids from `listBoards(workspaceId,
viewerId)`, which is why one filter covers them all. The viewer is a required
positional argument rather than an option, so an unscoped listing cannot be
written by accident.

## Tasks

```
Workspace → Boards → Lists (columns) → Tasks → Subtasks
```

### Workspaces

Explicit records with their own membership. Which one you are looking at is held
in a cookie rather than the URL: `cookies()` cannot be written during a server
render, and a `/w/[slug]/…` prefix would thread a segment through every `<Link>`,
every generated `PageProps<"/route">` and every `revalidatePath` in the app.
Boards are globally unique by id, so `/boards/[boardId]` resolves whichever
workspace is active; only the index pages read the cookie. Opening a board from
another workspace shows a banner offering to switch rather than switching
silently.

### Invites

Managers add people from **Settings → Invite people**: choose an expiry (1, 7 or
30 days, or never), create a link, and send it however you like. Active links
are listed with their expiry and use count, each with copy and revoke. Revoking
is immediate and permanent — issue a new link rather than restoring one.

The link is the credential, so it is a 32-byte `base64url` token, indexed unique
and never reused. What the recipient sees:

```
/invite/<token>
  ├── signed out  → proxy redirects to /sign-in?callbackUrl=/invite/<token>
  │                 sign in or create an account, and return here
  ├── valid       → "Join <workspace>" → member, redirected to /dashboard
  ├── already in  → nothing to accept
  └── bad token   → "This link doesn't work"
```

Invalid, expired and revoked tokens all produce the same message. Distinguishing
them would turn the page into an oracle for which tokens once existed.

`/invite/[token]` sits outside the `(app)` group on purpose: the reader may be a
member of no workspace yet, and rendering the sidebar and board list around the
page that grants that membership shows them an empty shell of an app they cannot
use. `src/proxy.ts` still guards it.

Redemption uses `$addToSet` rather than a read-modify-write. Two people opening
one link at the same moment would otherwise each write a members array built
from the state they read, and the second would erase the first. Validity is
re-checked inside the same call that redeems, so a link revoked between the page
load and the click does not still let someone in.

New members land with access to `workspace` boards only; add them to a `private`
board from that board's Permissions dialog.

A link and the domain allowlist are complementary gates: the link controls who
is invited, `ALLOWED_EMAIL_DOMAINS` controls who can hold an account at all. A
forwarded link is useless against a domain allowlist, and a leaked domain is
useless without a link. **With `ALLOWED_EMAIL_DOMAINS` empty, the link is the
only gate** — anyone it reaches can register with any address.

### Boards and columns

A new board is seeded with Backlog / To Do / In Progress / Review / Done. A board
with no columns cannot accept a task, so it would open as a dead end.

One column per board is marked `isTerminal` — dropping a card there completes it
and fires any repeat rule, and dragging it out reopens it. Completion and column
are two views of the same fact, so setting either sets the other.

Deleting a column refuses while it still holds cards. Silently moving them or
deleting them alongside both lose work to one misclick.

### Ordering

`position` is a float. A dropped card takes the midpoint between its new
neighbours, so a move writes one document rather than resequencing the column.
Repeatedly dropping into the same gap halves it; `needsRebalance` catches that
before precision runs out and the siblings are resequenced. The client computes
the same midpoint locally so an optimistic drop lands exactly where it was
released.

Drops send **neighbour ids, not an index** — an index would be stale the moment
anyone else reordered the same column.

### Views

Kanban, List, Calendar and Timeline all read one snapshot held in TanStack
Query. Switching writes `?view=` with `window.history.replaceState`, which Next
integrates with its router — so there is no server round trip and no refetch. A
drag in Kanban is already reflected in Calendar before it is opened.

### The drawer

Clicking a card opens a right-hand panel, never a new page: the board stays
visible, closing loses nothing, and the URL carries `?task=` so a card can be
linked to from the activity feed or the palette.

Every field autosaves on change or blur. A panel that closes when you click
outside it cannot have a Save button.

**Assigned by** records who handed the task to its assignee. It is written from
the same branch that writes `assignee`, so the two cannot disagree: picking
somebody rewrites it to whoever made that change, and unassigning clears it,
which means the row can never credit an assignment that has since been handed on.
It reads "Self-assigned" when the two are the same person. The field lives on
`TaskDetail` rather than `Task` and populates only in `TASK_DETAIL_POPULATE` — the
board loads every card through `TASK_POPULATE`, and each extra path there is
another round trip on the one read that has to stay fast. The activity feed
records the change too, but it is paged and prunable, so the current answer is
stored on the task.

Checklists and subtasks are both there because they are different things: a
checklist item is a string and a tick, embedded on the task; a subtask is a real
task with a parent, carrying its own assignee and due date. Board queries filter
`parent: null`, so a subtask never appears as a card.

Subtasks can be listed while creating the parent, not only afterwards from the
drawer. The new-task sheet collects titles only — there is no parent to hang a
real task off until the create succeeds — and they are written with the parent
in one `insertMany`, capped at `SUBTASK_CREATE_LIMIT`, sharing the parent's
column. Adding more later from the drawer is uncapped; the limit bounds one
request, not one task. Nesting stops there: a subtask cannot carry subtasks of
its own, because the drawer renders children as a flat list with no way in to a
third level.

Creating a task closes the sheet and leaves you on the board. It does not open
the new card's drawer — the sheet already asked for everything the drawer would
show, so following one panel with another is just a second thing to close.

`commentCount` and `attachmentCount` are denormalised and written only by the
services that create and delete those records — counting per card would be an
N+1 on the one query that has to stay fast.

### Recurring tasks

Daily, weekly, monthly, quarterly, yearly, or specific weekdays. The task *is*
the current occurrence and carries the rule; spawning moves the rule to the
clone, so exactly one task in a chain is ever live. The checklist comes across
unticked; comments, attachments and the time log stay with the occurrence they
were recorded against.

Two triggers, because there is no scheduler:

1. **On completion** — the common path, immediate.
2. **A catch-up sweep** on board, dashboard and calendar reads, for rules whose
   date passed without anyone completing them. It skips straight to the present:
   a weekly task left for six weeks owes one occurrence, not six.

Generation on a read path races by construction, so the claim is a single atomic
`findOneAndUpdate` that clears `recurrence` and returns the before-image — the
only copy of the rule that is ever handed out. See the trap in `AGENTS.md`: an
earlier version put the claim token *inside* the subdocument and 6 concurrent
board loads produced 3 duplicate tasks.

### Attachments

Stored in GridFS on the same cluster, served through
`GET /api/attachments/[id]`, which checks the session and workspace membership
before streaming a byte. That check is the reason they are not in an object
store: an unguessable bucket URL is not the same as a private one.

Capped at 4 MB each and 25 per task. The cap is the host's, not a design choice
— see [Limits worth knowing](#limits-worth-knowing).

The download route decides the disposition, never the upload. A stored content
type is whatever the uploader's browser put in the multipart part, so it is
attacker-controlled: only images and PDFs are served `inline`, and everything
else — `text/html`, and `image/svg+xml`, which carries `<script>` — is forced to
download. `X-Content-Type-Options: nosniff` stops the browser sniffing past that
decision. Serving an arbitrary uploaded type inline would put a page of the
uploader's choosing on this origin, running with the reader's session.

### Search

`Cmd/Ctrl+K` searches tasks and boards, jumps to any page, and creates a task or
a board. Destinations are read from `config/navigation.ts` rather than listed
again, so the palette cannot drift from the sidebar. Task titles are matched
with an escaped case-insensitive regex, scoped to the caller's own boards.

### Workspace assistant

The sparkle button in the top bar opens a persistent OpenRouter-backed
assistant. It can inspect and manage workspaces, boards, columns, labels,
tasks, checklists, comments, attachments and time logs through a closed tool
registry. It never receives direct database or filesystem access.

Every tool call acts as the signed-in user: the normal server action validation,
role checks and resource-level workspace/board/task checks still run. Permanent
deletions, membership changes and permission changes pause for an explicit
hold-to-confirm interaction. Conversation history and pending confirmations are
stored per user; provider keys and hidden model reasoning are not stored.

Configure both OpenRouter variables to show the assistant. Choose a model from
OpenRouter's tool-capable model list. If either variable is absent, the rest of
the application continues to run and the assistant trigger stays disabled.

## Activity

The audit feed at `/activity` records creates, edits, completions, archives and
deletions across workspaces, boards, columns, tasks, comments and attachments,
scoped to the active workspace. Entries carry the board they happened on as a
separate field from `context`, because the board is the only navigable anchor —
a comment's entry links to `/boards/{board}?task={task}` even though its context
is the task.

Drags are deliberately not audited: it is the most frequent action on a board
and one entry per drag would bury everything else.

## Adding a module

1. `src/features/<module>/schemas/` — Zod schemas, shared by form and server.
2. `src/features/<module>/server/` — models and data access.
   Register models on the shared connection and guard against hot-reload
   re-registration:
   ```ts
   export const BoardModel =
     db.models.Board ?? db.model<BoardDoc>("Board", boardSchema);
   ```
   Call `await connectToDatabase()` before the first query in a request.
3. `src/features/<module>/actions/` — mutations via `createAction`.
4. `src/app/(app)/<module>/` — routes, thin.
5. `src/config/navigation.ts` — add the entry. `href` is checked against routes
   that actually exist, so a link to an unbuilt page will not compile.

## Removed: the CRM

Clients, tags, notes and client service departments were removed when this
became a task manager. The code is gone; `npm run db:drop-crm` reports what data
is left behind and, with `--confirm`, drops the `client`, `tag`, `note` and
`department` collections along with any Activity entries written by those
modules. It is a separate opt-in script rather than a boot-time migration —
dropping collections is not reversible, and it should happen because someone
decided to run it.
