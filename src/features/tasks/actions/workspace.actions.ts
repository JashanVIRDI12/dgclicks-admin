"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  diffFields,
  recordActivity,
} from "@/features/activity/server/activity.service";
import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceMembersSchema,
} from "@/features/tasks/schemas/workspace.schema";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE_OPTIONS,
} from "@/features/tasks/server/active-workspace";
import {
  assertWorkspaceMember,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceById,
  listWorkspacesForUser,
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
function revalidateWorkspaceScope(): void {
  revalidatePath("/dashboard");
  revalidatePath("/boards");
  revalidatePath("/my-tasks");
  revalidatePath("/calendar");
  revalidatePath("/reports");
  revalidatePath("/settings");
  revalidatePath("/activity");
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
  auth: ["admin"],
  input: updateWorkspaceSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    const { id, ...fields } = input;
    await assertWorkspaceMember(id, session.user.id);

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
  auth: ["admin"],
  input: workspaceMembersSchema,
  handler: async ({ input, session }): Promise<Workspace> => {
    await assertWorkspaceMember(input.id, session.user.id);

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

export const deleteWorkspaceAction = createAction({
  auth: ["admin"],
  input: deleteWorkspaceSchema,
  handler: async ({ input, session }) => {
    await assertWorkspaceMember(input.id, session.user.id);
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
