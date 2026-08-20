"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";

import {
  diffFields,
  recordActivity,
} from "@/features/activity/server/activity.service";
import { getSessionRole } from "@/features/auth/server/session";
import {
  addChecklistItemSchema,
  attachmentIdSchema,
  commentIdSchema,
  createCommentSchema,
  createTaskSchema,
  logTimeSchema,
  moveTaskSchema,
  removeChecklistItemSchema,
  setTaskAssetReadySchema,
  setTaskCompleteSchema,
  setTaskRecurrenceSchema,
  taskIdSchema,
  timeEntryIdSchema,
  updateChecklistItemSchema,
  updateTaskSchema,
} from "@/features/tasks/schemas/task.schema";
import { describeRecurrence } from "@/features/tasks/recurrence";
import {
  setTaskRecurrence,
  spawnOnCompletion,
} from "@/features/tasks/server/recurrence.service";
import {
  deleteAttachment,
  getAttachmentById,
} from "@/features/tasks/server/attachment.service";
import { assertBoardEditAccess } from "@/features/tasks/server/board.service";
import {
  createComment,
  deleteComment,
  getCommentById,
} from "@/features/tasks/server/comment.service";
import {
  addChecklistItem,
  assertTaskEditAccess,
  assertTaskOwnerAccess,
  createTask,
  deleteTask,
  getTaskById,
  logTime,
  moveTask,
  removeChecklistItem,
  removeTimeEntry,
  setTaskArchived,
  setTaskAssetReady,
  setTaskComplete,
  startTimer,
  stopTimer,
  updateChecklistItem,
  updateTask,
} from "@/features/tasks/server/task.service";
import type { Comment, Task, TaskDetail } from "@/features/tasks/types";
import { createAction } from "@/lib/actions/create-action";
import { ForbiddenError } from "@/lib/errors";

function revalidateTaskScope(boardId: string): void {
  revalidatePath(`/boards/${boardId}` as Route);
  revalidatePath("/boards");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
  revalidatePath("/calendar");
  revalidatePath("/content");
  revalidatePath("/activity");
}

/** The audit shape: scalars only, because a diff of label ids reads as noise. */
function auditShape(task: Task) {
  return {
    title: task.title,
    priority: task.priority,
    mediaType: task.mediaType,
    assignee: task.assignee?.name ?? null,
    dueDate: task.dueDate,
    startDate: task.startDate,
    estimateMinutes: task.estimateMinutes,
  };
}

export const createTaskAction = createAction({
  auth: true,
  input: createTaskSchema,
  handler: async ({ input, session }): Promise<Task> => {
    await assertBoardEditAccess(input.boardId, session.user.id);

    // A subtask must hang off a task on the same board, or it would appear in a
    // drawer its board cannot reach.
    if (input.parentId) {
      const parent = await assertTaskEditAccess(input.parentId, session.user.id);

      if (parent.board.toString() !== input.boardId) {
        throw new ForbiddenError("That task is on a different board.");
      }
    }

    const task = await createTask(input, session.user.id);

    // Posted after the task exists, because a comment needs something to hang
    // off. Its own activity entry is deliberately not recorded — "created task"
    // and "commented on task" one second apart, by the same person, is noise.
    if (input.comment) {
      await createComment(
        { taskId: task.id, body: input.comment },
        session.user.id,
      );
    }

    await recordActivity({
      actorId: session.user.id,
      action: "created",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId: task.boardId,
    });

    revalidateTaskScope(task.boardId);
    return task;
  },
});

export const updateTaskAction = createAction({
  auth: true,
  input: updateTaskSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const { id, ...patch } = input;
    const existing = await assertTaskOwnerAccess(id, session.user.id);
    const boardId = existing.board.toString();

    const before = await getTaskById(id);
    const task = await updateTask(id, boardId, patch, session.user.id);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
      changes: diffFields(auditShape(before), auditShape(task), [
        "title",
        "priority",
        "mediaType",
        "assignee",
        "dueDate",
        "startDate",
        "estimateMinutes",
      ]),
    });

    revalidateTaskScope(boardId);
    return task;
  },
});

/**
 * A drop.
 *
 * Deliberately not audited on its own: dragging is the single most frequent
 * action on a board, and one activity entry per drag would bury everything else
 * in the feed. Completion changes that a move causes are recorded by the board
 * itself through `completedAt`.
 *
 * It is also the only mutation here that usually revalidates nothing. Position
 * is the one field no other screen in the app displays, and the board that does
 * display it owns the change optimistically and refetches its own snapshot — so
 * a plain reorder has nothing to tell the server-rendered pages. Revalidating
 * on every drag made each one re-render this page on the server *and* expire the
 * client cache for every page already visited, which is why dragging felt like
 * it cost a page load. Landing in or out of Done is different: that changes what
 * the dashboard, my tasks, the calendar and the board index all count.
 */
export const moveTaskAction = createAction({
  auth: true,
  input: moveTaskSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskEditAccess(input.id, session.user.id);
    const boardId = existing.board.toString();

    const task = await moveTask(input.id, boardId, input);
    const completionChanged =
      Boolean(task.completedAt) !== Boolean(existing.completedAt);

    // Dragging into Done completes the task, so it has to fire recurrence for
    // the same reason ticking the checkbox does — the two are one action with
    // two gestures.
    if (task.completedAt && !existing.completedAt) {
      await spawnOnCompletion(input.id);
    }

    if (completionChanged) {
      revalidateTaskScope(boardId);
    }

    return task;
  },
});

export const setTaskRecurrenceAction = createAction({
  auth: true,
  input: setTaskRecurrenceSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskOwnerAccess(input.id, session.user.id);
    const boardId = existing.board.toString();

    const task = await setTaskRecurrence(input.id, input.recurrence);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
      changes: [
        {
          field: "recurrence",
          from: existing.recurrence ? "on" : null,
          to: task.recurrence ? describeRecurrence(task.recurrence) : null,
        },
      ],
    });

    revalidateTaskScope(boardId);
    return task;
  },
});

export const setTaskCompleteAction = createAction({
  auth: true,
  input: setTaskCompleteSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskEditAccess(input.id, session.user.id);
    const boardId = existing.board.toString();

    const task = await setTaskComplete(input.id, boardId, input.isComplete);

    // Finishing this month's report is what creates next month's.
    if (input.isComplete) {
      await spawnOnCompletion(input.id);
    }

    await recordActivity({
      actorId: session.user.id,
      action: input.isComplete ? "completed" : "reopened",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
    });

    revalidateTaskScope(boardId);
    return task;
  },
});

/**
 * The designer's hand-off.
 *
 * Board edit access, not `assertTaskOwnerAccess`: marking the artwork done is
 * the same kind of act as dragging a card into Done, and a designer who picked
 * up a colleague's post should not be locked out of saying so. Recorded as an
 * `updated` entry rather than a new verb, so the activity vocabulary stays the
 * small closed set the feed renders from.
 */
export const setTaskAssetReadyAction = createAction({
  auth: true,
  input: setTaskAssetReadySchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskEditAccess(input.id, session.user.id);
    const boardId = existing.board.toString();

    const task = await setTaskAssetReady(
      input.id,
      input.isReady,
      session.user.id,
    );

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
      changes: [
        {
          field: "artwork",
          from: null,
          to: input.isReady ? "made" : "back with the designer",
        },
      ],
    });

    revalidateTaskScope(boardId);
    return task;
  },
});

export const setTaskArchivedAction = createAction({
  auth: true,
  input: taskIdSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskOwnerAccess(input.id, session.user.id);
    const boardId = existing.board.toString();
    const isArchived = existing.archivedAt === null;

    const task = await setTaskArchived(input.id, isArchived);

    await recordActivity({
      actorId: session.user.id,
      action: isArchived ? "archived" : "restored",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
    });

    revalidateTaskScope(boardId);
    return task;
  },
});

export const deleteTaskAction = createAction({
  auth: ["admin"],
  input: taskIdSchema,
  handler: async ({ input, session }) => {
    const existing = await assertTaskOwnerAccess(input.id, session.user.id);
    const boardId = existing.board.toString();
    const task = await getTaskById(input.id);

    await deleteTask(input.id);

    await recordActivity({
      actorId: session.user.id,
      action: "deleted",
      entityType: "task",
      entityId: task.id,
      entityLabel: task.title,
      boardId,
    });

    revalidateTaskScope(boardId);
  },
});

export const addChecklistItemAction = createAction({
  auth: true,
  input: addChecklistItemSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskOwnerAccess(input.taskId, session.user.id);
    const task = await addChecklistItem(input.taskId, input.title);

    revalidateTaskScope(existing.board.toString());
    return task;
  },
});

export const updateChecklistItemAction = createAction({
  auth: true,
  input: updateChecklistItemSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskOwnerAccess(input.taskId, session.user.id);

    const task = await updateChecklistItem(input.taskId, input.itemId, {
      title: input.title,
      done: input.done,
    });

    revalidateTaskScope(existing.board.toString());
    return task;
  },
});

export const removeChecklistItemAction = createAction({
  auth: true,
  input: removeChecklistItemSchema,
  handler: async ({ input, session }): Promise<Task> => {
    const existing = await assertTaskOwnerAccess(input.taskId, session.user.id);
    const task = await removeChecklistItem(input.taskId, input.itemId);

    revalidateTaskScope(existing.board.toString());
    return task;
  },
});

export const createCommentAction = createAction({
  auth: true,
  input: createCommentSchema,
  handler: async ({ input, session }): Promise<Comment> => {
    const existing = await assertTaskEditAccess(input.taskId, session.user.id);
    const boardId = existing.board.toString();

    const comment = await createComment(input, session.user.id);

    await recordActivity({
      actorId: session.user.id,
      action: "created",
      entityType: "comment",
      entityId: comment.id,
      entityLabel: comment.body.slice(0, 80),
      boardId,
      context: { type: "task", id: input.taskId, label: existing.title },
    });

    revalidateTaskScope(boardId);
    return comment;
  },
});

/** Authors delete their own; admins delete anyone's. */
export const deleteCommentAction = createAction({
  auth: true,
  input: commentIdSchema,
  handler: async ({ input, session }) => {
    const comment = await getCommentById(input.id);
    const existing = await assertTaskEditAccess(comment.taskId, session.user.id);

    const isAuthor = comment.author?.id === session.user.id;
    const isAdmin = getSessionRole(session) === "admin";

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenError("You can only delete your own comments.");
    }

    await deleteComment(input.id);

    revalidateTaskScope(existing.board.toString());
  },
});

export const logTimeAction = createAction({
  auth: true,
  input: logTimeSchema,
  handler: async ({ input, session }): Promise<TaskDetail> => {
    const existing = await assertTaskEditAccess(input.taskId, session.user.id);

    const detail = await logTime(input.taskId, input, session.user.id);

    revalidateTaskScope(existing.board.toString());
    return detail;
  },
});

export const removeTimeEntryAction = createAction({
  auth: true,
  input: timeEntryIdSchema,
  handler: async ({ input, session }): Promise<TaskDetail> => {
    const existing = await assertTaskEditAccess(input.taskId, session.user.id);

    const detail = await removeTimeEntry(input.taskId, input.entryId);

    revalidateTaskScope(existing.board.toString());
    return detail;
  },
});

export const startTimerAction = createAction({
  auth: true,
  input: taskIdSchema,
  handler: async ({ input, session }): Promise<TaskDetail> => {
    const existing = await assertTaskEditAccess(input.id, session.user.id);

    const detail = await startTimer(input.id, session.user.id);

    revalidateTaskScope(existing.board.toString());
    return detail;
  },
});

export const stopTimerAction = createAction({
  auth: true,
  input: taskIdSchema,
  handler: async ({ input, session }): Promise<TaskDetail> => {
    const existing = await assertTaskEditAccess(input.id, session.user.id);

    const detail = await stopTimer(input.id);

    revalidateTaskScope(existing.board.toString());
    return detail;
  },
});

/** Uploaders remove their own; admins remove anyone's. */
export const deleteAttachmentAction = createAction({
  auth: true,
  input: attachmentIdSchema,
  handler: async ({ input, session }) => {
    const attachment = await getAttachmentById(input.id);
    const existing = await assertTaskEditAccess(attachment.taskId, session.user.id);

    const isUploader = attachment.uploadedBy?.id === session.user.id;
    const isAdmin = getSessionRole(session) === "admin";

    if (!isUploader && !isAdmin) {
      throw new ForbiddenError("You can only remove files you uploaded.");
    }

    await deleteAttachment(input.id);

    revalidateTaskScope(existing.board.toString());
  },
});
