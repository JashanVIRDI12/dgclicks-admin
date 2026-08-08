import { z } from "zod";

import { LIMITS } from "@/features/tasks/constants";
import { objectId } from "@/lib/validation";

export const workspaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the workspace a name.")
    .max(
      LIMITS.workspaceName,
      `Name must be at most ${LIMITS.workspaceName} characters.`,
    ),
});

export const createWorkspaceSchema = workspaceFormSchema;

export const updateWorkspaceSchema = workspaceFormSchema.extend({
  id: objectId,
});

export const workspaceMembersSchema = z.object({
  id: objectId,
  memberIds: z.array(objectId).max(200, "At most 200 members."),
});

export const workspaceManagersSchema = z.object({
  id: objectId,
  managerIds: z.array(objectId).max(200, "At most 200 managers."),
});

export const deleteWorkspaceSchema = z.object({
  id: objectId,
  confirmation: z
    .string()
    .trim()
    .min(1, "Type the workspace name to confirm.")
    .max(LIMITS.workspaceName, "That workspace name is too long."),
});

export type WorkspaceFormValues = z.output<typeof workspaceFormSchema>;
