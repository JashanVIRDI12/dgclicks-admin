import "server-only";

import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { db } from "@/lib/db/connect";
import { connectToDatabase } from "@/lib/db/connect";

/**
 * What the assistant is allowed to remember between conversations.
 *
 * A closed set on purpose. "Remember anything interesting" is how a memory
 * system fills with restatements of the last message — and every one of those
 * is then re-read into the prompt forever, costing tokens to make the model
 * slightly wronger. Each category below answers a question that is still true
 * next week.
 */
export const MEMORY_TYPES = [
  /** How this person likes to be worked with. Terse replies, no emoji, etc. */
  "user_preference",
  /** A convention the whole workspace follows. Naming, columns, cadence. */
  "workspace_preference",
  /** Durable background on a project the tasks themselves do not carry. */
  "project_context",
  /** Who does what, and who to ask about which area. */
  "team_relationship",
  /** A decision taken, so it is not silently relitigated later. */
  "important_decision",
  /** Something that happens repeatedly and is worth anticipating. */
  "recurring_pattern",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Read into every prompt, so this is a token budget as much as a row limit. */
export const MEMORY_RECALL_LIMIT = 12;

/**
 * Hard ceiling per person per workspace.
 *
 * Without one this collection grows forever on a 512 MB cluster, and the
 * prompt slowly fills with things that were true in March. Writing past the cap
 * evicts the least important, oldest-used row — so a memory that keeps proving
 * useful survives and one saved on a whim does not.
 */
const MEMORY_CAP = 60;

const assistantMemorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /**
     * Null means "true of this person everywhere".
     *
     * Scoping matters more than it looks: a decision made in one workspace must
     * not surface as fact in another, and preferences must follow the person.
     * The retrieval query below always filters on both.
     */
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    type: { type: String, enum: MEMORY_TYPES, required: true },
    content: { type: String, required: true, trim: true, maxlength: 400 },
    /** 0–1. Drives both recall order and what gets evicted first. */
    importance: { type: Number, required: true, min: 0, max: 1, default: 0.5 },
    lastUsedAt: { type: Date, default: null },
  },
  { collection: "assistant_memory", timestamps: true },
);

// The recall query: this person, this workspace (or global), best first.
assistantMemorySchema.index({ user: 1, workspace: 1, importance: -1 });

export type AssistantMemoryDoc = InferSchemaType<
  typeof assistantMemorySchema
> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export const AssistantMemoryModel: Model<AssistantMemoryDoc> =
  (db.models.AssistantMemory as Model<AssistantMemoryDoc>) ??
  db.model<AssistantMemoryDoc>("AssistantMemory", assistantMemorySchema);

export type Memory = {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
};

/**
 * What this person has told the assistant that is worth carrying forward.
 *
 * Returns global memories and this workspace's, never another workspace's.
 */
export async function recallMemories(
  userId: string,
  workspaceId: string | null,
): Promise<Memory[]> {
  await connectToDatabase();

  const docs = await AssistantMemoryModel.find({
    user: userId,
    workspace: workspaceId ? { $in: [workspaceId, null] } : null,
  })
    .sort({ importance: -1, updatedAt: -1 })
    .limit(MEMORY_RECALL_LIMIT)
    .lean<AssistantMemoryDoc[]>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    type: doc.type as MemoryType,
    content: doc.content,
    importance: doc.importance,
  }));
}

/**
 * Saves one thing, or updates it if the same thing is already known.
 *
 * Deduplicated on the exact text because models restate rather than repeat: ask
 * one to remember a preference twice and you get two rows saying the same thing
 * differently. Exact-match is a blunt guard and it is the honest one — anything
 * cleverer would need an embedding, which is a second model call to save a
 * sentence.
 */
export async function rememberMemory(input: {
  userId: string;
  workspaceId: string | null;
  type: MemoryType;
  content: string;
  importance: number;
}): Promise<Memory> {
  await connectToDatabase();

  const doc = await AssistantMemoryModel.findOneAndUpdate(
    {
      user: input.userId,
      workspace: input.workspaceId,
      content: input.content.trim(),
    },
    {
      $set: {
        type: input.type,
        importance: input.importance,
        lastUsedAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true },
  ).lean<AssistantMemoryDoc>();

  await evictOverflow(input.userId, input.workspaceId);

  return {
    id: doc._id.toString(),
    type: doc.type as MemoryType,
    content: doc.content,
    importance: doc.importance,
  };
}

export async function forgetMemory(
  userId: string,
  memoryId: string,
): Promise<boolean> {
  await connectToDatabase();

  // Scoped to the owner: a memory id is guessable, and forgetting somebody
  // else's is a small thing that should still be impossible.
  const result = await AssistantMemoryModel.deleteOne({
    _id: memoryId,
    user: userId,
  });

  return result.deletedCount === 1;
}

/** Trims the least useful rows once the cap is exceeded. */
async function evictOverflow(
  userId: string,
  workspaceId: string | null,
): Promise<void> {
  const scope = { user: userId, workspace: workspaceId };
  const count = await AssistantMemoryModel.countDocuments(scope);

  if (count <= MEMORY_CAP) {
    return;
  }

  const doomed = await AssistantMemoryModel.find(scope)
    .sort({ importance: 1, updatedAt: 1 })
    .limit(count - MEMORY_CAP)
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  await AssistantMemoryModel.deleteMany({
    _id: { $in: doomed.map((doc) => doc._id) },
  });
}
