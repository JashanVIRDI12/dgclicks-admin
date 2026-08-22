import "server-only";

import type { Types } from "mongoose";

import { toUserSummary } from "@/features/auth/server/serialize";
import type { UserSummary } from "@/features/auth/types";
import type {
  BoardIcon,
  BoardAccessMode,
  LabelColor,
  MediaType,
  RecurrenceFrequency,
  TaskPriority,
} from "@/features/tasks/constants";
import type {
  Attachment,
  Board,
  ChecklistItem,
  Comment,
  Label,
  List,
  RecurrenceRule,
  Task,
  TimeEntry,
  Workspace,
} from "@/features/tasks/types";
import { isPopulated, toIdString } from "@/lib/db/serialize";

/**
 * Mappers from Mongoose documents to the plain DTOs in `types.ts`.
 *
 * Every read path goes through here, so there is exactly one place where an
 * `ObjectId` becomes a string and a `Date` becomes an ISO string. Without it, a
 * forgotten conversion surfaces as an opaque serialization error at the
 * server/client boundary rather than at the query.
 */

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

type WorkspaceSource = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  members?: unknown[];
  managers?: unknown[];
  createdBy: unknown;
  createdAt: Date;
};

export function toWorkspace(doc: WorkspaceSource): Workspace {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    members: (doc.members ?? [])
      .map((member) =>
        toUserSummary(member as Parameters<typeof toUserSummary>[0]),
      )
      .filter((member): member is UserSummary => member !== null),
    managerIds: (doc.managers ?? []).map(toIdString),
    createdById: toIdString(doc.createdBy),
    createdAt: doc.createdAt.toISOString(),
  };
}

type BoardSource = {
  _id: Types.ObjectId;
  workspace: unknown;
  name: string;
  description?: string | null;
  icon: string;
  color: string;
  position: number;
  accessMode?: string;
  editors?: unknown[];
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toBoard(doc: BoardSource): Board {
  return {
    id: doc._id.toString(),
    workspaceId: toIdString(doc.workspace),
    name: doc.name,
    description: doc.description ?? null,
    icon: doc.icon as BoardIcon,
    color: doc.color as LabelColor,
    position: doc.position,
    accessMode: (doc.accessMode ?? "workspace") as BoardAccessMode,
    editorIds: (doc.editors ?? []).map(toIdString),
    archivedAt: toIso(doc.archivedAt),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type ListSource = {
  _id: Types.ObjectId;
  board: unknown;
  name: string;
  position: number;
  isTerminal: boolean;
};

export function toList(doc: ListSource): List {
  return {
    id: doc._id.toString(),
    boardId: toIdString(doc.board),
    name: doc.name,
    position: doc.position,
    isTerminal: doc.isTerminal,
  };
}

type LabelSource = {
  _id: Types.ObjectId;
  board: unknown;
  name: string;
  color: string;
};

export function toLabel(doc: LabelSource): Label {
  return {
    id: doc._id.toString(),
    boardId: toIdString(doc.board),
    name: doc.name,
    color: doc.color as LabelColor,
  };
}

/**
 * A label reference on a task, which may or may not have been populated.
 *
 * Returns `null` for a bare id so the caller can drop it: a label deleted after
 * a task referenced it leaves a dangling `ObjectId` that would otherwise render
 * as an empty chip.
 */
function toTaskLabel(value: unknown): Label | null {
  const candidate = value as Parameters<typeof isPopulated>[0];

  if (!isPopulated(candidate)) {
    return null;
  }

  return toLabel(candidate as unknown as LabelSource);
}

type ChecklistSource = {
  _id: Types.ObjectId;
  title: string;
  done: boolean;
  position: number;
};

function toChecklistItem(item: ChecklistSource): ChecklistItem {
  return {
    id: item._id.toString(),
    title: item.title,
    done: item.done,
  };
}

type TimeEntrySource = {
  _id: Types.ObjectId;
  user: unknown;
  minutes: number;
  note?: string | null;
  loggedAt: Date;
};

export function toTimeEntry(entry: TimeEntrySource): TimeEntry {
  return {
    id: entry._id.toString(),
    user: toUserSummary(entry.user as Parameters<typeof toUserSummary>[0]),
    minutes: entry.minutes,
    note: entry.note ?? null,
    loggedAt: entry.loggedAt.toISOString(),
  };
}

type RecurrenceSource = {
  frequency: string;
  interval: number;
  weekdays?: number[];
  dayOfMonth?: number | null;
  endsAt?: Date | null;
  nextOccurrenceAt: Date;
};

function toRecurrence(
  rule: RecurrenceSource | null | undefined,
): RecurrenceRule | null {
  if (!rule) {
    return null;
  }

  return {
    frequency: rule.frequency as RecurrenceFrequency,
    interval: rule.interval,
    weekdays: [...(rule.weekdays ?? [])],
    dayOfMonth: rule.dayOfMonth ?? null,
    endsAt: toIso(rule.endsAt),
    nextOccurrenceAt: rule.nextOccurrenceAt.toISOString(),
  };
}

/**
 * Everyone a task belongs to.
 *
 * Falls back to the pre-migration `assignee` field so a document written
 * before tasks could have several owners still renders its owner rather than
 * silently appearing unassigned. `scripts/migrate-assignees.mts` moves them
 * across for good; this keeps the app correct in the window before it runs, and
 * on any document that script has not reached.
 */
function toAssignees(doc: {
  assignees?: unknown[];
  assignee?: unknown;
}): UserSummary[] {
  const source =
    doc.assignees && doc.assignees.length > 0
      ? doc.assignees
      : doc.assignee
        ? [doc.assignee]
        : [];

  return source
    .map((value) => toUserSummary(value as Parameters<typeof toUserSummary>[0]))
    .filter((user): user is UserSummary => user !== null);
}

type TaskSource = {
  _id: Types.ObjectId;
  board: unknown;
  list: unknown;
  parent?: unknown;
  title: string;
  description?: string | null;
  position: number;
  priority: string;
  mediaType?: string;
  assignees?: unknown[];
  /** Pre-migration single owner. See `toAssignees`. */
  assignee?: unknown;
  assignedBy?: unknown;
  startDate?: Date | null;
  dueDate?: Date | null;
  labels?: unknown[];
  checklist?: ChecklistSource[];
  estimateMinutes?: number | null;
  timeEntries?: { minutes: number }[];
  runningTimer?: { user: unknown; startedAt: Date } | null;
  recurrence?: RecurrenceSource | null;
  completedAt?: Date | null;
  assetReadyAt?: Date | null;
  assetReadyBy?: unknown;
  archivedAt?: Date | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toTask(doc: TaskSource): Task {
  return {
    id: doc._id.toString(),
    boardId: toIdString(doc.board),
    listId: toIdString(doc.list),
    parentId: doc.parent ? toIdString(doc.parent) : null,
    title: doc.title,
    description: doc.description ?? null,
    position: doc.position,
    priority: doc.priority as TaskPriority,
    // Defaulted rather than asserted: tasks written before this field existed
    // carry no value, and a board should not break over a missing enum.
    mediaType: (doc.mediaType ?? "none") as MediaType,
    assignees: toAssignees(doc),
    assignedBy: toUserSummary(
      doc.assignedBy as Parameters<typeof toUserSummary>[0],
    ),
    startDate: toIso(doc.startDate),
    dueDate: toIso(doc.dueDate),
    labels: (doc.labels ?? [])
      .map(toTaskLabel)
      .filter((label): label is Label => label !== null),
    checklist: (doc.checklist ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toChecklistItem),
    estimateMinutes: doc.estimateMinutes ?? null,
    // Summed here rather than stored: the entries are already loaded, and a
    // denormalised total is one more thing that can drift from its source.
    loggedMinutes: (doc.timeEntries ?? []).reduce(
      (total, entry) => total + entry.minutes,
      0,
    ),
    runningTimer: doc.runningTimer
      ? {
          user: toUserSummary(
            doc.runningTimer.user as Parameters<typeof toUserSummary>[0],
          ),
          startedAt: doc.runningTimer.startedAt.toISOString(),
        }
      : null,
    recurrence: toRecurrence(doc.recurrence),
    completedAt: toIso(doc.completedAt),
    assetReadyAt: toIso(doc.assetReadyAt),
    assetReadyBy: toUserSummary(
      doc.assetReadyBy as Parameters<typeof toUserSummary>[0],
    ),
    archivedAt: toIso(doc.archivedAt),
    commentCount: doc.commentCount,
    attachmentCount: doc.attachmentCount,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type CommentSource = {
  _id: Types.ObjectId;
  task: unknown;
  author?: unknown;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toComment(doc: CommentSource): Comment {
  return {
    id: doc._id.toString(),
    taskId: toIdString(doc.task),
    author: toUserSummary(doc.author as Parameters<typeof toUserSummary>[0]),
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

type AttachmentSource = {
  _id: Types.ObjectId;
  task: unknown;
  filename: string;
  contentType: string;
  size: number;
  uploadedBy?: unknown;
  createdAt: Date;
};

export function toAttachment(doc: AttachmentSource): Attachment {
  return {
    id: doc._id.toString(),
    taskId: toIdString(doc.task),
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    uploadedBy: toUserSummary(
      doc.uploadedBy as Parameters<typeof toUserSummary>[0],
    ),
    createdAt: doc.createdAt.toISOString(),
  };
}
