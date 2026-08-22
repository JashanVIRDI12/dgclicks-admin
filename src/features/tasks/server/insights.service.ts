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
  /**
   * What this person finished, this week and last.
   *
   * Counts rather than lists, and scoped to them rather than the workspace:
   * the dashboard's job is to tell an employee how their own week is going, and
   * a team-wide throughput number on a personal screen is a metric about
   * somebody else. Last week is carried purely so this week has something
   * honest to be compared against — "7" means nothing on its own.
   */
  completedThisWeek: number;
  completedLastWeek: number;
};

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.map((id) => new Types.ObjectId(id));
}

/**
 * The five panels on the dashboard, in five queries rather than one big read
 * filtered in memory.
 *
 * Each has a different sort and a different limit, and every one of them is
 * served by the `{ assignees, completedAt, dueDate }` or `{ board, dueDate }`
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
      completedThisWeek: 0,
      completedLastWeek: 0,
    };
  }

  const now = new Date();
  const boards = { $in: toObjectIds(options.boardIds) };
  const live = { board: boards, parent: null, archivedAt: null };
  const open = { ...live, completedAt: null };

  /**
   * Open work that belongs to *this person*.
   *
   * The overdue, due-today and upcoming panels used to filter on boards alone,
   * so a dashboard headed "1 thing needs your attention" was counting the whole
   * workspace's late work — and contradicting the "Assigned to you" panel
   * directly below it, which was the only one scoped correctly.
   *
   * A personal home screen has to mean one thing by "you" everywhere on it. The
   * workspace-wide view of the same question is what Reports and the board
   * filters are for.
   */
  const mine = { ...open, assignees: options.userId };

  // Weeks run Monday to Monday. `addDays(now, -7)` would slide the boundary
  // every day and make "this week" mean "the last seven days", which is a
  // different — and much less motivating — number on a Tuesday morning.
  const weekStart = startOfDay(addDays(now, -((now.getDay() + 6) % 7)));
  const lastWeekStart = addDays(weekStart, -7);

  const [
    dueToday,
    overdue,
    upcoming,
    assignedToMe,
    recentlyUpdated,
    completedThisWeek,
    completedLastWeek,
  ] = await Promise.all([
      TaskModel.find({
        ...mine,
        dueDate: { $gte: startOfDay(now), $lte: endOfDay(now) },
      })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find({ ...mine, dueDate: { $lt: startOfDay(now) } })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find({
        ...mine,
        dueDate: {
          $gt: endOfDay(now),
          $lte: endOfDay(addDays(now, UPCOMING_DAYS)),
        },
      })
        .populate(TASK_POPULATE)
        .sort({ dueDate: 1 })
        .limit(PANEL_LIMIT)
        .lean<TaskDoc[]>(),

      TaskModel.find(mine)
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

    /*
      Note what is missing: `archivedAt`. Finished work is archived a day
      later, so counting only unarchived tasks would make this number climb
      through the day and then fall overnight as the sweep removed its own
      evidence. Completion is a fact about a task; whether it is still on the
      board is a fact about the board.
    */
    TaskModel.countDocuments({
      board: boards,
      parent: null,
      assignees: options.userId,
      completedAt: { $gte: weekStart },
    }),

    TaskModel.countDocuments({
      board: boards,
      parent: null,
      assignees: options.userId,
      completedAt: { $gte: lastWeekStart, $lt: weekStart },
    }),
  ]);

  return {
    dueToday: dueToday.map(toTask),
    overdue: overdue.map(toTask),
    upcoming: upcoming.map(toTask),
    assignedToMe: sortUndatedLast(assignedToMe.map(toTask)),
    recentlyUpdated: recentlyUpdated.map(toTask),
    completedThisWeek,
    completedLastWeek,
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
  // "Open" and "overdue" describe work still on the board, so they exclude
  // anything archived. "Completed" describes something that happened, so it
  // does not — see the note on `match`.
  const isLive = { $eq: ["$archivedAt", null] };

  return {
    open: {
      $sum: {
        $cond: [
          { $and: [{ $eq: ["$completedAt", null] }, isLive] },
          1,
          0,
        ],
      },
    },
    completed: { $sum: { $cond: [{ $ne: ["$completedAt", null] }, 1, 0] } },
    overdue: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ["$completedAt", null] },
              isLive,
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
  /*
    Archived tasks are included. They are almost all *completed* tasks the
    24-hour sweep tidied off the board, and excluding them would make a report
    about throughput lose a day's work every day. `countStages` does the
    filtering instead, per column: "open" and "overdue" require
    `archivedAt: null`, "completed" does not.
  */
  const match = { board: { $in: boardIds }, parent: null };
  const counts = countStages(now);

  const [byBoardRows, byAssigneeRows, dueThisWeek, completions] =
    await Promise.all([
      TaskModel.aggregate<CountRow>([
        { $match: match },
        { $group: { _id: "$board", ...counts } },
      ]),

      TaskModel.aggregate<CountRow>([
        { $match: match },
        // Unwound so a task with three owners lands once in each of their
        // totals. Grouping on the raw array would key by the whole list and
        // report "these three people" as a fourth, imaginary person.
        { $unwind: "$assignees" },
        { $group: { _id: "$assignees", ...counts } },
      ]),

      // Upcoming work, so this one *does* want only what is still on a board.
      TaskModel.countDocuments({
        ...match,
        archivedAt: null,
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
