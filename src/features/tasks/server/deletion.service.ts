import "server-only";

import { Types } from "mongoose";

import { ActivityModel } from "@/features/activity/server/activity.model";
import { deleteAttachmentsForTasks } from "@/features/tasks/server/attachment.service";
import {
  BoardModel,
  CommentModel,
  LabelModel,
  ListModel,
  TaskModel,
} from "@/features/tasks/server/models";
import { connectToDatabase } from "@/lib/db/connect";

/** Permanently removes boards and every record or stored file beneath them. */
export async function deleteBoardsCascade(
  boardIds: readonly Types.ObjectId[],
): Promise<void> {
  if (boardIds.length === 0) {
    return;
  }

  await connectToDatabase();

  const tasks = await TaskModel.find({ board: { $in: boardIds } })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();
  const taskIds = tasks.map((task) => task._id);

  await deleteAttachmentsForTasks(taskIds);

  await Promise.all([
    CommentModel.deleteMany({ task: { $in: taskIds } }),
    TaskModel.deleteMany({ board: { $in: boardIds } }),
    ListModel.deleteMany({ board: { $in: boardIds } }),
    LabelModel.deleteMany({ board: { $in: boardIds } }),
    ActivityModel.deleteMany({
      $or: [
        { board: { $in: boardIds } },
        { entityType: "board", entityId: { $in: boardIds } },
      ],
    }),
  ]);

  await BoardModel.deleteMany({ _id: { $in: boardIds } });
}

/** Finds and deletes every board belonging to one workspace. */
export async function deleteWorkspaceBoards(
  workspaceId: string,
): Promise<void> {
  await connectToDatabase();

  const boards = await BoardModel.find({ workspace: workspaceId })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  await deleteBoardsCascade(boards.map((board) => board._id));
}
