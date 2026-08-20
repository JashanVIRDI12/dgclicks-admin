"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  diffFields,
  recordActivity,
} from "@/features/activity/server/activity.service";
import type { UserSummary } from "@/features/auth/types";
import {
  addWorkspaceMembersSchema,
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdSchema,
  workspaceManagersSchema,
  workspaceMembersSchema,
} from "@/features/tasks/schemas/workspace.schema";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
} from "@/features/tasks/server/active-workspace";
import {
  addWorkspaceMembers,
  assertWorkspaceManager,
  assertWorkspaceMember,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  listAddableUsers,
  listWorkspacesForUser,
  setWorkspaceManagers,
  setWorkspaceMembers,
  updateWorkspace,
} from "@/features/tasks/server/workspace.service";
import type { Workspace } from "@/features/tasks/types";
import { createAction } from "@/lib/actions/create-action";
import { objectId } from "@/lib/validation";

/**
 * Everything the switcher, sidebar and index pages read is workspace-scoped, so
 * a workspace change invalidates all of them.
 */
/**
 * Everything under the app shell, layout included.
 *
 * `revalidatePath("/dashboard")` and friends invalidate only the *page* at that
 * segment. The sidebar — the workspace switcher and its list of boards — is
 * rendered by `app/(app)/layout.tsx`, so naming the pages one by one refreshed
 * the body of each screen while leaving the navigation showing the workspace
 * you just switched away from. It took a manual reload to catch up.
 *
 * The `"layout"` form invalidates the layout at that segment, every nested
 * layout beneath it, and every page under those. That is heavier than seven
 * targeted calls, and correct: which workspace is active changes what *every*
 * route in the app resolves to, not just what seven of them display.
 */
function revalidateWorkspaceScope(): void {
  revalidatePath("/", "layout");
}

export const createWorkspaceAction = createAction({
  auth: true,
  input: createWorkspaceSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    const workspace = await createWorkspace(input, session.user.id);

    await recordActivity({
      actorId: session.user.id,
      action: "created",
      entityType: "workspace",
      entityId: workspace.id,
      entityLabel: workspace.name,
    });

    // A workspace you just created is the one you want to be looking at.
    const cookieStore = await cookies();
    cookieStore.set(
      ACTIVE_WORKSPACE_COOKIE,
      workspace.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );

    revalidateWorkspaceScope();
    return workspace;
  },
});

export const updateWorkspaceAction = createAction({
  auth: true,
  input: updateWorkspaceSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    const { id, ...fields } = input;
    await assertWorkspaceManager(id, session.user.id);

    const before = await getWorkspaceById(id);
    const workspace = await updateWorkspace(id, fields);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace.id,
      entityLabel: workspace.name,
      changes: diffFields(before, workspace, ["name"]),
    });

    revalidateWorkspaceScope();
    return workspace;
  },
});

export const setWorkspaceMembersAction = createAction({
  auth: true,
  input: workspaceMembersSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    await assertWorkspaceManager(input.id, session.user.id);

    const workspace = await setWorkspaceMembers(
      input.id,
      input.memberIds,
      session.user.id,
    );

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace.id,
      entityLabel: workspace.name,
      changes: [
        {
          field: "members",
          from: null,
          to: `${workspace.members.length} member${workspace.members.length === 1 ? "" : "s"}`,
        },
      ],
    });

    revalidateWorkspaceScope();
    return workspace;
  },
});

/**
 * Who else may administer this workspace.
 *
 * A manager can appoint another manager — the alternative is a workspace whose
 * people can only be changed by someone outside it, which is the situation this
 * permission exists to end. Deleting stays out of their reach; see below.
 */
/**
 * Everyone with an account who is not already in this workspace.
 *
 * A read behind `createAction` rather than a route handler: it is only ever
 * called from the add-people picker, and going through the same wrapper means
 * the manager check and the Zod parse are the ones every other workspace
 * operation uses.
 */
export const listWorkspaceCandidatesAction = createAction({
  auth: true,
  input: workspaceIdSchema,
  handler: async ({ input, session }): Promise<UserSummary[]> => {
    await assertWorkspaceManager(input.id, session.user.id);

    return listAddableUsers(input.id);
  },
});

export const addWorkspaceMembersAction = createAction({
  auth: true,
  input: addWorkspaceMembersSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    await assertWorkspaceManager(input.id, session.user.id);

    const before = await getWorkspaceById(input.id);
    const workspace = await addWorkspaceMembers(input.id, input.memberIds);

    const existing = new Set(before.members.map((member) => member.id));
    const added = workspace.members.filter(
      (member) => !existing.has(member.id),
    );

    // Named rather than counted: "added 2 members" is the one entry nobody can
    // act on, and who joined a workspace is exactly what an audit trail is for.
    if (added.length > 0) {
      await recordActivity({
        actorId: session.user.id,
        action: "updated",
        entityType: "workspace",
        entityId: workspace.id,
        entityLabel: workspace.name,
        changes: [
          {
            field: "members",
            from: null,
            to: `added ${added.map((member) => member.name).join(", ")}`,
          },
        ],
      });
    }

    revalidateWorkspaceScope();
    return workspace;
  },
});

export const setWorkspaceManagersAction = createAction({
  auth: true,
  input: workspaceManagersSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    await assertWorkspaceManager(input.id, session.user.id);

    const before = await getWorkspaceById(input.id);
    const workspace = await setWorkspaceManagers(
      input.id,
      input.managerIds,
      session.user.id,
    );

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "workspace",
      entityId: workspace.id,
      entityLabel: workspace.name,
      changes: [
        {
          field: "managers",
          from: `${before.managerIds.length}`,
          to: `${workspace.managerIds.length}`,
        },
      ],
    });

    revalidateWorkspaceScope();
    return workspace;
  },
});

/**
 * Deleting a workspace destroys every board, task, comment and file in it, and
 * there is nothing to undo it with.
 *
 * It still belongs to the people who run the workspace rather than to the global
 * role: somebody who creates their own workspace has to be able to get rid of it
 * without going to an administrator. The guard against a misclick is the
 * confirmation, not the audience — `deleteWorkspace` re-checks the typed name
 * against the database, so reaching this action is not the same as being able to
 * fire it.
 */
export const deleteWorkspaceAction = createAction({
  auth: true,
  input: deleteWorkspaceSchema,
  handler: async ({ input, session }) => {
    await assertWorkspaceManager(input.id, session.user.id);
    await deleteWorkspace(input.id, input.confirmation);

    const [cookieStore, remainingWorkspaces] = await Promise.all([
      cookies(),
      listWorkspacesForUser(session.user.id),
    ]);

    if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === input.id) {
      const nextWorkspace = remainingWorkspaces[0];

      if (nextWorkspace) {
        cookieStore.set(
          ACTIVE_WORKSPACE_COOKIE,
          nextWorkspace.id,
          ACTIVE_WORKSPACE_COOKIE_OPTIONS,
        );
      } else {
        cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
      }
    }

    revalidateWorkspaceScope();
  },
});

/**
 * Switches which workspace the index pages show.
 *
 * A server action rather than a client-side cookie write because the pages that
 * read it render on the server — and because membership has to be re-checked
 * before the value is trusted, which only the server can do.
 */
export const setActiveWorkspaceAction = createAction({
  auth: true,
  input: z.object({ id: objectId }),
  handler: async ({ input, session }) => {
    await assertWorkspaceMember(input.id, session.user.id);

    const cookieStore = await cookies();
    cookieStore.set(
      ACTIVE_WORKSPACE_COOKIE,
      input.id,
      ACTIVE_WORKSPACE_COOKIE_OPTIONS,
    );

    revalidateWorkspaceScope();
  },
});
