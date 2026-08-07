import "server-only";

import { Types } from "mongoose";

import {
  CommentModel,
  TaskModel,
  type CommentDoc,
} from "@/features/tasks/server/models";
import { COMMENT_POPULATE } from "@/features/tasks/server/populate";
import { toComment } from "@/features/tasks/server/serialize";
import type { Comment } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";

export async function listComments(taskId: string): Promise<Comment[]> {
  await connectToDatabase();

  const docs = await CommentModel.find({ task: taskId })
    .populate(COMMENT_POPULATE)
    .sort({ createdAt: 1 })
    .lean<CommentDoc[]>();

  return docs.map(toComment);
}

export async function getCommentById(id: string): Promise<Comment> {
  await connectToDatabase();

  const doc = await CommentModel.findById(id)
    .populate(COMMENT_POPULATE)
    .lean<CommentDoc>();

  if (!doc) {
    throw new NotFoundError("That comment no longer exists.");
  }

  return toComment(doc);
}

/**
 * Adds a comment and bumps the card's counter.
 *
 * `$inc` rather than a recount: the card badge is read on every board load and
 * counting the collection per card would be the N+1 the denormalised field
 * exists to avoid. The counter is only ever written here and in `deleteComment`.
 */
export async function createComment(
  input: { taskId: string; body: string },
  authorId: string,
): Promise<Comment> {
  await connectToDatabase();

  const created = await CommentModel.create({
    task: new Types.ObjectId(input.taskId),
    author: new Types.ObjectId(authorId),
    body: input.body,
  });

  await TaskModel.findByIdAndUpdate(input.taskId, {
    $inc: { commentCount: 1 },
  });

  return getCommentById(created._id.toString());
}

export async function deleteComment(id: string): Promise<Comment> {
  await connectToDatabase();

  const deleted = await CommentModel.findByIdAndDelete(id).lean<CommentDoc>();

  if (!deleted) {
    throw new NotFoundError("That comment no longer exists.");
  }

  // `min: 0` on the field would reject a negative, so guard the decrement
  // rather than letting a double-delete fail the update.
  await TaskModel.findOneAndUpdate(
    { _id: deleted.task, commentCount: { $gt: 0 } },
    { $inc: { commentCount: -1 } },
  );

  return toComment(deleted);
}
