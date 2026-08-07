import "server-only";

import { Types } from "mongoose";

import {
  ACTIVITY_PAGE_SIZE,
  type ActivityAction,
  type ActivityEntity,
} from "@/features/activity/constants";
import {
  ActivityModel,
  type ActivityDoc,
} from "@/features/activity/server/activity.model";
import type {
  ActivityChange,
  ActivityContext,
  ActivityEntry,
} from "@/features/activity/types";
import {
  toUserSummary,
  USER_SUMMARY_SELECT,
} from "@/features/auth/server/serialize";
import { connectToDatabase } from "@/lib/db/connect";
import type { Paginated } from "@/types";

const ACTOR_POPULATE = { path: "actor", select: USER_SUMMARY_SELECT } as const;

function toActivityEntry(doc: ActivityDoc): ActivityEntry {
  const context = doc.context;

  return {
    id: doc._id.toString(),
    action: doc.action as ActivityAction,
    entityType: doc.entityType as ActivityEntity,
    entityId: doc.entityId.toString(),
    entityLabel: doc.entityLabel,
    boardId: doc.board ? doc.board.toString() : null,
    actor: toUserSummary(doc.actor as Parameters<typeof toUserSummary>[0]),
    context:
      context?.id && context.type
        ? {
            type: context.type as ActivityEntity,
            id: context.id.toString(),
            label: context.label ?? "",
          }
        : null,
    changes: (doc.changes ?? []).map((change) => ({
      field: change.field,
      from: change.from ?? null,
      to: change.to ?? null,
    })),
    createdAt: doc.createdAt.toISOString(),
  };
}

export type RecordActivityInput = {
  actorId: string;
  action: ActivityAction;
  entityType: ActivityEntity;
  entityId: string;
  entityLabel: string;
  /** The board this belongs to. Omitted only for workspace-level entries. */
  boardId?: string | null;
  context?: Omit<ActivityContext, "id"> & { id: string };
  changes?: ActivityChange[];
};

/**
 * Writes one audit entry.
 *
 * Deliberately never throws. A failure to record history must not roll back the
 * thing that actually happened — a task that was created but not logged is far
 * better than a task the user was told failed to save. Failures are logged
 * server-side so they are still visible.
 */
export async function recordActivity(
  input: RecordActivityInput,
): Promise<void> {
  try {
    await connectToDatabase();

    await ActivityModel.create({
      actor: new Types.ObjectId(input.actorId),
      action: input.action,
      entityType: input.entityType,
      entityId: new Types.ObjectId(input.entityId),
      entityLabel: input.entityLabel.slice(0, 200),
      board: input.boardId ? new Types.ObjectId(input.boardId) : null,
      context: input.context
        ? {
            type: input.context.type,
            id: new Types.ObjectId(input.context.id),
            label: input.context.label.slice(0, 200),
          }
        : undefined,
      changes: input.changes ?? [],
    });
  } catch (error) {
    console.error("[activity] failed to record", input, error);
  }
}

/**
 * Diffs two records into a list of changed fields.
 *
 * Only scalar fields are compared — collections like labels produce noisy,
 * unreadable diffs and are better summarised as "updated".
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): ActivityChange[] {
  const changes: ActivityChange[] = [];

  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;

    if (String(from) !== String(to)) {
      changes.push({
        field,
        from: from === null ? null : String(from),
        to: to === null ? null : String(to),
      });
    }
  }

  return changes;
}

export type ListActivityOptions = {
  page: number;
  /** Everything that happened on one board, including its tasks and comments. */
  boardId?: string;
  /** One record and anything nested under it, such as a task and its comments. */
  entityId?: string;
  /** Restrict to the boards the caller can see. */
  boardIds?: readonly string[];
};

export async function listActivity(
  options: ListActivityOptions,
): Promise<Paginated<ActivityEntry>> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (options.boardId) {
    query.board = new Types.ObjectId(options.boardId);
  } else if (options.boardIds) {
    query.board = {
      $in: options.boardIds.map((id) => new Types.ObjectId(id)),
    };
  }

  if (options.entityId) {
    const id = new Types.ObjectId(options.entityId);
    // Either the record itself, or something whose parent is this record.
    query.$or = [{ entityId: id }, { "context.id": id }];
  }

  const skip = (options.page - 1) * ACTIVITY_PAGE_SIZE;

  const [total, docs] = await Promise.all([
    ActivityModel.countDocuments(query),
    ActivityModel.find(query)
      .populate(ACTOR_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(ACTIVITY_PAGE_SIZE)
      .lean<ActivityDoc[]>(),
  ]);

  return {
    items: docs.map(toActivityEntry),
    total,
    page: options.page,
    pageSize: ACTIVITY_PAGE_SIZE,
    hasMore: skip + docs.length < total,
  };
}
