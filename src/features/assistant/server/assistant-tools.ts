import "server-only";

import { z } from "zod";

import type { AuthenticatedSession } from "@/features/auth/server/session";
import { getSessionRole } from "@/features/auth/server/session";
import { listTeamMembers } from "@/features/auth/server/users.service";
import {
  createBoardAction,
  createLabelAction,
  createListAction,
  deleteBoardAction,
  deleteLabelAction,
  deleteListAction,
  moveBoardAction,
  moveListAction,
  setBoardArchivedAction,
  setBoardPermissionsAction,
  updateBoardAction,
  updateLabelAction,
  updateListAction,
} from "@/features/tasks/actions/board.actions";
import {
  addChecklistItemAction,
  createCommentAction,
  createTaskAction,
  deleteAttachmentAction,
  deleteCommentAction,
  deleteTaskAction,
  logTimeAction,
  moveTaskAction,
  removeChecklistItemAction,
  removeTimeEntryAction,
  setTaskArchivedAction,
  setTaskCompleteAction,
  setTaskRecurrenceAction,
  startTimerAction,
  stopTimerAction,
  updateChecklistItemAction,
  updateTaskAction,
} from "@/features/tasks/actions/task.actions";
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  setActiveWorkspaceAction,
  setWorkspaceMembersAction,
  updateWorkspaceAction,
} from "@/features/tasks/actions/workspace.actions";
import {
  BOARD_ACCESS_MODES,
  BOARD_ICONS,
  DEFAULT_BOARD_ICON,
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  RECURRENCE_FREQUENCIES,
  TASK_PRIORITIES,
} from "@/features/tasks/constants";
import {
  assertBoardAccess,
  getBoardById,
  getBoardSnapshot,
  listBoards,
} from "@/features/tasks/server/board.service";
import {
  assertTaskAccess,
  getTaskDetail,
  searchTasks,
} from "@/features/tasks/server/task.service";
import {
  assertWorkspaceMember,
  getWorkspaceById,
  listWorkspacesForUser,
} from "@/features/tasks/server/workspace.service";
import type { ActionResult } from "@/types";
import { objectId } from "@/lib/validation";

type ToolContext = {
  session: AuthenticatedSession;
};

export type ToolConfirmation = {
  title: string;
  description: string;
  confirmLabel: string;
};

export type ToolRunResult = {
  payload: unknown;
  celebration?: "task_completed";
  /**
   * Whether the tool changed server state.
   *
   * The assistant writes through a route handler rather than a server action, so
   * none of Next's automatic refreshing applies and the client has no other way
   * to know a board it is displaying was just rewritten.
   */
  mutated?: boolean;
};

export type AssistantTool = {
  name: string;
  description: string;
  input: z.ZodType<Record<string, unknown>>;
  execute: (
    input: Record<string, unknown>,
    context: ToolContext,
  ) => Promise<ToolRunResult>;
  confirmation?: (input: Record<string, unknown>) => ToolConfirmation;
};

function defineTool<TSchema extends z.ZodType<Record<string, unknown>>>(config: {
  name: string;
  description: string;
  input: TSchema;
  execute: (
    input: z.output<TSchema>,
    context: ToolContext,
  ) => Promise<ToolRunResult>;
  confirmation?: (input: z.output<TSchema>) => ToolConfirmation;
}): AssistantTool {
  return config as unknown as AssistantTool;
}

async function actionResult<T>(
  resultPromise: Promise<ActionResult<T>>,
  options?: { celebration?: "task_completed" },
): Promise<ToolRunResult> {
  const result = await resultPromise;

  if (!result.ok) {
    return {
      payload: {
        ok: false,
        error: result.error,
        code: result.code,
        fieldErrors: result.fieldErrors ?? null,
      },
    };
  }

  // Every mutating tool routes through here and every read tool builds its
  // payload directly, so this is the one place that knows a write happened.
  return {
    payload: { ok: true, data: result.data ?? null },
    mutated: true,
    ...(options?.celebration ? { celebration: options.celebration } : {}),
  };
}

const emptyInput = z.object({});
const idInput = z.object({ id: objectId });
const neighbourInput = idInput.extend({
  beforeId: objectId.nullable(),
  afterId: objectId.nullable(),
});

const tools = [
  defineTool({
    name: "list_workspaces",
    description:
      "List every workspace the signed-in user can access, including member ids. Use this to resolve workspace names before acting.",
    input: emptyInput,
    execute: async (_input, { session }) => ({
      payload: {
        ok: true,
        data: await listWorkspacesForUser(session.user.id),
      },
    }),
  }),
  defineTool({
    name: "inspect_workspace",
    description: "Read one workspace and its members by workspace id.",
    input: idInput,
    execute: async ({ id }, { session }) => {
      await assertWorkspaceMember(id, session.user.id);
      return { payload: { ok: true, data: await getWorkspaceById(id) } };
    },
  }),
  defineTool({
    name: "list_team_members",
    description:
      "List account ids, names, and emails for workspace membership or task assignment. Admin only.",
    input: emptyInput,
    execute: async (_input, { session }) => {
      if (getSessionRole(session) !== "admin") {
        return {
          payload: { ok: false, error: "Only admins can list all accounts." },
        };
      }

      return { payload: { ok: true, data: await listTeamMembers() } };
    },
  }),
  defineTool({
    name: "list_boards",
    description:
      "List boards in a workspace. Use this to resolve board names before acting.",
    input: z.object({
      workspaceId: objectId,
      includeArchived: z.boolean().default(false),
    }),
    execute: async ({ workspaceId, includeArchived }, { session }) => {
      await assertWorkspaceMember(workspaceId, session.user.id);
      return {
        payload: {
          ok: true,
          data: await listBoards(workspaceId, session.user.id, {
            includeArchived,
          }),
        },
      };
    },
  }),
  defineTool({
    name: "inspect_board",
    description:
      "Read a board with its columns, labels, and live tasks. Use before edits, moves, or ambiguous task requests.",
    input: idInput,
    execute: async ({ id }, { session }) => {
      await assertBoardAccess(id, session.user.id);
      return { payload: { ok: true, data: await getBoardSnapshot(id) } };
    },
  }),
  defineTool({
    name: "inspect_task",
    description:
      "Read a task by id, including checklist, subtasks, recurrence, and time entries.",
    input: idInput,
    execute: async ({ id }, { session }) => {
      await assertTaskAccess(id, session.user.id);
      return { payload: { ok: true, data: await getTaskDetail(id) } };
    },
  }),
  defineTool({
    name: "search_tasks",
    description:
      "Search accessible, non-archived tasks by title. Optionally limit the search to one workspace.",
    input: z.object({
      query: z.string().trim().min(1).max(200),
      workspaceId: objectId.nullable().default(null),
    }),
    execute: async ({ query, workspaceId }, { session }) => {
      let boardGroups;

      if (workspaceId) {
        await assertWorkspaceMember(workspaceId, session.user.id);
        boardGroups = [await listBoards(workspaceId, session.user.id)];
      } else {
        const workspaces = await listWorkspacesForUser(session.user.id);
        boardGroups = await Promise.all(
          workspaces.map((workspace) =>
            listBoards(workspace.id, session.user.id),
          ),
        );
      }

      const boardIds = boardGroups.flat().map((board) => board.id);

      return {
        payload: {
          ok: true,
          data: await searchTasks({ query, boardIds }),
        },
      };
    },
  }),
  defineTool({
    name: "create_workspace",
    description: "Create a workspace and make it active. Requires a name.",
    input: z.object({ name: z.string().trim().min(1).max(60) }),
    execute: ({ name }) => actionResult(createWorkspaceAction({ name })),
  }),
  defineTool({
    name: "rename_workspace",
    description: "Rename a workspace. Admin only.",
    input: z.object({ id: objectId, name: z.string().trim().min(1).max(60) }),
    execute: ({ id, name }) => actionResult(updateWorkspaceAction({ id, name })),
  }),
  defineTool({
    name: "switch_workspace",
    description: "Make an accessible workspace active for the signed-in user.",
    input: idInput,
    execute: ({ id }) => actionResult(setActiveWorkspaceAction({ id })),
  }),
  defineTool({
    name: "set_workspace_members",
    description:
      "Replace the workspace member list with the supplied account ids. The current admin remains a member. Admin only.",
    input: z.object({ id: objectId, memberIds: z.array(objectId).max(200) }),
    confirmation: () => ({
      title: "Change workspace membership?",
      description:
        "This can immediately grant or remove access to every board in the workspace.",
      confirmLabel: "Hold to update members",
    }),
    execute: ({ id, memberIds }) =>
      actionResult(setWorkspaceMembersAction({ id, memberIds })),
  }),
  defineTool({
    name: "delete_workspace",
    description:
      "Permanently delete a workspace and everything inside it. Admin only and always requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Permanently delete workspace?",
      description:
        "Every board, task, comment, attachment, checklist, and time entry in it will be deleted.",
      confirmLabel: "Hold to delete workspace",
    }),
    execute: async ({ id }) => {
      const workspace = await getWorkspaceById(id);
      return actionResult(
        deleteWorkspaceAction({ id, confirmation: workspace.name }),
      );
    },
  }),
  defineTool({
    name: "create_board",
    description:
      "Create a board with its standard columns. Name and workspace id are required; icon and color have safe defaults.",
    input: z.object({
      workspaceId: objectId,
      name: z.string().trim().min(1).max(60),
      description: z.string().trim().max(400).optional(),
      icon: z.enum(BOARD_ICONS).default(DEFAULT_BOARD_ICON),
      color: z.enum(LABEL_COLORS).default(DEFAULT_LABEL_COLOR),
    }),
    execute: (input) => actionResult(createBoardAction(input)),
  }),
  defineTool({
    name: "update_board",
    description:
      "Patch a board's name, description, icon, or color. Read the board first when the target is not explicit.",
    input: z.object({
      id: objectId,
      name: z.string().trim().min(1).max(60).optional(),
      description: z.string().trim().max(400).nullable().optional(),
      icon: z.enum(BOARD_ICONS).optional(),
      color: z.enum(LABEL_COLORS).optional(),
    }),
    execute: async ({ id, ...patch }) => {
      const board = await getBoardById(id);
      return actionResult(
        updateBoardAction({
          id,
          name: patch.name ?? board.name,
          description:
            patch.description === null
              ? ""
              : (patch.description ?? board.description ?? ""),
          icon: patch.icon ?? board.icon,
          color: patch.color ?? board.color,
        }),
      );
    },
  }),
  defineTool({
    name: "set_board_permissions",
    description:
      "Set who may see and edit a board. Admin only. accessMode: 'workspace' — every workspace member sees and edits it; 'restricted' — everyone sees it, only editorIds edit it; 'private' — only editorIds see it at all, and they may edit it. Administrators keep both under every mode. Use 'private' when asked to limit a board to specific people or one team.",
    input: z.object({
      id: objectId,
      accessMode: z.enum(BOARD_ACCESS_MODES),
      editorIds: z.array(objectId).max(500),
    }),
    confirmation: (input) => ({
      title: "Change board permissions?",
      description:
        input.accessMode === "private"
          ? "This hides the board from everyone except the selected people and administrators."
          : "This can immediately grant or remove board editing access.",
      confirmLabel: "Hold to update access",
    }),
    execute: (input) => actionResult(setBoardPermissionsAction(input)),
  }),
  defineTool({
    name: "set_board_archived",
    description: "Archive or restore a board to the requested state. Admin only.",
    input: z.object({ id: objectId, archived: z.boolean() }),
    execute: async ({ id, archived }) => {
      const board = await getBoardById(id);
      return board.archivedAt !== null === archived
        ? { payload: { ok: true, data: board, unchanged: true } }
        : actionResult(setBoardArchivedAction({ id }));
    },
  }),
  defineTool({
    name: "delete_board",
    description:
      "Permanently delete a board and everything inside it. Admin only and always requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Permanently delete board?",
      description:
        "Its columns, tasks, comments, attachments, checklists, and time entries will be deleted.",
      confirmLabel: "Hold to delete board",
    }),
    execute: ({ id }) => actionResult(deleteBoardAction({ id })),
  }),
  defineTool({
    name: "move_board",
    description:
      "Reorder a board between neighbour board ids. Use null at either edge. Admin only.",
    input: neighbourInput,
    execute: (input) => actionResult(moveBoardAction(input)),
  }),
  defineTool({
    name: "create_column",
    description: "Create a column on a board.",
    input: z.object({
      boardId: objectId,
      name: z.string().trim().min(1).max(40),
      isTerminal: z.boolean().default(false),
    }),
    execute: (input) => actionResult(createListAction(input)),
  }),
  defineTool({
    name: "update_column",
    description: "Patch a column name or whether it is the Done column.",
    input: z.object({
      id: objectId,
      boardId: objectId,
      name: z.string().trim().min(1).max(40).optional(),
      isTerminal: z.boolean().optional(),
    }),
    execute: async ({ id, boardId, ...patch }) => {
      const snapshot = await getBoardSnapshot(boardId);
      const column = snapshot.lists.find((item) => item.id === id);

      if (!column) {
        return { payload: { ok: false, error: "Column not found on that board." } };
      }

      return actionResult(
        updateListAction({
          id,
          name: patch.name ?? column.name,
          isTerminal: patch.isTerminal ?? column.isTerminal,
        }),
      );
    },
  }),
  defineTool({
    name: "delete_column",
    description:
      "Delete an empty column. Refuses when tasks remain and always requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Delete column?",
      description: "The column must be empty. This action cannot be undone.",
      confirmLabel: "Hold to delete column",
    }),
    execute: ({ id }) => actionResult(deleteListAction({ id })),
  }),
  defineTool({
    name: "move_column",
    description: "Reorder a column between neighbour column ids. Use null at either edge.",
    input: neighbourInput,
    execute: (input) => actionResult(moveListAction(input)),
  }),
  defineTool({
    name: "create_label",
    description: "Create a label on a board.",
    input: z.object({
      boardId: objectId,
      name: z.string().trim().min(1).max(32),
      color: z.enum(LABEL_COLORS).default(DEFAULT_LABEL_COLOR),
    }),
    execute: (input) => actionResult(createLabelAction(input)),
  }),
  defineTool({
    name: "update_label",
    description: "Patch a board label's name or color.",
    input: z.object({
      id: objectId,
      boardId: objectId,
      name: z.string().trim().min(1).max(32).optional(),
      color: z.enum(LABEL_COLORS).optional(),
    }),
    execute: async ({ id, boardId, ...patch }) => {
      const snapshot = await getBoardSnapshot(boardId);
      const label = snapshot.labels.find((item) => item.id === id);

      if (!label) {
        return { payload: { ok: false, error: "Label not found on that board." } };
      }

      return actionResult(
        updateLabelAction({
          id,
          name: patch.name ?? label.name,
          color: patch.color ?? label.color,
        }),
      );
    },
  }),
  defineTool({
    name: "delete_label",
    description: "Delete a label and remove it from tasks. Requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Delete label?",
      description: "The label will be removed from every task using it.",
      confirmLabel: "Hold to delete label",
    }),
    execute: ({ id }) => actionResult(deleteLabelAction({ id })),
  }),
  defineTool({
    name: "create_task",
    description:
      "Create a task or subtask. Only title and board id are required; omitted fields keep normal app defaults.",
    input: z.object({
      boardId: objectId,
      title: z.string().trim().min(1).max(200),
      listId: objectId.optional(),
      parentId: objectId.optional(),
      description: z.string().trim().max(20_000).nullable().optional(),
      priority: z.enum(TASK_PRIORITIES).optional(),
      assigneeId: objectId.nullable().optional(),
      startDate: z.iso.datetime().nullable().optional(),
      dueDate: z.iso.datetime().nullable().optional(),
      labelIds: z.array(objectId).max(40).optional(),
      estimateMinutes: z.number().int().min(0).max(525_600).nullable().optional(),
    }),
    execute: ({ startDate, dueDate, ...input }) =>
      actionResult(
        createTaskAction({
          ...input,
          ...(startDate !== undefined
            ? { startDate: startDate ? new Date(startDate) : null }
            : {}),
          ...(dueDate !== undefined
            ? { dueDate: dueDate ? new Date(dueDate) : null }
            : {}),
        }),
      ),
  }),
  defineTool({
    name: "update_task",
    description: "Patch one or more task fields. Omitted fields remain unchanged.",
    input: z.object({
      id: objectId,
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(20_000).nullable().optional(),
      priority: z.enum(TASK_PRIORITIES).optional(),
      assigneeId: objectId.nullable().optional(),
      startDate: z.iso.datetime().nullable().optional(),
      dueDate: z.iso.datetime().nullable().optional(),
      labelIds: z.array(objectId).max(40).optional(),
      estimateMinutes: z.number().int().min(0).max(525_600).nullable().optional(),
    }),
    execute: ({ startDate, dueDate, ...input }) =>
      actionResult(
        updateTaskAction({
          ...input,
          ...(startDate !== undefined
            ? { startDate: startDate ? new Date(startDate) : null }
            : {}),
          ...(dueDate !== undefined
            ? { dueDate: dueDate ? new Date(dueDate) : null }
            : {}),
        }),
      ),
  }),
  defineTool({
    name: "move_task",
    description:
      "Move a task to a column and between neighbour task ids. Moving into Done completes it.",
    input: z.object({
      id: objectId,
      listId: objectId,
      beforeId: objectId.nullable(),
      afterId: objectId.nullable(),
    }),
    execute: async (input) => {
      const before = await getTaskDetail(input.id);
      const result = await actionResult(moveTaskAction(input));
      const data = (result.payload as { data?: { completedAt?: string | null } }).data;
      return {
        ...result,
        ...(!before.completedAt && data?.completedAt
          ? { celebration: "task_completed" as const }
          : {}),
      };
    },
  }),
  defineTool({
    name: "set_task_complete",
    description: "Mark a task complete or reopen it.",
    input: z.object({ id: objectId, isComplete: z.boolean() }),
    execute: async ({ id, isComplete }) => {
      const before = await getTaskDetail(id);
      return actionResult(setTaskCompleteAction({ id, isComplete }), {
        ...(!before.completedAt && isComplete
          ? { celebration: "task_completed" as const }
          : {}),
      });
    },
  }),
  defineTool({
    name: "set_task_archived",
    description: "Archive or restore a task to the requested state.",
    input: z.object({ id: objectId, archived: z.boolean() }),
    execute: async ({ id, archived }) => {
      const task = await getTaskDetail(id);
      return task.archivedAt !== null === archived
        ? { payload: { ok: true, data: task, unchanged: true } }
        : actionResult(setTaskArchivedAction({ id }));
    },
  }),
  defineTool({
    name: "set_task_recurrence",
    description: "Set or remove a task recurrence rule.",
    input: z.object({
      id: objectId,
      recurrence: z
        .object({
          frequency: z.enum(RECURRENCE_FREQUENCIES),
          interval: z.number().int().min(1).max(365),
          weekdays: z.array(z.number().int().min(0).max(6)).max(7),
          dayOfMonth: z.number().int().min(1).max(31).nullable(),
          endsAt: z.iso.datetime().nullable(),
        })
        .nullable(),
    }),
    execute: ({ id, recurrence }) =>
      actionResult(
        setTaskRecurrenceAction({
          id,
          recurrence: recurrence
            ? {
                ...recurrence,
                endsAt: recurrence.endsAt ? new Date(recurrence.endsAt) : null,
              }
            : null,
        }),
      ),
  }),
  defineTool({
    name: "delete_task",
    description: "Permanently delete a task. Admin only and requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Permanently delete task?",
      description: "Its comments, files, checklist, subtasks, and time log will be deleted.",
      confirmLabel: "Hold to delete task",
    }),
    execute: ({ id }) => actionResult(deleteTaskAction({ id })),
  }),
  defineTool({
    name: "add_checklist_item",
    description: "Add a checklist item to a task.",
    input: z.object({ taskId: objectId, title: z.string().trim().min(1).max(200) }),
    execute: (input) => actionResult(addChecklistItemAction(input)),
  }),
  defineTool({
    name: "update_checklist_item",
    description: "Rename or check/uncheck one checklist item.",
    input: z.object({
      taskId: objectId,
      itemId: objectId,
      title: z.string().trim().min(1).max(200).optional(),
      done: z.boolean().optional(),
    }),
    execute: (input) => actionResult(updateChecklistItemAction(input)),
  }),
  defineTool({
    name: "remove_checklist_item",
    description: "Remove a checklist item. Requires confirmation.",
    input: z.object({ taskId: objectId, itemId: objectId }),
    confirmation: () => ({
      title: "Remove checklist item?",
      description: "The checklist item will be permanently removed.",
      confirmLabel: "Hold to remove item",
    }),
    execute: (input) => actionResult(removeChecklistItemAction(input)),
  }),
  defineTool({
    name: "add_comment",
    description: "Add a comment to a task as the signed-in user.",
    input: z.object({ taskId: objectId, body: z.string().trim().min(1).max(5_000) }),
    execute: (input) => actionResult(createCommentAction(input)),
  }),
  defineTool({
    name: "delete_comment",
    description: "Delete an allowed comment. Requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Delete comment?",
      description: "The comment will be permanently deleted.",
      confirmLabel: "Hold to delete comment",
    }),
    execute: ({ id }) => actionResult(deleteCommentAction({ id })),
  }),
  defineTool({
    name: "log_time",
    description: "Log minutes against a task with an optional note.",
    input: z.object({
      taskId: objectId,
      minutes: z.number().int().min(1).max(525_600),
      note: z.string().trim().max(200).optional(),
    }),
    execute: (input) => actionResult(logTimeAction(input)),
  }),
  defineTool({
    name: "remove_time_entry",
    description: "Remove a time entry from a task. Requires confirmation.",
    input: z.object({ taskId: objectId, entryId: objectId }),
    confirmation: () => ({
      title: "Remove time entry?",
      description: "The logged time entry will be permanently removed.",
      confirmLabel: "Hold to remove time",
    }),
    execute: (input) => actionResult(removeTimeEntryAction(input)),
  }),
  defineTool({
    name: "start_timer",
    description: "Start the signed-in user's timer on a task.",
    input: idInput,
    execute: ({ id }) => actionResult(startTimerAction({ id })),
  }),
  defineTool({
    name: "stop_timer",
    description: "Stop the running timer on a task and save the time entry.",
    input: idInput,
    execute: ({ id }) => actionResult(stopTimerAction({ id })),
  }),
  defineTool({
    name: "delete_attachment",
    description: "Delete an allowed task attachment. Requires confirmation.",
    input: idInput,
    confirmation: () => ({
      title: "Delete attachment?",
      description: "The stored file will be permanently deleted.",
      confirmLabel: "Hold to delete file",
    }),
    execute: ({ id }) => actionResult(deleteAttachmentAction({ id })),
  }),
] satisfies AssistantTool[];

export const assistantTools = new Map(tools.map((tool) => [tool.name, tool]));

export const openRouterTools = tools.map((tool) => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.input, { target: "draft-07" }),
  },
}));
