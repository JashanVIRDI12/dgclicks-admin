import "server-only";

import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import {
  BOARD_ICONS,
  BOARD_ACCESS_MODES,
  DEFAULT_BOARD_ICON,
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  LIMITS,
  MEDIA_TYPES,
  RECURRENCE_FREQUENCIES,
  TASK_PRIORITIES,
} from "@/features/tasks/constants";
import { db } from "@/lib/db/connect";

// Imported for its registration side effect: `ref: "User"` below cannot resolve
// unless the User model has been registered on this connection first.
import "@/features/auth/server/user.model";

/**
 * Models are registered on the shared connection from `lib/db/connect.ts`, and
 * guarded with `db.models.X ??` because the dev server re-evaluates this module
 * on every hot reload — a second `db.model()` call with the same name throws.
 */

const workspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.workspaceName,
    },
    slug: { type: String, required: true, trim: true, lowercase: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    /**
     * Members who may administer the workspace as well as work in it.
     *
     * The creator is not listed — they manage it by having made it — and
     * neither are global administrators, who manage every workspace they belong
     * to by role. Both are folded in by `canManageWorkspace`, which is what lets
     * this field default to empty on workspaces that predate it.
     */
    managers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "workspace", timestamps: true },
);

workspaceSchema.index({ slug: 1 }, { unique: true });

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const WorkspaceModel: Model<WorkspaceDoc> =
  (db.models.Workspace as Model<WorkspaceDoc>) ??
  db.model<WorkspaceDoc>("Workspace", workspaceSchema);

/**
 * A shareable link that grants workspace membership.
 *
 * The token is the credential, so it is indexed unique and never reused: an
 * invite is revoked rather than edited, and a replacement is a new row. Expiry
 * and revocation are stored as dates rather than a status enum, because the
 * question asked at redemption time is always "is this still valid now".
 */
const workspaceInviteSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    token: { type: String, required: true, maxlength: 128 },
    /** Null means the link does not expire. */
    expiresAt: { type: Date, default: null },
    /** Set instead of deleting, so a spent link keeps its audit trail. */
    revokedAt: { type: Date, default: null },
    useCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "workspace_invite", timestamps: true },
);

workspaceInviteSchema.index({ token: 1 }, { unique: true });

export type WorkspaceInviteDoc = InferSchemaType<
  typeof workspaceInviteSchema
> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const WorkspaceInviteModel: Model<WorkspaceInviteDoc> =
  (db.models.WorkspaceInvite as Model<WorkspaceInviteDoc>) ??
  db.model<WorkspaceInviteDoc>("WorkspaceInvite", workspaceInviteSchema);

const boardSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.boardName,
    },
    description: {
      type: String,
      trim: true,
      maxlength: LIMITS.boardDescription,
      default: null,
    },
    icon: {
      type: String,
      enum: BOARD_ICONS,
      required: true,
      default: DEFAULT_BOARD_ICON,
    },
    color: {
      type: String,
      enum: LABEL_COLORS,
      required: true,
      default: DEFAULT_LABEL_COLOR,
    },
    position: { type: Number, required: true },
    accessMode: {
      type: String,
      enum: BOARD_ACCESS_MODES,
      required: true,
      default: "workspace",
    },
    /** Used only when accessMode is restricted. Admins always retain access. */
    editors: [{ type: Schema.Types.ObjectId, ref: "User" }],
    /** Set instead of deleting. Null means active. */
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "board", timestamps: true },
);

// The sidebar and board index: one workspace's live boards, in display order.
boardSchema.index({ workspace: 1, archivedAt: 1, position: 1 });

export type BoardDoc = InferSchemaType<typeof boardSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const BoardModel: Model<BoardDoc> =
  (db.models.Board as Model<BoardDoc>) ??
  db.model<BoardDoc>("Board", boardSchema);

const listSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.listName,
    },
    position: { type: Number, required: true },
    /**
     * Marks the column that means "finished". Dropping a task here sets
     * `completedAt`; dragging it out clears it again.
     */
    isTerminal: { type: Boolean, required: true, default: false },
  },
  { collection: "list", timestamps: true },
);

listSchema.index({ board: 1, position: 1 });

export type ListDoc = InferSchemaType<typeof listSchema> & {
  _id: Types.ObjectId;
};

export const ListModel: Model<ListDoc> =
  (db.models.List as Model<ListDoc>) ?? db.model<ListDoc>("List", listSchema);

const labelSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.labelName,
    },
    color: {
      type: String,
      enum: LABEL_COLORS,
      required: true,
      default: DEFAULT_LABEL_COLOR,
    },
  },
  { collection: "label", timestamps: true },
);

// Case-insensitive uniqueness within a board: "Urgent" and "urgent" are the same
// label, and letting both exist is exactly the fragmentation labels prevent.
labelSchema.index(
  { board: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export type LabelDoc = InferSchemaType<typeof labelSchema> & {
  _id: Types.ObjectId;
};

export const LabelModel: Model<LabelDoc> =
  (db.models.Label as Model<LabelDoc>) ??
  db.model<LabelDoc>("Label", labelSchema);

/**
 * A tick-box on a task. Embedded rather than its own collection: an item has no
 * identity outside its task, is never queried across tasks, and reordering the
 * list should not be five writes.
 */
const checklistItemSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.checklistItem,
    },
    done: { type: Boolean, required: true, default: false },
    position: { type: Number, required: true },
  },
  { _id: true },
);

const timeEntrySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    minutes: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, maxlength: LIMITS.timeEntryNote, default: null },
    loggedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);

const recurrenceSchema = new Schema(
  {
    frequency: { type: String, enum: RECURRENCE_FREQUENCIES, required: true },
    interval: { type: Number, required: true, min: 1, max: 365, default: 1 },
    weekdays: [{ type: Number, min: 0, max: 6 }],
    dayOfMonth: { type: Number, min: 1, max: 31, default: null },
    endsAt: { type: Date, default: null },
    /** When the next occurrence is due. Drives the catch-up sweep. */
    nextOccurrenceAt: { type: Date, required: true },
    /**
     * Claim token for the sweep. Advanced atomically before a clone is written,
     * so two concurrent board loads cannot both spawn the same occurrence.
     */
    lastSpawnedAt: { type: Date, default: null },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    list: {
      type: Schema.Types.ObjectId,
      ref: "List",
      required: true,
      index: true,
    },
    /**
     * Set on subtasks. Board queries filter `parent: null` so a subtask never
     * appears as a card of its own — it belongs to its parent's drawer.
     */
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.taskTitle,
    },
    description: {
      type: String,
      trim: true,
      maxlength: LIMITS.taskDescription,
      default: null,
    },
    position: { type: Number, required: true },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      required: true,
      default: "none",
    },
    /**
     * Everyone the task belongs to.
     *
     * An array rather than one ref: real work is often shared, and the single
     * `assignee` this replaced forced a team to pick a token owner and track
     * the rest in the description. An empty array means nobody has picked it
     * up — the state the old `null` carried.
     */
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    /** What this piece of content is. `none` for work that is not content. */
    mediaType: {
      type: String,
      enum: MEDIA_TYPES,
      required: true,
      default: "none",
    },
    /**
     * Who handed the task out. Cleared when the last assignee is removed, so it
     * can never name the person who set an assignment that no longer exists.
     */
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    labels: [{ type: Schema.Types.ObjectId, ref: "Label" }],
    checklist: [checklistItemSchema],
    estimateMinutes: { type: Number, min: 0, default: null },
    timeEntries: [timeEntrySchema],
    runningTimer: {
      type: {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        startedAt: { type: Date, required: true },
      },
      default: null,
    },
    recurrence: { type: recurrenceSchema, default: null },
    /** Links every occurrence of a repeating task back to the first one. */
    recurrenceRoot: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    completedAt: { type: Date, default: null },
    /**
     * When the artwork for this post was finished.
     *
     * A second axis, not a second name for `completedAt`. The designer
     * finishing the asset and the post actually going out are different
     * events on different days, and a board column can only express one of
     * them at a time — so a card can sit in Scheduled and still say whether
     * its art exists.
     */
    assetReadyAt: { type: Date, default: null },
    /** Who marked the artwork done. Cleared alongside `assetReadyAt`. */
    assetReadyBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    archivedAt: { type: Date, default: null },
    /**
     * Denormalised so the board query stays a single read. Maintained by the
     * comment and attachment services, which are the only writers.
     */
    commentCount: { type: Number, required: true, default: 0, min: 0 },
    attachmentCount: { type: Number, required: true, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "task", timestamps: true },
);

// The Kanban read: one board's live cards, column by column, in order.
taskSchema.index({ board: 1, parent: 1, archivedAt: 1, list: 1, position: 1 });
// Calendar and timeline.
taskSchema.index({ board: 1, dueDate: 1 });
// My Tasks and the dashboard's due/overdue panels.
// Multikey over `assignees`: Mongo indexes each element, so "my open work,
// soonest first" stays one index scan whether a task has one owner or five.
taskSchema.index({ assignees: 1, completedAt: 1, dueDate: 1 });
// A parent's subtasks.
taskSchema.index({ parent: 1 });
// The recurrence catch-up sweep.
taskSchema.index({ "recurrence.nextOccurrenceAt": 1 });
// Title search for the command palette.
taskSchema.index({ title: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const TaskModel: Model<TaskDoc> =
  (db.models.Task as Model<TaskDoc>) ?? db.model<TaskDoc>("Task", taskSchema);

const commentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.commentBody,
    },
  },
  { collection: "comment", timestamps: true },
);

// The only way comments are ever read: one task's thread, oldest first.
commentSchema.index({ task: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const CommentModel: Model<CommentDoc> =
  (db.models.Comment as Model<CommentDoc>) ??
  db.model<CommentDoc>("Comment", commentSchema);

const attachmentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    filename: { type: String, required: true, trim: true, maxlength: 260 },
    contentType: { type: String, required: true, maxlength: 160 },
    size: { type: Number, required: true, min: 0 },
    /** `_id` of the file in the GridFS bucket; see `attachment.service.ts`. */
    gridFsId: { type: Schema.Types.ObjectId, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "attachment", timestamps: true },
);

attachmentSchema.index({ task: 1, createdAt: 1 });

export type AttachmentDoc = InferSchemaType<typeof attachmentSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const AttachmentModel: Model<AttachmentDoc> =
  (db.models.Attachment as Model<AttachmentDoc>) ??
  db.model<AttachmentDoc>("Attachment", attachmentSchema);
