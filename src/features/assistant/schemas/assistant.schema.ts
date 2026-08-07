import { z } from "zod";

import { objectId } from "@/lib/validation";

const assistantContextSchema = z.object({
  workspaceId: objectId.nullable(),
  boardId: objectId.nullable(),
  pathname: z.string().trim().min(1).max(500),
});

const messageRequestSchema = z.object({
  kind: z.literal("message"),
  threadId: objectId.nullable(),
  message: z.string().trim().min(1).max(4_000),
  context: assistantContextSchema,
});

const confirmationRequestSchema = z.object({
  kind: z.literal("confirmation"),
  threadId: objectId,
  confirmationId: z.string().min(1).max(100),
  approved: z.boolean(),
});

export const assistantRequestSchema = z.discriminatedUnion("kind", [
  messageRequestSchema,
  confirmationRequestSchema,
]);

export type AssistantRequest = z.output<typeof assistantRequestSchema>;
