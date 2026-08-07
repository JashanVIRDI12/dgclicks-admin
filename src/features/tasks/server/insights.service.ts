import "server-only";

import { addDays, endOfDay, startOfDay, subDays } from "date-fns";
import { Types } from "mongoose";

import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from "@/features/auth/server/serialize";
import { UserModel, type UserDoc } from "@/features/auth/server/user.model";
import type { UserSummary } from "@/features/auth/types";
import type { BoardIcon, LabelColor } from "@/features/tasks/constants";
import { TaskModel, type TaskDoc } from "@/features/tasks/server/models";
import { TASK_POPULATE } from "@/features/tasks/server/populate";
import { toTask } from "@/features/tasks/server/serialize";
import type { Board, Task } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";

/** How far ahead "upcoming" looks. A fortnight is the horizon people plan on. */
const UPCOMING_DAYS = 14;
const PANEL_LIMIT = 8;
const THROUGHPUT_DAYS = 14;

export type DashboardData = {
  dueToday: Task[];
  overdue: Task[];
  upcoming: Task[];
  assignedToMe: Task[];
  recentlyUpdated: Task[];
};

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.map((id) => new Types.ObjectId(id));
}

/**
 * The five panels on the dashboard, in five queries rather than one big read
 * filtered in memory.
 *
 * Each has a different sort and a different limit, and every one of them is
 * served by the `{ assignee, completedAt, dueDate }` or `{ board, dueDate }`
 * index — pulling the whole workspace back to slice it locally would get slower
 * exactly as the workspace got busier.
 */
export async function getDashboardData(options: {
  userId: string;
  boardIds: readonly string[];
}): Promise<DashboardData> {
  await connectToDatabase();

  if (options.boardIds.length === 0) {
    return {
      dueToday: [],
      overdue: [],
      upcoming: [],
      assignedToMe: [],
      recentlyUpdated: [],
    };
  }

  const now = new Date();
  const boards = { $in: toObjectIds(options.boardIds) };
  const live = { board: boards, parent: null, archivedAt: null };
  const open = { ...live, completedAt: null };

  const [dueToday, overdue, upcoming, assignedToMe, recentlyUpdated] =
    await Promise.all([
      TaskModel.find({
        ...open,
        dueDate: { $gte: startOfDay(now), $lte: endOfDay(now) },
      })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find({ ...open, dueDate: { $lt: startOfDay(now) } })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find({
        ...open,
        dueDate: {
          $gt: endOfDay(now),
          $lte: endOfDay(addDays(now, UPCOMING_DAYS)),
        },
      })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find({ ...open, assignee: options.userId })
        .populate(TASK_POPULATE)
        // Undated work sorts last: `dueDate: 1` puts nulls first in MongoDB, so
        // the presence of a date is the primary key.
        .sort({ dueDate: 1, updatedAt: -1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find(live)
        .populate(TASK_POPULATE)
        .sort({ updatedAt: -1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),
    ]);

  return {
    dueToday: dueToday.map(toTask),
    overdue: overdue.map(toTask),
    upcoming: upcoming.map(toTask),
    assignedToMe: sortUndatedLast(assignedToMe.map(toTask)),
    recentlyUpdated: recentlyUpdated.map(toTask),
  };
}

/** MongoDB sorts null before every date; a task with no deadline belongs last. */
function sortUndatedLast(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueDate === b.dueDate) {
      return 0;
    }

    if (a.dueDate === null) {
      return 1;
    }

    if (b.dueDate === null) {
      return -1;
    }

    return a.dueDate.localeCompare(b.dueDate);
  });
}

export type ReportTotals = {
  open: number;
  completed: number;
  overdue: number;
  dueThisWeek: number;
};

export type BoardBreakdown = {
  boardId: string;
  name: string;
  icon: BoardIcon;
  color: LabelColor;
  open: number;
  completed: number;
  overdue: number;
};

export type AssigneeBreakdown = {
  user: UserSummary | null;
  open: number;
  completed: number;
  overdue: number;
};

export type WorkspaceReport = {
  totals: ReportTotals;
  /** Completions per day for the last fortnight, oldest first. */
  throughput: { date: string; count: number }[];
  byBoard: BoardBreakdown[];
  byAssignee: AssigneeBreakdown[];
};

type CountRow = {
  _id: Types.ObjectId | null;
  open: number;
  completed: number;
  overdue: number;
};

/**
 * Counting expressions shared by the per-board and per-person aggregations, so
 * the two can never disagree about what "overdue" means.
 */
function countStages(now: Date) {
  return {
    open: { $sum: { $cond: [{ $eq: ["$completedAt", null] }, 1, 0] } },
    completed: { $sum: { $cond: [{ $ne: ["$completedAt", null] }, 1, 0] } },
    overdue: {
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
  };
}

export async function getWorkspaceReport(options: {
  boards: readonly Board[];
}): Promise<WorkspaceReport> {
  await connectToDatabase();

  const empty: WorkspaceReport = {
    totals: { open: 0, completed: 0, overdue: 0, dueThisWeek: 0 },
    throughput: [],
    byBoard: [],
    byAssignee: [],
  };

  if (options.boards.length === 0) {
    return empty;
  }

  const now = new Date();
  const boardIds = toObjectIds(options.boards.map((board) => board.id));
  const match = { board: { $in: boardIds }, parent: null, archivedAt: null };
  const counts = countStages(now);

  const [byBoardRows, byAssigneeRows, dueThisWeek, completions] =
    await Promise.all([
      TaskModel.aggregate<CountRow>([
        { $match: match },
        { $group: { _id: "$board", ...counts } },
      ]),

      TaskModel.aggregate<CountRow>([
        { $match: match },
        { $group: { _id: "$assignee", ...counts } },
      ]),

      TaskModel.countDocuments({
        ...match,
        completedAt: null,
        dueDate: { $gte: startOfDay(now), $lte: endOfDay(addDays(now, 7)) },
      }),

      TaskModel.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            ...match,
            completedAt: { $gte: startOfDay(subDays(now, THROUGHPUT_DAYS - 1)) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$completedAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const boardCounts = new Map(
    byBoardRows.map((row) => [row._id?.toString() ?? "", row]),
  );

  const byBoard = options.boards.map((board) => {
    const row = boardCounts.get(board.id);

    return {
      boardId: board.id,
      name: board.name,
      icon: board.icon,
      color: board.color,
      open: row?.open ?? 0,
      completed: row?.completed ?? 0,
      overdue: row?.overdue ?? 0,
    };
  });

  // Assignee ids come back raw from `$group`, so resolve them in one query
  // rather than one per row.
  const assigneeIds = byAssigneeRows
    .map((row) => row._id)
    .filter((id): id is Types.ObjectId => id !== null);

  const people = await UserModel.find({ _id: { $in: assigneeIds } })
    .select(USER_SUMMARY_SELECT)
    .lean<UserDoc[]>();

  const peopleById = new Map(
    people.map((person) => [
      person._id.toString(),
      toUserSummary(person as Parameters<typeof toUserSummary>[0]),
    ]),
  );

  const byAssignee = byAssigneeRows
    .map((row) => ({
      user: row._id ? (peopleById.get(row._id.toString()) ?? null) : null,
      open: row.open,
      completed: row.completed,
      overdue: row.overdue,
    }))
    .sort((a, b) => b.open + b.overdue - (a.open + a.overdue));

  const completionsByDay = new Map(
    completions.map((row) => [row._id, row.count]),
  );

  const throughput = Array.from({ length: THROUGHPUT_DAYS }, (_, index) => {
    const date = subDays(now, THROUGHPUT_DAYS - 1 - index);
    const key = date.toISOString().slice(0, 10);

    return { date: key, count: completionsByDay.get(key) ?? 0 };
  });

  return {
    totals: {
      open: byBoard.reduce((total, row) => total + row.open, 0),
      completed: byBoard.reduce((total, row) => total + row.completed, 0),
      overdue: byBoard.reduce((total, row) => total + row.overdue, 0),
      dueThisWeek,
    },
    throughput,
    byBoard,
    byAssignee,
  };
}
