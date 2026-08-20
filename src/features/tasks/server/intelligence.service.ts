import "server-only";

import { Types } from "mongoose";

import { TaskModel, ListModel, type ListDoc } from "@/features/tasks/server/models";
import type { Board } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";

/**
 * Signals about a workspace, computed rather than inferred.
 *
 * The point of this module is that the model never gets to decide what "stalled"
 * or "overloaded" means. An LLM asked to look at a board will happily produce a
 * confident paragraph about momentum from nothing at all, and a wrong insight is
 * worse than no insight — people act on it. So every number below is counted in
 * code from the database, and the assistant's job is to phrase what it is given,
 * not to detect it.
 *
 * Each threshold is a product decision, written down here rather than buried in
 * a prompt where nobody can find or change it.
 */

/** Untouched this long, while still open, counts as stalled. */
const STALL_DAYS = 7;
/** A board nobody has touched this long has gone quiet. */
const QUIET_BOARD_DAYS = 14;
/** Deadlines inside this window are "approaching". */
const SOON_DAYS = 3;
/**
 * One person holding more than this share of the open work is flagged.
 * A ratio, not a count: five tasks is a lot in a workspace of eight and
 * nothing in a workspace of two hundred.
 */
const OVERLOAD_SHARE = 0.4;
/** Bounds the single read. Past this the signals are indicative, not exact. */
const SCAN_LIMIT = 500;

export type WorkspaceSignals = {
  scanned: number;
  truncated: boolean;
  overdue: number;
  dueSoon: number;
  unassigned: { count: number; urgent: number };
  stalled: { count: number; examples: string[] };
  quietBoards: string[];
  workload: { name: string; open: number }[];
  overloaded: string | null;
  urgentUnassigned: string[];
};

type ScanTask = {
  board: Types.ObjectId;
  list: Types.ObjectId;
  title: string;
  priority: string;
  assignee?: Types.ObjectId | null;
  dueDate?: Date | null;
  updatedAt: Date;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * One read of the open work, then everything computed in memory.
 *
 * A query per signal would be eight round trips for a screen that is glanced at;
 * the open tasks of one workspace are small enough to scan locally, and doing so
 * keeps every threshold above in one place instead of scattered across eight
 * filters that could drift apart.
 */
export async function getWorkspaceSignals(
  boards: Board[],
  members: { id: string; name: string }[],
): Promise<WorkspaceSignals> {
  await connectToDatabase();

  const empty: WorkspaceSignals = {
    scanned: 0,
    truncated: false,
    overdue: 0,
    dueSoon: 0,
    unassigned: { count: 0, urgent: 0 },
    stalled: { count: 0, examples: [] },
    quietBoards: [],
    workload: [],
    overloaded: null,
    urgentUnassigned: [],
  };

  if (boards.length === 0) {
    return empty;
  }

  const boardIds = boards.map((board) => new Types.ObjectId(board.id));

  const [tasks, lists] = await Promise.all([
    TaskModel.find({
      board: { $in: boardIds },
      parent: null,
      archivedAt: null,
      completedAt: null,
    })
      .select("board list title priority assignee dueDate updatedAt")
      .limit(SCAN_LIMIT)
      .lean<ScanTask[]>(),

    ListModel.find({ board: { $in: boardIds } })
      .select("_id board isTerminal")
      .lean<ListDoc[]>(),
  ]);

  // Cards parked in a Done column are finished in every sense the board cares
  // about; counting them as stalled would flag the tidiest columns hardest.
  const terminalLists = new Set(
    lists
      .filter((list) => list.isTerminal)
      .map((list) => list._id.toString()),
  );

  const memberNames = new Map(members.map((member) => [member.id, member.name]));

  const now = new Date();
  const stallCutoff = daysAgo(STALL_DAYS);
  const quietCutoff = daysAgo(QUIET_BOARD_DAYS);
  const soonCutoff = new Date(Date.now() + SOON_DAYS * 24 * 60 * 60 * 1000);

  const signals: WorkspaceSignals = { ...empty, scanned: tasks.length };
  signals.truncated = tasks.length === SCAN_LIMIT;

  const openByPerson = new Map<string, number>();
  const lastTouchedByBoard = new Map<string, Date>();
  const stalledExamples: string[] = [];

  for (const task of tasks) {
    const boardId = task.board.toString();
    const isTerminal = terminalLists.has(task.list.toString());

    const seen = lastTouchedByBoard.get(boardId);
    if (!seen || task.updatedAt > seen) {
      lastTouchedByBoard.set(boardId, task.updatedAt);
    }

    if (task.dueDate) {
      if (task.dueDate < now) {
        signals.overdue += 1;
      } else if (task.dueDate <= soonCutoff) {
        signals.dueSoon += 1;
      }
    }

    if (!task.assignee) {
      signals.unassigned.count += 1;

      if (task.priority === "urgent" || task.priority === "high") {
        signals.unassigned.urgent += 1;

        if (signals.urgentUnassigned.length < 5) {
          signals.urgentUnassigned.push(task.title);
        }
      }
    } else {
      const key = task.assignee.toString();
      openByPerson.set(key, (openByPerson.get(key) ?? 0) + 1);
    }

    if (!isTerminal && task.updatedAt < stallCutoff) {
      signals.stalled.count += 1;

      if (stalledExamples.length < 5) {
        stalledExamples.push(task.title);
      }
    }
  }

  signals.stalled.examples = stalledExamples;

  signals.quietBoards = boards
    .filter((board) => {
      const touched = lastTouchedByBoard.get(board.id);
      // A board with no open work at all is finished, not quiet.
      return touched !== undefined && touched < quietCutoff;
    })
    .map((board) => board.name);

  signals.workload = [...openByPerson.entries()]
    .map(([userId, open]) => ({
      name: memberNames.get(userId) ?? "Someone no longer in the workspace",
      open,
    }))
    .sort((a, b) => b.open - a.open);

  const assignedTotal = [...openByPerson.values()].reduce(
    (total, count) => total + count,
    0,
  );
  const top = signals.workload[0];

  if (top && assignedTotal > 0 && members.length > 1) {
    // Needs both a share and an absolute floor: holding 100% of two tasks is
    // not overload, it is a quiet week.
    const share = top.open / assignedTotal;

    if (share >= OVERLOAD_SHARE && top.open >= 5) {
      signals.overloaded = top.name;
    }
  }

  return signals;
}
