import "server-only";

import { Types } from "mongoose";

import { UserModel } from "@/features/auth/server/user.model";
import {
  DEFAULT_LISTS,
  type BoardAccessMode,
  type BoardIcon,
  type LabelColor,
} from "@/features/tasks/constants";
import {
  BoardModel,
  LabelModel,
  ListModel,
  TaskModel,
  WorkspaceModel,
  type BoardDoc,
  type LabelDoc,
  type ListDoc,
  type TaskDoc,
} from "@/features/tasks/server/models";
import { deleteBoardsCascade } from "@/features/tasks/server/deletion.service";
import {
  positionAfter,
  resolveDropPosition,
  sequentialPositions,
} from "@/features/tasks/position";
import { TASK_POPULATE } from "@/features/tasks/server/populate";
import {
  toBoard,
  toLabel,
  toList,
  toTask,
} from "@/features/tasks/server/serialize";
import { assertWorkspaceMember } from "@/features/tasks/server/workspace.service";
import type {
  Board,
  BoardSnapshot,
  BoardSummary,
  Label,
  List,
} from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

async function nextBoardPosition(workspaceId: string): Promise<number> {
  const last = await BoardModel.findOne({ workspace: workspaceId })
    .sort({ position: -1 })
    .select("position")
    .lean<{ position: number }>();

  return positionAfter(last?.position ?? null);
}

/**
 * Loads a board and proves the caller may see it.
 *
 * Returns the document so callers get the workspace id without a second read —
 * every mutation needs both the access check and the board's workspace for the
 * `revalidatePath` that follows.
 */
/** Administrators keep access to every board under every access mode. */
async function isAdminUser(userId: string): Promise<boolean> {
  return Boolean(await UserModel.exists({ _id: userId, role: "admin" }));
}

function isBoardEditor(board: BoardDoc, userId: string): boolean {
  return (board.editors ?? []).some(
    (editorId) => editorId.toString() === userId,
  );
}

export async function assertBoardAccess(
  boardId: string,
  userId: string,
): Promise<BoardDoc> {
  await connectToDatabase();

  const board = await BoardModel.findById(boardId).lean<BoardDoc>();

  if (!board) {
    throw new NotFoundError("That board no longer exists.");
  }

  await assertWorkspaceMember(board.workspace.toString(), userId);

  // A private board is missing rather than forbidden to anyone outside it.
  // "You do not have permission to view this" confirms the board exists and
  // names something the reader was not meant to know about.
  if (
    board.accessMode === "private" &&
    !isBoardEditor(board, userId) &&
    !(await isAdminUser(userId))
  ) {
    throw new NotFoundError("That board no longer exists.");
  }

  return board;
}

/**
 * Mutation access for a board.
 *
 * Workspace membership grants read access. Editing is either workspace-wide,
 * explicitly granted on this board, or retained by an administrator so a
 * restricted board can never lock its administrators out.
 */
export async function assertBoardEditAccess(
  boardId: string,
  userId: string,
): Promise<BoardDoc> {
  const board = await assertBoardAccess(boardId, userId);

  if (board.accessMode === "workspace" || isBoardEditor(board, userId)) {
    return board;
  }

  if (!(await isAdminUser(userId))) {
    throw new ForbiddenError("You have view-only access to this board.");
  }

  return board;
}

/**
 * The boards `viewerId` may see in a workspace.
 *
 * The viewer is a required argument rather than an option with a default: every
 * board list in the app flows from here — the sidebar, the dashboard, my tasks,
 * the calendar, reports, activity and search all derive their board ids from
 * this call — so an unscoped variant would quietly leak a private board into
 * six screens at once.
 */
export async function listBoards(
  workspaceId: string,
  viewerId: string,
  options: { includeArchived?: boolean } = {},
): Promise<Board[]> {
  await connectToDatabase();

  // Built as a plain record: Mongoose 9 types filter values against the schema,
  // and `accessMode` is declared as an enum, so an inline `$ne: "private"`
  // widens to `string` and fails to typecheck.
  const query: Record<string, unknown> = { workspace: workspaceId };

  if (!options.includeArchived) {
    query.archivedAt = null;
  }

  // Narrowed in the query rather than after it, so a private board never
  // reaches the process rendering the sidebar, the dashboard counts or a
  // search result.
  if (!(await isAdminUser(viewerId))) {
    query.$or = [
      { accessMode: { $ne: "private" } },
      { editors: new Types.ObjectId(viewerId) },
    ];
  }

  const docs = await BoardModel.find(query)
    .sort({ position: 1 })
    .lean<BoardDoc[]>();

  return docs.map(toBoard);
}

/**
 * The board index: every board plus the three numbers its card shows.
 *
 * One grouped aggregation rather than three counts per board — the index is the
 * first screen after sign-in and a query per card is how it stops being fast.
 */
export async function listBoardSummaries(
  workspaceId: string,
  viewerId: string,
): Promise<BoardSummary[]> {
  await connectToDatabase();

  const boards = await listBoards(workspaceId, viewerId);

  if (boards.length === 0) {
    return [];
  }

  const boardIds = boards.map((board) => new Types.ObjectId(board.id));
  const now = new Date();

  const counts = await TaskModel.aggregate<{
    _id: Types.ObjectId;
    taskCount: number;
    completedCount: number;
    overdueCount: number;
  }>([
    {
      $match: {
        board: { $in: boardIds },
        parent: null,
        archivedAt: null,
      },
    },
    {
      $group: {
        _id: "$board",
        taskCount: { $sum: 1 },
        completedCount: {
          $sum: { $cond: [{ $ne: ["$completedAt", null] }, 1, 0] },
        },
        overdueCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$completedAt", null] },
                  { $ne: ["$dueDate", null] },
                  { $lt: ["$dueDate", now] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const byBoard = new Map(counts.map((row) => [row._id.toString(), row]));

  return boards.map((board) => {
    const row = byBoard.get(board.id);

    return {
      ...board,
      taskCount: row?.taskCount ?? 0,
      completedCount: row?.completedCount ?? 0,
      overdueCount: row?.overdueCount ?? 0,
    };
  });
}

export async function getBoardById(id: string): Promise<Board> {
  await connectToDatabase();

  const doc = await BoardModel.findById(id).lean<BoardDoc>();

  if (!doc) {
    throw new NotFoundError("That board no longer exists.");
  }

  return toBoard(doc);
}

/**
 * Everything the board page renders, in three queries.
 *
 * All four views work off the same snapshot, which is what lets the view
 * switcher change layout without refetching: the data is already in the client.
 */
export async function getBoardSnapshot(id: string): Promise<BoardSnapshot> {
  await connectToDatabase();

  const board = await getBoardById(id);

  const [lists, labels, tasks] = await Promise.all([
    ListModel.find({ board: id }).sort({ position: 1 }).lean<ListDoc[]>(),
    LabelModel.find({ board: id }).sort({ name: 1 }).lean<LabelDoc[]>(),
    TaskModel.find({ board: id, parent: null, archivedAt: null })
      .populate(TASK_POPULATE)
      .sort({ position: 1 })
      .lean<TaskDoc[]>(),
  ]);

  return {
    board,
    lists: lists.map(toList),
    labels: labels.map(toLabel),
    tasks: tasks.map(toTask),
  };
}

export async function createBoard(
  input: {
    workspaceId: string;
    name: string;
    description?: string;
    icon: BoardIcon;
    color: LabelColor;
  },
  createdById: string,
): Promise<Board> {
  await connectToDatabase();

  const created = await BoardModel.create({
    workspace: new Types.ObjectId(input.workspaceId),
    name: input.name,
    description: input.description ?? null,
    icon: input.icon,
    color: input.color,
    position: await nextBoardPosition(input.workspaceId),
    createdBy: new Types.ObjectId(createdById),
  });

  // A board with no columns cannot accept a task, so it would open as a dead
  // end. Seeding is part of creation rather than a first-open side effect.
  const positions = sequentialPositions(DEFAULT_LISTS.length);

  await ListModel.insertMany(
    DEFAULT_LISTS.map((list, index) => ({
      board: created._id,
      name: list.name,
      position: positions[index],
      isTerminal: list.isTerminal,
    })),
  );

  return getBoardById(created._id.toString());
}

export async function updateBoard(
  id: string,
  input: {
    name: string;
    description?: string;
    icon: BoardIcon;
    color: LabelColor;
  },
): Promise<Board> {
  await connectToDatabase();

  const updated = await BoardModel.findByIdAndUpdate(
    id,
    {
      name: input.name,
      description: input.description ?? null,
      icon: input.icon,
      color: input.color,
    },
    { new: true, runValidators: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That board no longer exists.");
  }

  return getBoardById(id);
}

export async function setBoardPermissions(
  id: string,
  input: { accessMode: BoardAccessMode; editorIds: string[] },
): Promise<Board> {
  await connectToDatabase();

  const board = await BoardModel.findById(id)
    .select("workspace")
    .lean<{ workspace: Types.ObjectId }>();

  if (!board) {
    throw new NotFoundError("That board no longer exists.");
  }

  const workspace = await WorkspaceModel.findById(board.workspace)
    .select("members")
    .lean<{ members: Types.ObjectId[] }>();
  const members = new Set(
    (workspace?.members ?? []).map((memberId) => memberId.toString()),
  );
  const editorIds = [...new Set(input.editorIds)];

  if (editorIds.some((editorId) => !members.has(editorId))) {
    throw new ValidationError("Please check the selected board editors.", {
      editorIds: ["Every editor must be a member of this workspace."],
    });
  }

  const updated = await BoardModel.findByIdAndUpdate(
    id,
    {
      accessMode: input.accessMode,
      editors:
        input.accessMode === "restricted"
          ? editorIds.map((editorId) => new Types.ObjectId(editorId))
          : [],
    },
    { new: true, runValidators: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That board no longer exists.");
  }

  return getBoardById(id);
}

export async function setBoardArchived(
  id: string,
  isArchived: boolean,
): Promise<Board> {
  await connectToDatabase();

  const updated = await BoardModel.findByIdAndUpdate(
    id,
    { archivedAt: isArchived ? new Date() : null },
    { new: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That board no longer exists.");
  }

  return getBoardById(id);
}

/**
 * Permanently removes a board and everything under it.
 *
 * Archiving is the everyday action; this is the admin-only escape hatch. The
 * children go in the same call because a task whose board is gone is
 * unreachable from every screen and would otherwise sit in the collection for
 * ever.
 */
export async function deleteBoard(id: string): Promise<void> {
  await connectToDatabase();

  const board = await BoardModel.findById(id)
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!board) {
    throw new NotFoundError("That board no longer exists.");
  }

  await deleteBoardsCascade([board._id]);
}

async function readBoardPosition(id: string): Promise<number | null> {
  const doc = await BoardModel.findById(id)
    .select("position")
    .lean<{ position: number }>();

  return doc?.position ?? null;
}

async function readListPosition(id: string): Promise<number | null> {
  const doc = await ListModel.findById(id)
    .select("position")
    .lean<{ position: number }>();

  return doc?.position ?? null;
}

export async function moveBoard(
  id: string,
  workspaceId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<void> {
  await connectToDatabase();

  const position = await resolveDropPosition({
    beforeId,
    afterId,
    readPosition: readBoardPosition,
    rebalance: async () => {
      const docs = await BoardModel.find({ workspace: workspaceId })
        .sort({ position: 1 })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();

      const positions = sequentialPositions(docs.length);

      await BoardModel.bulkWrite(
        docs.map((doc, index) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { position: positions[index] } },
          },
        })),
      );
    },
  });

  await BoardModel.findByIdAndUpdate(id, { position });
}

export async function moveList(
  id: string,
  boardId: string,
  beforeId: string | null,
  afterId: string | null,
): Promise<void> {
  await connectToDatabase();

  const position = await resolveDropPosition({
    beforeId,
    afterId,
    readPosition: readListPosition,
    rebalance: async () => {
      const docs = await ListModel.find({ board: boardId })
        .sort({ position: 1 })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();

      const positions = sequentialPositions(docs.length);

      await ListModel.bulkWrite(
        docs.map((doc, index) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { position: positions[index] } },
          },
        })),
      );
    },
  });

  await ListModel.findByIdAndUpdate(id, { position });
}

export async function createList(
  input: { boardId: string; name: string; isTerminal: boolean },
): Promise<List> {
  await connectToDatabase();

  const last = await ListModel.findOne({ board: input.boardId })
    .sort({ position: -1 })
    .select("position")
    .lean<{ position: number }>();

  const created = await ListModel.create({
    board: new Types.ObjectId(input.boardId),
    name: input.name,
    position: positionAfter(last?.position ?? null),
    isTerminal: input.isTerminal,
  });

  return toList(created.toObject());
}

export async function updateList(
  id: string,
  input: { name: string; isTerminal: boolean },
): Promise<List> {
  await connectToDatabase();

  const updated = await ListModel.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  }).lean<ListDoc>();

  if (!updated) {
    throw new NotFoundError("That column no longer exists.");
  }

  return toList(updated);
}

/**
 * Deletes a column, refusing while it still holds cards.
 *
 * Silently moving them somewhere else, or deleting them along with the column,
 * both lose work to a single misclick. Making the user empty it first is the
 * only option where nothing disappears unexpectedly.
 */
export async function deleteList(id: string): Promise<List> {
  await connectToDatabase();

  const list = await ListModel.findById(id).lean<ListDoc>();

  if (!list) {
    throw new NotFoundError("That column no longer exists.");
  }

  const remaining = await TaskModel.countDocuments({
    list: id,
    archivedAt: null,
  });

  if (remaining > 0) {
    throw new ConflictError(
      `Move the ${remaining} card${remaining === 1 ? "" : "s"} out of this column before deleting it.`,
    );
  }

  const count = await ListModel.countDocuments({ board: list.board });

  if (count <= 1) {
    throw new ConflictError("A board needs at least one column.");
  }

  await ListModel.findByIdAndDelete(id);

  return toList(list);
}

function asDuplicateLabel(error: unknown): never {
  if ((error as { code?: number }).code === 11000) {
    throw new ConflictError("This board already has a label with that name.");
  }

  throw error;
}

export async function createLabel(input: {
  boardId: string;
  name: string;
  color: LabelColor;
}): Promise<Label> {
  await connectToDatabase();

  try {
    const created = await LabelModel.create({
      board: new Types.ObjectId(input.boardId),
      name: input.name,
      color: input.color,
    });

    return toLabel(created.toObject());
  } catch (error) {
    asDuplicateLabel(error);
  }
}

export async function updateLabel(
  id: string,
  input: { name: string; color: LabelColor },
): Promise<Label> {
  await connectToDatabase();

  try {
    const updated = await LabelModel.findByIdAndUpdate(id, input, {
      new: true,
      runValidators: true,
    }).lean<LabelDoc>();

    if (!updated) {
      throw new NotFoundError("That label no longer exists.");
    }

    return toLabel(updated);
  } catch (error) {
    asDuplicateLabel(error);
  }
}

/**
 * Deletes a label and pulls it off every task that carried it.
 *
 * Stale ids would otherwise be dropped silently by `populate`, leaving a task
 * whose label count never matches what it shows.
 */
export async function deleteLabel(id: string): Promise<Label> {
  await connectToDatabase();

  const deleted = await LabelModel.findByIdAndDelete(id).lean<LabelDoc>();

  if (!deleted) {
    throw new NotFoundError("That label no longer exists.");
  }

  await TaskModel.updateMany({ labels: id }, { $pull: { labels: id } });

  return toLabel(deleted);
}
