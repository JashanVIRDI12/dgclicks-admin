import "server-only";

import { Types } from "mongoose";

import type { RecurrenceFrequency } from "@/features/tasks/constants";
import { positionAfter } from "@/features/tasks/position";
import {
  hasRecurrenceEnded,
  nextOccurrence,
  nextOccurrenceAfter,
  type RecurrenceInput,
} from "@/features/tasks/recurrence";
import {
  ListModel,
  TaskModel,
  type ListDoc,
  type TaskDoc,
} from "@/features/tasks/server/models";
import { getTaskById } from "@/features/tasks/server/task.service";
import type { Task } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import { NotFoundError } from "@/lib/errors";

type StoredRecurrence = {
  frequency: string;
  interval: number;
  weekdays?: number[];
  dayOfMonth?: number | null;
  endsAt?: Date | null;
  nextOccurrenceAt: Date;
  lastSpawnedAt?: Date | null;
};

function toRuleInput(stored: StoredRecurrence): RecurrenceInput {
  return {
    frequency: stored.frequency as RecurrenceFrequency,
    interval: stored.interval,
    weekdays: stored.weekdays ?? [],
    dayOfMonth: stored.dayOfMonth ?? null,
    endsAt: stored.endsAt ?? null,
  };
}

/**
 * Attaches or removes a repeat rule.
 *
 * The first occurrence is anchored to the task's own due date when it has one,
 * so "monthly" on a task due the 3rd means the 3rd — not the day the rule
 * happened to be created.
 */
export async function setTaskRecurrence(
  taskId: string,
  rule: RecurrenceInput | null,
): Promise<Task> {
  await connectToDatabase();

  if (!rule) {
    await TaskModel.findByIdAndUpdate(taskId, { recurrence: null });
    return getTaskById(taskId);
  }

  const task = await TaskModel.findById(taskId)
    .select("dueDate")
    .lean<{ dueDate: Date | null }>();

  if (!task) {
    throw new NotFoundError("That task no longer exists.");
  }

  const anchor = task.dueDate ?? new Date();

  await TaskModel.findByIdAndUpdate(taskId, {
    recurrence: {
      frequency: rule.frequency,
      interval: rule.interval,
      weekdays: rule.weekdays,
      dayOfMonth: rule.dayOfMonth,
      endsAt: rule.endsAt ? new Date(rule.endsAt) : null,
      nextOccurrenceAt: nextOccurrence(rule, anchor),
      lastSpawnedAt: null,
    },
  });

  return getTaskById(taskId);
}

/**
 * Writes the next occurrence of a task that carries a rule.
 *
 * The rule *moves* to the clone rather than being copied: the completed task
 * keeps its history and stops repeating, and exactly one task in the chain is
 * ever the live one. Copying it instead is how a monthly report ends up
 * spawning from every occurrence that has ever existed.
 *
 * The checklist comes across unticked, because next month's report has not been
 * written yet. Comments, attachments and the time log stay behind — they belong
 * to the occurrence they were recorded against.
 */
async function writeNextOccurrence(
  source: TaskDoc,
  rule: StoredRecurrence,
): Promise<void> {
  const ruleInput = toRuleInput(rule);
  const dueDate = rule.nextOccurrenceAt;

  // Past its end date: the claim already removed the rule, which is exactly
  // what stopping means.
  if (hasRecurrenceEnded(ruleInput, dueDate)) {
    return;
  }

  // Land in the first non-terminal column: the next occurrence has not been
  // done, so dropping it into Done would complete it on arrival.
  const lists = await ListModel.find({ board: source.board })
    .sort({ position: 1 })
    .lean<ListDoc[]>();

  const destination = lists.find((list) => !list.isTerminal) ?? lists[0];

  if (!destination) {
    return;
  }

  const last = await TaskModel.findOne({
    list: destination._id,
    parent: null,
  })
    .sort({ position: -1 })
    .select("position")
    .lean<{ position: number }>();

  const shift =
    source.dueDate && source.startDate
      ? dueDate.getTime() - source.dueDate.getTime()
      : null;

  await TaskModel.create({
    board: source.board,
    list: destination._id,
    parent: null,
    title: source.title,
    description: source.description ?? null,
    position: positionAfter(last?.position ?? null),
    priority: source.priority,
    assignee: source.assignee ?? null,
    // Keep the lead time: a task that started a week before it was due should
    // still start a week before the next one.
    startDate:
      shift !== null && source.startDate
        ? new Date(source.startDate.getTime() + shift)
        : null,
    dueDate,
    labels: source.labels ?? [],
    checklist: (source.checklist ?? []).map((item) => ({
      title: item.title,
      done: false,
      position: item.position,
    })),
    estimateMinutes: source.estimateMinutes ?? null,
    timeEntries: [],
    runningTimer: null,
    recurrence: {
      frequency: ruleInput.frequency,
      interval: rule.interval,
      weekdays: rule.weekdays ?? [],
      dayOfMonth: rule.dayOfMonth ?? null,
      endsAt: rule.endsAt ?? null,
      // Skips straight past any period that elapsed while nobody was looking.
      // A weekly task left for six weeks owes one occurrence, not six.
      nextOccurrenceAt: nextOccurrenceAfter(ruleInput, dueDate, new Date()),
      lastSpawnedAt: null,
    },
    recurrenceRoot: source.recurrenceRoot ?? source._id,
    createdBy: source.createdBy,
  });
}

/**
 * Takes the rule off a task, atomically, and hands it to the caller.
 *
 * This is both the claim and the first half of the work: the rule always moves
 * from the completed occurrence to the new one, so clearing it *is* the claim.
 * `findOneAndUpdate` returns the document as it was, which is the only copy of
 * the rule that will ever be handed out — a second caller racing for the same
 * task matches `recurrence: { $ne: null }` against a document that no longer
 * has one, gets nothing back, and does nothing.
 *
 * An earlier version compared a token nested inside the subdocument
 * (`recurrence.lastSpawnedAt`). Six concurrent board loads produced three
 * copies: the nested path did not constrain the update the way a top-level one
 * does, so every caller matched. Claims belong on a top-level field.
 */
async function claimRule(
  taskId: Types.ObjectId,
): Promise<{ task: TaskDoc; rule: StoredRecurrence } | null> {
  const before = await TaskModel.findOneAndUpdate(
    { _id: taskId, recurrence: { $ne: null } },
    { $set: { recurrence: null } },
    // The before-image still carries the rule; the after-image never would.
    { returnDocument: "before" },
  ).lean<TaskDoc>();

  const rule = before?.recurrence as StoredRecurrence | null | undefined;

  if (!before || !rule) {
    return null;
  }

  return { task: before, rule };
}

/**
 * Puts a claimed rule back.
 *
 * If writing the next occurrence fails after the claim, the task would
 * otherwise stop repeating silently — the worst kind of failure for something
 * whose whole job is to happen without being asked.
 */
async function releaseRule(
  taskId: Types.ObjectId,
  rule: StoredRecurrence,
): Promise<void> {
  await TaskModel.findByIdAndUpdate(taskId, { recurrence: rule });
}

/**
 * Completing a repeating task creates the next one.
 *
 * The common path, and the one people expect: tick off this month's report and
 * next month's is already waiting.
 */
export async function spawnOnCompletion(taskId: string): Promise<void> {
  await connectToDatabase();

  const existing = await TaskModel.findById(taskId)
    .select("completedAt recurrence")
    .lean<{ completedAt: Date | null; recurrence: unknown }>();

  if (!existing?.completedAt || !existing.recurrence) {
    return;
  }

  const claimed = await claimRule(new Types.ObjectId(taskId));

  if (!claimed) {
    return;
  }

  try {
    // Completed early or late, the next one is still due relative to the
    // schedule rather than to when the box was ticked.
    await writeNextOccurrence(claimed.task, claimed.rule);
  } catch (error) {
    await releaseRule(claimed.task._id, claimed.rule);
    throw error;
  }
}

/**
 * Catches up rules whose date has passed without anyone completing them.
 *
 * Runs when a board or the dashboard is read, which is the trade-off for having
 * no scheduler: generation happens the next time someone looks, not at
 * midnight. It is bounded and indexed on `recurrence.nextOccurrenceAt`, so the
 * usual case is one index probe that matches nothing.
 */
export async function catchUpRecurrences(
  boardIds: readonly string[],
): Promise<void> {
  if (boardIds.length === 0) {
    return;
  }

  await connectToDatabase();

  const now = new Date();

  const due = await TaskModel.find({
    board: { $in: boardIds.map((id) => new Types.ObjectId(id)) },
    archivedAt: null,
    "recurrence.nextOccurrenceAt": { $lte: now },
  })
    .select("_id")
    .limit(50)
    .lean<{ _id: Types.ObjectId }[]>();

  for (const candidate of due) {
    // Re-read under the claim rather than trusting the list: by the time this
    // loop reaches a task, a concurrent request may already have taken it.
    const claimed = await claimRule(candidate._id);

    if (!claimed) {
      continue;
    }

    try {
      await writeNextOccurrence(claimed.task, claimed.rule);
    } catch (error) {
      await releaseRule(claimed.task._id, claimed.rule);

      // Logged and swallowed, unlike `spawnOnCompletion`. This sweep runs
      // inside the render of the dashboard, the calendar and every board — a
      // throw here would turn one unspawnable rule into a 500 on three pages
      // that have nothing else wrong with them. The rule was put back, so the
      // next read tries again.
      console.error(
        "[recurrence] failed to spawn next occurrence",
        claimed.task._id.toString(),
        error,
      );
    }
  }
}
