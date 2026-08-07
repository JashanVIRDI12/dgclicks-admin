"use server";

import { revalidatePath } from "next/cache";

import {
  acceptInviteSchema,
  createInviteSchema,
  revokeInviteSchema,
} from "@/features/tasks/schemas/invite.schema";
import {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  revokeWorkspaceInvite,
} from "@/features/tasks/server/invite.service";
import type { WorkspaceInvite } from "@/features/tasks/types";
import { createAction } from "@/lib/actions/create-action";

/**
 * Only administrators hand out access.
 *
 * `auth: ["admin"]` is the coarse check; `createWorkspaceInvite` still proves
 * membership of the specific workspace, because an admin of this app is not
 * automatically a member of every workspace in it.
 */
export const createInviteAction = createAction({
  auth: ["admin"],
  input: createInviteSchema,
  handler: async ({ input, session }): Promise<WorkspaceInvite> => {
    const invite = await createWorkspaceInvite(
      input.workspaceId,
      session.user.id,
      input.expiresIn === "never" ? null : Number(input.expiresIn),
    );

    revalidatePath("/settings");

    return invite;
  },
});

export const revokeInviteAction = createAction({
  auth: ["admin"],
  input: revokeInviteSchema,
  handler: async ({ input, session }) => {
    await revokeWorkspaceInvite(input.id, session.user.id);
    revalidatePath("/settings");
  },
});

/**
 * Redeeming a link is open to any signed-in account, which is the whole point:
 * the token is the credential, and the person holding it is not yet a member of
 * anything.
 */
export const acceptInviteAction = createAction({
  auth: true,
  input: acceptInviteSchema,
  handler: async ({ input, session }): Promise<{ workspaceName: string }> => {
    const { workspaceName } = await acceptWorkspaceInvite(
      input.token,
      session.user.id,
    );

    // A new membership changes the switcher, the sidebar and every index page.
    revalidatePath("/dashboard");
    revalidatePath("/boards");
    revalidatePath("/settings");

    return { workspaceName };
  },
});
