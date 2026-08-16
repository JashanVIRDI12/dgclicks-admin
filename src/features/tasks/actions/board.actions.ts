"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";

import {
  diffFields,
  recordActivity,
} from "@/features/activity/server/activity.service";
import {
  boardIdSchema,
  boardPermissionsSchema,
  createBoardSchema,
  createLabelSchema,
  createListSchema,
  labelIdSchema,
  listIdSchema,
  moveBoardSchema,
  moveListSchema,
  updateBoardSchema,
  updateLabelSchema,
  updateListSchema,
} from "@/features/tasks/schemas/board.schema";
import {
  assertBoardAccess,
  assertBoardEditAccess,
  createBoard,
  createLabel,
  createList,
  deleteBoard,
  deleteLabel,
  deleteList,
  getBoardById,
  moveBoard,
  moveList,
  setBoardArchived,
  setBoardPermissions,
  updateBoard,
  updateLabel,
  updateList,
} from "@/features/tasks/server/board.service";
import { assertWorkspaceManager } from "@/features/tasks/server/workspace.service";
import { LabelModel, ListModel } from "@/features/tasks/server/models";
import type { Board, Label, List } from "@/features/tasks/types";
import { createAction } from "@/lib/actions/create-action";
import { connectToDatabase } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";

function revalidateBoard(boardId: string): void {
  revalidatePath(`/boards/${boardId}` as Route);
  revalidatePath("/boards");
  revalidatePath("/dashboard");
  revalidatePath("/activity");
}

/**
 * The board a column belongs to, with the caller's access to it proved.
 *
 * Column and label ids arrive from the client on their own; without walking up
 * to the board first there would be nothing tying them to a workspace the
 * caller is a member of.
 */
async function boardForList(listId: string, userId: string): Promise<string> {
  await connectToDatabase();

  const list = await ListModel.findById(listId).select("board").lean<{
    board: { toString(): string };
  }>();

  if (!list) {
    throw new NotFoundError("That column no longer exists.");
  }

  const boardId = list.board.toString();
  await assertBoardEditAccess(boardId, userId);

  return boardId;
}

async function boardForLabel(labelId: string, userId: string): Promise<string> {
  await connectToDatabase();

  const label = await LabelModel.findById(labelId).select("board").lean<{
    board: { toString(): string };
  }>();

  if (!label) {
    throw new NotFoundError("That label no longer exists.");
  }

  const boardId = label.board.toString();
  await assertBoardEditAccess(boardId, userId);

  return boardId;
}

/** What boards exist in a workspace is a workspace-management decision. */
export const createBoardAction = createAction({
  auth: true,
  input: createBoardSchema,
  handler: async ({ input, session }): Promise<Board> => {
    await assertWorkspaceManager(input.workspaceId, session.user.id);

    const board = await createBoard(input, session.user.id);

    await recordActivity({
      actorId: session.user.id,
      action: "created",
      entityType: "board",
      entityId: board.id,
      entityLabel: board.name,
      boardId: board.id,
    });

    revalidateBoard(board.id);
    return board;
  },
});

export const updateBoardAction = createAction({
  auth: true,
  input: updateBoardSchema,
  handler: async ({ input, session }): Promise<Board> => {
    const { id, ...fields } = input;
    await assertBoardEditAccess(id, session.user.id);

    const before = await getBoardById(id);
    const board = await updateBoard(id, fields);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "board",
      entityId: board.id,
      entityLabel: board.name,
      boardId: board.id,
      changes: diffFields(before, board, [
        "name",
        "description",
        "icon",
        "color",
      ]),
    });

    revalidateBoard(board.id);
    return board;
  },
});

/**
 * Who may see and edit one board.
 *
 * A workspace-management right rather than a global one: deciding that a board
 * is private is part of running the workspace it lives in, and the person who
 * created that workspace should not need an administrator to do it.
 *
 * `assertBoardAccess` still runs first, so a private board somebody else set up
 * stays invisible — a manager cannot re-permission a board they are not allowed
 * to know exists.
 */
export const setBoardPermissionsAction = createAction({
  auth: true,
  input: boardPermissionsSchema,
  handler: async ({ input, session }): Promise<Board> => {
    const { id, ...permissions } = input;
    const existing = await assertBoardAccess(id, session.user.id);
    await assertWorkspaceManager(existing.workspace.toString(), session.user.id);

    const before = await getBoardById(id);
    const board = await setBoardPermissions(id, permissions, session.user.id);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "board",
      entityId: board.id,
      entityLabel: board.name,
      boardId: board.id,
      changes: [
        {
          field: "permissions",
          from:
            before.accessMode === "workspace"
              ? "All workspace members"
              : `${before.editorIds.length} editor${before.editorIds.length === 1 ? "" : "s"}`,
          to:
            board.accessMode === "workspace"
              ? "All workspace members"
              : `${board.editorIds.length} editor${board.editorIds.length === 1 ? "" : "s"}`,
        },
      ],
    });

    revalidateBoard(id);
    return board;
  },
});

/** Toggles rather than takes a target, so the button cannot fight stale state. */
export const setBoardArchivedAction = createAction({
  auth: ["admin"],
  input: boardIdSchema,
  handler: async ({ input, session }): Promise<Board> => {
    const existing = await assertBoardAccess(input.id, session.user.id);
    const isArchived = existing.archivedAt === null;
    const board = await setBoardArchived(input.id, isArchived);

    await recordActivity({
      actorId: session.user.id,
      action: isArchived ? "archived" : "restored",
      entityType: "board",
      entityId: board.id,
      entityLabel: board.name,
      boardId: board.id,
    });

    revalidateBoard(board.id);
    return board;
  },
});

/**
 * Permanent deletion, admin-only.
 *
 * Archiving is the everyday action — losing a board and every task under it to
 * a misclick is not recoverable. Hiding the button is a courtesy; this check is
 * the boundary.
 */
export const deleteBoardAction = createAction({
  auth: ["admin"],
  input: boardIdSchema,
  handler: async ({ input, session }) => {
    await assertBoardAccess(input.id, session.user.id);

    const board = await getBoardById(input.id);
    await deleteBoard(input.id);

    await recordActivity({
      actorId: session.user.id,
      action: "deleted",
      entityType: "board",
      entityId: board.id,
      entityLabel: board.name,
    });

    revalidateBoard(board.id);
  },
});

export const moveBoardAction = createAction({
  auth: ["admin"],
  input: moveBoardSchema,
  handler: async ({ input, session }) => {
    const board = await assertBoardAccess(input.id, session.user.id);

    await moveBoard(
      input.id,
      board.workspace.toString(),
      input.beforeId,
      input.afterId,
    );

    revalidatePath("/boards");
  },
});

export const createListAction = createAction({
  auth: true,
  input: createListSchema,
  handler: async ({ input, session }): Promise<List> => {
    await assertBoardEditAccess(input.boardId, session.user.id);

    const list = await createList(input);
    const board = await getBoardById(input.boardId);

    await recordActivity({
      actorId: session.user.id,
      action: "created",
      entityType: "list",
      entityId: list.id,
      entityLabel: list.name,
      boardId: board.id,
      context: { type: "board", id: board.id, label: board.name },
    });

    revalidateBoard(input.boardId);
    return list;
  },
});

export const updateListAction = createAction({
  auth: true,
  input: updateListSchema,
  handler: async ({ input, session }): Promise<List> => {
    const { id, ...fields } = input;
    const boardId = await boardForList(id, session.user.id);

    const list = await updateList(id, fields);

    await recordActivity({
      actorId: session.user.id,
      action: "updated",
      entityType: "list",
      entityId: list.id,
      entityLabel: list.name,
      boardId,
    });

    revalidateBoard(boardId);
    return list;
  },
});

export const deleteListAction = createAction({
  auth: true,
  input: listIdSchema,
  handler: async ({ input, session }) => {
    const boardId = await boardForList(input.id, session.user.id);
    const list = await deleteList(input.id);

    await recordActivity({
      actorId: session.user.id,
      action: "deleted",
      entityType: "list",
      entityId: list.id,
      entityLabel: list.name,
      boardId,
    });

    revalidateBoard(boardId);
  },
});

export const moveListAction = createAction({
  auth: true,
  input: moveListSchema,
  handler: async ({ input, session }) => {
    const boardId = await boardForList(input.id, session.user.id);

    await moveList(input.id, boardId, input.beforeId, input.afterId);

    revalidateBoard(boardId);
  },
});

export const createLabelAction = createAction({
  auth: true,
  input: createLabelSchema,
  handler: async ({ input, session }): Promise<Label> => {
    await assertBoardEditAccess(input.boardId, session.user.id);

    const label = await createLabel(input);

    revalidateBoard(input.boardId);
    return label;
  },
});

export const updateLabelAction = createAction({
  auth: true,
  input: updateLabelSchema,
  handler: async ({ input, session }): Promise<Label> => {
    const { id, ...fields } = input;
    const boardId = await boardForLabel(id, session.user.id);

    const label = await updateLabel(id, fields);

    revalidateBoard(boardId);
    return label;
  },
});

export const deleteLabelAction = createAction({
  auth: true,
  input: labelIdSchema,
  handler: async ({ input, session }) => {
    const boardId = await boardForLabel(input.id, session.user.id);

    await deleteLabel(input.id);

    revalidateBoard(boardId);
  },
});
