import "server-only";

import { Types } from "mongoose";

import { toUserSummary } from "@/features/auth/server/serialize";
import { UserModel } from "@/features/auth/server/user.model";
import { isAdminUser } from "@/features/auth/server/users.service";
import {
  ARCHIVE_COMPLETED_AFTER_HOURS,
  TASK_SEARCH_LIMIT,
  type MediaType,
  type TaskPriority,
} from "@/features/tasks/constants";
import {
  assertBoardAccess,
  assertBoardEditAccess,
} from "@/features/tasks/server/board.service";
import {
  LabelModel,
  ListModel,
  TaskModel,
  type ListDoc,
  type TaskDoc,
} from "@/features/tasks/server/models";
import {
  POSITION_STEP,
  positionAfter,
  resolveDropPosition,
  sequentialPositions,
} from "@/features/tasks/position";
import {
  nextOccurrence,
  type RecurrenceInput,
} from "@/features/tasks/recurrence";
import {
  TASK_DETAIL_POPULATE,
  TASK_POPULATE,
} from "@/features/tasks/server/populate";
import { toTask, toTimeEntry } from "@/features/tasks/server/serialize";
import type { Task, TaskDetail } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

/** The editable half of a task. Every key is optional; absent means "leave it". */
export type TaskPatch = {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  mediaType?: MediaType;
  assigneeId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  labelIds?: string[];
  estimateMinutes?: number | null;
};

/**
 * Loads a task and proves the caller may touch it.
 *
 * Access is inherited from the board's workspace — there is no per-task
 * membership — so this is one extra read that every mutation runs before it
 * writes anything.
 */
export async function assertTaskAccess(
  taskId: string,
  userId: string,
): Promise<TaskDoc> {
  await connectToDatabase();

  const task = await TaskModel.findById(taskId).lean<TaskDoc>();

  if (!task) {
    throw new NotFoundError("That task no longer exists.");
  }

  await assertBoardAccess(task.board.toString(), userId);

  return task;
}

/** Loads a task and proves the caller may mutate its board. */
export async function assertTaskEditAccess(
  taskId: string,
  userId: string,
): Promise<TaskDoc> {
  await connectToDatabase();

  const task = await TaskModel.findById(taskId).lean<TaskDoc>();

  if (!task) {
    throw new NotFoundError("That task no longer exists.");
  }

  await assertBoardEditAccess(task.board.toString(), userId);

  return task;
}

/**
 * Who may change the task *itself* — its title, dates, priority, assignee,
 * checklist, or whether it still exists.
 *
 * Board edit access is the floor. On top of it, once a task has an assignee it
 * belongs to two people: whoever it was given to, and whoever gave it to them.
 * Anyone else on the board can still read it, comment on it, log time against it
 * and drag it between columns — they just cannot quietly rewrite somebody's
 * work.
 *
 * Three deliberate exceptions:
 *
 *   - **Unassigned tasks stay open.** Nobody owns them yet, and locking them
 *     would mean nobody could assign them either.
 *   - **The creator keeps access.** Otherwise writing a task, handing it over,
 *     and then spotting your own typo leaves you unable to fix it.
 *   - **Global admins keep access**, so a task cannot be orphaned by the person
 *     who owned it leaving the company.
 */
export async function assertTaskOwnerAccess(
  taskId: string,
  userId: string,
): Promise<TaskDoc> {
  const task = await assertTaskEditAccess(taskId, userId);

  if (!task.assignee) {
    return task;
  }

  const isInvolved = [task.assignee, task.assignedBy, task.createdBy].some(
    (candidate) => candidate?.toString() === userId,
  );

  if (isInvolved || (await isAdminUser(userId))) {
    return task;
  }

  throw new ForbiddenError(
    "Only the person this is assigned to, or whoever assigned it, can change it.",
  );
}

export async function getTaskById(id: string): Promise<Task> {
  await connectToDatabase();

  const doc = await TaskModel.findById(id)
    .populate(TASK_POPULATE)
    .lean<TaskDoc>();

  if (!doc) {
    throw new NotFoundError("That task no longer exists.");
  }

  return toTask(doc);
}

/** Everything the drawer renders: the task, its time log and its subtasks. */
export async function getTaskDetail(id: string): Promise<TaskDetail> {
  await connectToDatabase();

  const [doc, subtasks] = await Promise.all([
    TaskModel.findById(id).populate(TASK_DETAIL_POPULATE).lean<TaskDoc>(),
    TaskModel.find({ parent: id, archivedAt: null })
      .populate(TASK_POPULATE)
      .sort({ position: 1 })
      .lean<TaskDoc[]>(),
  ]);

  if (!doc) {
    throw new NotFoundError("That task no longer exists.");
  }

  return {
    ...toTask(doc),
    assignedBy: toUserSummary(
      doc.assignedBy as Parameters<typeof toUserSummary>[0],
    ),
    timeEntries: (doc.timeEntries ?? [])
      .map((entry) => toTimeEntry(entry as Parameters<typeof toTimeEntry>[0]))
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    subtasks: subtasks.map(toTask),
  };
}

async function readTaskPosition(id: string): Promise<number | null> {
  const doc = await TaskModel.findById(id)
    .select("position")
    .lean<{ position: number }>();

  return doc?.position ?? null;
}

async function resequenceList(listId: string): Promise<void> {
  const docs = await TaskModel.find({ list: listId, parent: null })
    .sort({ position: 1 })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();

  const positions = sequentialPositions(docs.length);

  await TaskModel.bulkWrite(
    docs.map((doc, index) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { position: positions[index] } },
      },
    })),
  );
}

async function assertLabelsOnBoard(
  boardId: string,
  labelIds: string[],
): Promise<Types.ObjectId[]> {
  const unique = [...new Set(labelIds)];

  if (unique.length === 0) {
    return [];
  }

  const found = await LabelModel.countDocuments({
    _id: { $in: unique },
    board: boardId,
  });

  if (found !== unique.length) {
    throw new ValidationError("Please check the selected labels.", {
      labelIds: ["One or more labels do not belong to this board."],
    });
  }

  return unique.map((id) => new Types.ObjectId(id));
}

async function assertAssigneeExists(assigneeId: string): Promise<void> {
  if (!(await UserModel.exists({ _id: assigneeId }))) {
    throw new ValidationError("Choose an existing person.", {
      assigneeId: ["That person no longer exists."],
    });
  }
}

/** The board's first column, used when a task is created without one. */
async function firstListOfBoard(boardId: string): Promise<ListDoc> {
  const list = await ListModel.findOne({ board: boardId })
    .sort({ position: 1 })
    .lean<ListDoc>();

  if (!list) {
    throw new ValidationError("That board has no columns to add a task to.");
  }

  return list;
}

async function assertListOnBoard(
  boardId: string,
  listId: string,
): Promise<ListDoc> {
  const list = await ListModel.findOne({
    _id: listId,
    board: boardId,
  }).lean<ListDoc>();

  if (!list) {
    throw new ValidationError("Choose a column on this board.", {
      listId: ["That column is not on this board."],
    });
  }

  return list;
}

export async function createTask(
  input: {
    boardId: string;
    listId?: string;
    parentId?: string;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    mediaType?: MediaType;
    assigneeId?: string | null;
    startDate?: Date | null;
    dueDate?: Date | null;
    labelIds?: string[];
    estimateMinutes?: number | null;
    recurrence?: RecurrenceInput;
    /** Titles to spawn as children of the new task. */
    subtasks?: string[];
    /** Checklist steps, embedded on the task rather than created separately. */
    checklist?: string[];
  },
  createdById: string,
): Promise<Task> {
  await connectToDatabase();

  const list = input.listId
    ? await assertListOnBoard(input.boardId, input.listId)
    : await firstListOfBoard(input.boardId);

  const [labels] = await Promise.all([
    assertLabelsOnBoard(input.boardId, input.labelIds ?? []),
    input.assigneeId ? assertAssigneeExists(input.assigneeId) : null,
  ]);

  const last = await TaskModel.findOne({
    list: list._id,
    parent: input.parentId ? new Types.ObjectId(input.parentId) : null,
  })
    .sort({ position: -1 })
    .select("position")
    .lean<{ position: number }>();

  const created = await TaskModel.create({
    board: new Types.ObjectId(input.boardId),
    list: list._id,
    parent: input.parentId ? new Types.ObjectId(input.parentId) : null,
    title: input.title,
    description: input.description ?? null,
    position: positionAfter(last?.position ?? null),
    priority: input.priority ?? "none",
    mediaType: input.mediaType ?? "none",
    assignee: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    assignedBy: input.assigneeId ? new Types.ObjectId(createdById) : null,
    // Embedded, so this is part of the same insert rather than a second write.
    // Positions are seeded outright: a task being created has no existing steps
    // to sort against.
    checklist: (input.checklist ?? []).map((title, index) => ({
      title,
      done: false,
      position: (index + 1) * POSITION_STEP,
    })),
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    labels,
    estimateMinutes: input.estimateMinutes ?? null,
    recurrence: input.recurrence
      ? {
          ...input.recurrence,
          endsAt: input.recurrence.endsAt
            ? new Date(input.recurrence.endsAt)
            : null,
          nextOccurrenceAt: nextOccurrence(
            input.recurrence,
            input.dueDate ?? new Date(),
          ),
          lastSpawnedAt: null,
        }
      : null,
    // A task created straight into the Done column is done. Otherwise the board
    // would show a completed-looking card that every "open tasks" query counts.
    completedAt: list.isTerminal ? new Date() : null,
    createdBy: new Types.ObjectId(createdById),
  });

  // Children are titles only: they share the parent's column so the board's
  // `parent: null` filter keeps them off it, and everything else about them —
  // owner, dates, labels — is set from their own drawer afterwards. Their
  // positions can be seeded outright because a task created a moment ago has no
  // other children to sort against.
  if (input.subtasks?.length) {
    const positions = sequentialPositions(input.subtasks.length);

    await TaskModel.insertMany(
      input.subtasks.map((title, index) => ({
        board: new Types.ObjectId(input.boardId),
        list: list._id,
        parent: created._id,
        title,
        position: positions[index],
        completedAt: list.isTerminal ? new Date() : null,
        createdBy: new Types.ObjectId(createdById),
      })),
    );
  }

  return getTaskById(created._id.toString());
}

/**
 * Applies a patch, writing only the keys the caller sent.
 *
 * The drawer autosaves field by field, so a full-document update would let two
 * people editing different fields of the same task overwrite each other with
 * stale values for everything they did not touch.
 */
export async function updateTask(
  id: string,
  boardId: string,
  patch: TaskPatch,
  actorId: string,
): Promise<Task> {
  await connectToDatabase();

  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    update.title = patch.title;
  }

  if (patch.description !== undefined) {
    update.description = patch.description;
  }

  if (patch.priority !== undefined) {
    update.priority = patch.priority;
  }

  if (patch.mediaType !== undefined) {
    update.mediaType = patch.mediaType;
  }

  if (patch.startDate !== undefined) {
    update.startDate = patch.startDate;
  }

  if (patch.dueDate !== undefined) {
    update.dueDate = patch.dueDate;
  }

  if (patch.estimateMinutes !== undefined) {
    update.estimateMinutes = patch.estimateMinutes;
  }

  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId) {
      await assertAssigneeExists(patch.assigneeId);
    }

    update.assignee = patch.assigneeId
      ? new Types.ObjectId(patch.assigneeId)
      : null;

    // Written from the same branch as the assignee so the two cannot disagree:
    // whoever made this change is who assigned it, and unassigning leaves nobody
    // to have assigned it. Recorded here rather than read back out of the
    // activity feed, which is paged and prunable.
    update.assignedBy = patch.assigneeId
      ? new Types.ObjectId(actorId)
      : null;
  }

  if (patch.labelIds !== undefined) {
    update.labels = await assertLabelsOnBoard(boardId, patch.labelIds);
  }

  if (Object.keys(update).length === 0) {
    return getTaskById(id);
  }

  const updated = await TaskModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That task no longer exists.");
  }

  return getTaskById(id);
}

/**
 * Moves a card, and reconciles completion with where it landed.
 *
 * Dropping into a terminal column is how most tasks get finished — asking
 * someone to drag to Done *and* tick a box would be the kind of double action
 * this board exists to avoid.
 */
export async function moveTask(
  id: string,
  boardId: string,
  input: { listId: string; beforeId: string | null; afterId: string | null },
): Promise<Task> {
  await connectToDatabase();

  const list = await assertListOnBoard(boardId, input.listId);
  const existing = await TaskModel.findById(id)
    .select("completedAt")
    .lean<{ completedAt: Date | null }>();

  if (!existing) {
    throw new NotFoundError("That task no longer exists.");
  }

  const position = await resolveDropPosition({
    beforeId: input.beforeId,
    afterId: input.afterId,
    readPosition: readTaskPosition,
    rebalance: () => resequenceList(input.listId),
  });

  await TaskModel.findByIdAndUpdate(id, {
    list: list._id,
    position,
    // Only touch `completedAt` when the column disagrees with it, so dragging a
    // card around inside Done does not keep resetting when it was finished.
    ...(list.isTerminal
      ? existing.completedAt
        ? {}
        : { completedAt: new Date() }
      : existing.completedAt
        ? { completedAt: null }
        : {}),
  });

  return getTaskById(id);
}

/**
 * Ticks or unticks a task, moving it to match.
 *
 * Completion and column are two views of the same fact, so setting one has to
 * set the other or the board immediately contradicts the checkbox.
 */
/**
 * Marks the artwork for a post finished, or hands it back to the designer.
 *
 * Separate from `setTaskComplete` and deliberately does not move the card. The
 * designer finishing the asset and the post going live are different events —
 * often days apart — so this records one without asserting the other. The card
 * stays in whatever column its owner put it in.
 *
 * Who is credited is taken from the caller rather than a parameter, so the name
 * on the card is always someone who actually pressed the button.
 */
export async function setTaskAssetReady(
  id: string,
  isReady: boolean,
  actorId: string,
): Promise<Task> {
  await connectToDatabase();

  const updated = await TaskModel.findByIdAndUpdate(
    id,
    {
      assetReadyAt: isReady ? new Date() : null,
      assetReadyBy: isReady ? new Types.ObjectId(actorId) : null,
    },
    { new: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That task no longer exists.");
  }

  return getTaskById(id);
}

export async function setTaskComplete(
  id: string,
  boardId: string,
  isComplete: boolean,
): Promise<Task> {
  await connectToDatabase();

  const lists = await ListModel.find({ board: boardId })
    .sort({ position: 1 })
    .lean<ListDoc[]>();

  const terminal = lists.find((list) => list.isTerminal);
  const firstOpen = lists.find((list) => !list.isTerminal);
  const destination = isComplete ? terminal : firstOpen;

  const update: Record<string, unknown> = {
    completedAt: isComplete ? new Date() : null,
  };

  if (destination) {
    const last = await TaskModel.findOne({ list: destination._id, parent: null })
      .sort({ position: -1 })
      .select("position")
      .lean<{ position: number }>();

    update.list = destination._id;
    update.position = positionAfter(last?.position ?? null);
  }

  const updated = await TaskModel.findByIdAndUpdate(id, update, { new: true })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That task no longer exists.");
  }

  return getTaskById(id);
}

/**
 * Archives work that has been finished for longer than the retention window.
 *
 * Runs on read, like the recurrence sweep, because there is no scheduler. Unlike
 * that one this needs no claim and cannot race: it is a single `updateMany`
 * whose filter (`archivedAt: null`) is also what the update clears, so two
 * concurrent requests do not produce two outcomes — the second simply matches
 * nothing. That is the difference between a sweep that *writes a field* and one
 * that *creates documents*, and it is why this one is safe where recurrence
 * needed a top-level claim.
 *
 * Subtasks are deliberately left alone. They are archived with their parent by
 * the drawer, and sweeping them independently would empty a live parent's
 * subtask list out from under it.
 */
export async function archiveCompletedTasks(
  boardIds: readonly string[],
): Promise<void> {
  if (boardIds.length === 0) {
    return;
  }

  await connectToDatabase();

  const cutoff = new Date(
    Date.now() - ARCHIVE_COMPLETED_AFTER_HOURS * 60 * 60 * 1000,
  );

  await TaskModel.updateMany(
    {
      board: { $in: boardIds.map((id) => new Types.ObjectId(id)) },
      parent: null,
      archivedAt: null,
      completedAt: { $ne: null, $lte: cutoff },
    },
    { $set: { archivedAt: new Date() } },
  );
}

export async function setTaskArchived(
  id: string,
  isArchived: boolean,
): Promise<Task> {
  await connectToDatabase();

  const updated = await TaskModel.findByIdAndUpdate(
    id,
    { archivedAt: isArchived ? new Date() : null },
    { new: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That task no longer exists.");
  }

  return getTaskById(id);
}

/** Removes a task and its subtasks. Comments and attachments go with them. */
export async function deleteTask(id: string): Promise<void> {
  await connectToDatabase();

  const deleted = await TaskModel.findByIdAndDelete(id)
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!deleted) {
    throw new NotFoundError("That task no longer exists.");
  }

  await TaskModel.deleteMany({ parent: id });
}

export async function addChecklistItem(
  taskId: string,
  title: string,
): Promise<Task> {
  await connectToDatabase();

  const task = await TaskModel.findById(taskId)
    .select("checklist")
    .lean<{ checklist: { position: number }[] }>();

  if (!task) {
    throw new NotFoundError("That task no longer exists.");
  }

  const last = task.checklist.at(-1);

  await TaskModel.findByIdAndUpdate(taskId, {
    $push: {
      checklist: {
        title,
        done: false,
        position: positionAfter(last?.position ?? null),
      },
    },
  });

  return getTaskById(taskId);
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  patch: { title?: string; done?: boolean },
): Promise<Task> {
  await connectToDatabase();

  const update: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    update["checklist.$.title"] = patch.title;
  }

  if (patch.done !== undefined) {
    update["checklist.$.done"] = patch.done;
  }

  if (Object.keys(update).length === 0) {
    return getTaskById(taskId);
  }

  const updated = await TaskModel.findOneAndUpdate(
    { _id: taskId, "checklist._id": itemId },
    update,
    { new: true, runValidators: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That checklist item no longer exists.");
  }

  return getTaskById(taskId);
}

export async function removeChecklistItem(
  taskId: string,
  itemId: string,
): Promise<Task> {
  await connectToDatabase();

  await TaskModel.findByIdAndUpdate(taskId, {
    $pull: { checklist: { _id: new Types.ObjectId(itemId) } },
  });

  return getTaskById(taskId);
}

export async function logTime(
  taskId: string,
  input: { minutes: number; note?: string },
  userId: string,
): Promise<TaskDetail> {
  await connectToDatabase();

  await TaskModel.findByIdAndUpdate(taskId, {
    $push: {
      timeEntries: {
        user: new Types.ObjectId(userId),
        minutes: input.minutes,
        note: input.note ?? null,
        loggedAt: new Date(),
      },
    },
  });

  return getTaskDetail(taskId);
}

export async function removeTimeEntry(
  taskId: string,
  entryId: string,
): Promise<TaskDetail> {
  await connectToDatabase();

  await TaskModel.findByIdAndUpdate(taskId, {
    $pull: { timeEntries: { _id: new Types.ObjectId(entryId) } },
  });

  return getTaskDetail(taskId);
}

/**
 * Starts a timer, refusing if one is already running.
 *
 * The guard is on the update filter rather than a read-then-write, so two
 * clicks in quick succession cannot both start one and lose the earlier
 * `startedAt`.
 */
export async function startTimer(
  taskId: string,
  userId: string,
): Promise<TaskDetail> {
  await connectToDatabase();

  const updated = await TaskModel.findOneAndUpdate(
    { _id: taskId, runningTimer: null },
    {
      runningTimer: { user: new Types.ObjectId(userId), startedAt: new Date() },
    },
    { new: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new ValidationError("A timer is already running on this task.");
  }

  return getTaskDetail(taskId);
}

/**
 * Stops the running timer and converts it into a logged entry.
 *
 * Rounds up to a minute so a genuine but brief piece of work is not recorded as
 * zero, which the `min: 1` on the entry schema would reject anyway.
 */
export async function stopTimer(taskId: string): Promise<TaskDetail> {
  await connectToDatabase();

  const task = await TaskModel.findById(taskId)
    .select("runningTimer")
    .lean<{ runningTimer: { user: Types.ObjectId; startedAt: Date } | null }>();

  if (!task?.runningTimer) {
    throw new ValidationError("No timer is running on this task.");
  }

  const elapsedMs = Date.now() - task.runningTimer.startedAt.getTime();
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000));

  await TaskModel.findByIdAndUpdate(taskId, {
    runningTimer: null,
    $push: {
      timeEntries: {
        user: task.runningTimer.user,
        minutes,
        note: null,
        loggedAt: new Date(),
      },
    },
  });

  return getTaskDetail(taskId);
}

/**
 * Tasks assigned to one person across every board they can see.
 *
 * Sorted by due date with undated work last, because "what is due" is the
 * question this list exists to answer.
 */
export async function listTasksForUser(options: {
  userId: string;
  boardIds: readonly string[];
  includeCompleted: boolean;
}): Promise<Task[]> {
  await connectToDatabase();

  if (options.boardIds.length === 0) {
    return [];
  }

  const docs = await TaskModel.find({
    assignee: options.userId,
    board: { $in: options.boardIds.map((id) => new Types.ObjectId(id)) },
    archivedAt: null,
    ...(options.includeCompleted ? {} : { completedAt: null }),
  })
    .populate(TASK_POPULATE)
    .sort({ dueDate: 1, position: 1 })
    .limit(500)
    .lean<TaskDoc[]>();

  return docs.map(toTask);
}

/**
 * Archived work across a set of boards, newest first.
 *
 * The counterpart to every other list in the app, which all filter archived
 * tasks out. Nothing here is deleted — this is where a task goes when the sweep
 * retires it, and where you come to find it again or put it back.
 */
export async function listArchivedTasks(
  boardIds: readonly string[],
): Promise<Task[]> {
  await connectToDatabase();

  if (boardIds.length === 0) {
    return [];
  }

  const docs = await TaskModel.find({
    board: { $in: boardIds.map((id) => new Types.ObjectId(id)) },
    parent: null,
    archivedAt: { $ne: null },
  })
    .populate(TASK_POPULATE)
    .sort({ archivedAt: -1 })
    .limit(200)
    .lean<TaskDoc[]>();

  return docs.map(toTask);
}

/** Every live card on a set of boards. Feeds the cross-board calendar and reports. */
export async function listTasksOnBoards(options: {
  boardIds: readonly string[];
  includeCompleted: boolean;
}): Promise<Task[]> {
  await connectToDatabase();

  if (options.boardIds.length === 0) {
    return [];
  }

  const docs = await TaskModel.find({
    board: { $in: options.boardIds.map((id) => new Types.ObjectId(id)) },
    parent: null,
    archivedAt: null,
    ...(options.includeCompleted ? {} : { completedAt: null }),
  })
    .populate(TASK_POPULATE)
    .sort({ dueDate: 1, position: 1 })
    .limit(2000)
    .lean<TaskDoc[]>();

  return docs.map(toTask);
}

/**
 * Title search for the command palette.
 *
 * A case-insensitive regex, escaped so a stray `(` in someone's query is a
 * character rather than a syntax error the driver rejects. Right at this scale;
 * revisit if a workspace ever holds six figures of tasks.
 */
export async function searchTasks(options: {
  query: string;
  boardIds: readonly string[];
}): Promise<Task[]> {
  await connectToDatabase();

  const trimmed = options.query.trim();

  if (trimmed.length === 0 || options.boardIds.length === 0) {
    return [];
  }

  const pattern = new RegExp(
    trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );

  const docs = await TaskModel.find({
    board: { $in: options.boardIds.map((id) => new Types.ObjectId(id)) },
    archivedAt: null,
    title: pattern,
  })
    .populate(TASK_POPULATE)
    .sort({ updatedAt: -1 })
    .limit(TASK_SEARCH_LIMIT)
    .lean<TaskDoc[]>();

  return docs.map(toTask);
}
