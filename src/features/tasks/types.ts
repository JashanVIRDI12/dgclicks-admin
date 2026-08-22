import type { ActivityEntry } from "@/features/activity/types";
import type { UserSummary } from "@/features/auth/types";
import type {
  BoardIcon,
  BoardAccessMode,
  LabelColor,
  MediaType,
  RecurrenceFrequency,
  TaskPriority,
} from "@/features/tasks/constants";

/**
 * Plain shapes handed to client components.
 *
 * Mongoose documents carry `ObjectId`s, `Date`s and prototype methods, none of
 * which survive the server/client boundary usefully. Everything crossing it is
 * mapped to these first: ids are strings, timestamps are ISO strings.
 */

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  members: UserSummary[];
  /** Members granted workspace administration. See `canManageWorkspace`. */
  managerIds: string[];
  /** Always a manager, so a workspace can never be left with nobody to run it. */
  createdById: string;
  createdAt: string;
};

export type WorkspaceInvite = {
  id: string;
  /** The absolute link to share. The token is never exposed on its own. */
  url: string;
  expiresAt: string | null;
  useCount: number;
  createdAt: string;
};

export type Label = {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
};

export type List = {
  id: string;
  boardId: string;
  name: string;
  position: number;
  /** Landing here marks a task complete and fires its recurrence rule. */
  isTerminal: boolean;
};

export type Board = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  icon: BoardIcon;
  color: LabelColor;
  position: number;
  accessMode: BoardAccessMode;
  editorIds: string[];
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type TimeEntry = {
  id: string;
  user: UserSummary | null;
  minutes: number;
  note: string | null;
  loggedAt: string;
};

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** Repeat every N units of `frequency`. Always at least 1. */
  interval: number;
  /** For weekly and custom rules: 0 = Sunday … 6 = Saturday. */
  weekdays: number[];
  /** For monthly-style rules. Clamped to the length of the target month. */
  dayOfMonth: number | null;
  /** Stop generating after this date. Null repeats indefinitely. */
  endsAt: string | null;
  nextOccurrenceAt: string;
};

/**
 * A task as a card renders it.
 *
 * Counts are denormalised rather than joined: a board can hold hundreds of
 * cards and counting comments per card would be an N+1 on the one query that
 * has to stay fast.
 */
export type Task = {
  id: string;
  boardId: string;
  listId: string;
  /** Set when this is a subtask. Subtasks never appear as board cards. */
  parentId: string | null;
  title: string;
  description: string | null;
  position: number;
  priority: TaskPriority;
  /** What the content is: reel, photo, carousel… `none` when not content. */
  mediaType: MediaType;
  /** Everyone the task belongs to. Empty means nobody has picked it up. */
  assignees: UserSummary[];
  /**
   * Who handed the task out. Null when nobody is assigned.
   *
   * On the card rather than only in the drawer, which costs one extra
   * `populate` on the board read — accepted because Mongoose batches a
   * single-ref populate into one `$in` query, so it is one more round trip per
   * board fetch, not one per card.
   */
  assignedBy: UserSummary | null;
  startDate: string | null;
  dueDate: string | null;
  labels: Label[];
  checklist: ChecklistItem[];
  estimateMinutes: number | null;
  loggedMinutes: number;
  /** Present while someone has a timer running on this task. */
  runningTimer: { user: UserSummary | null; startedAt: string } | null;
  recurrence: RecurrenceRule | null;
  completedAt: string | null;
  /**
   * When the artwork was finished, and by whom. Null while it is still with
   * the designer. Independent of `completedAt`, which is the post going out.
   */
  assetReadyAt: string | null;
  assetReadyBy: UserSummary | null;
  archivedAt: string | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Everything the drawer needs that a card does not.
 *
 * `assignedBy` lives here rather than on `Task` deliberately: only the drawer
 * shows it, and adding it to the card shape would put another `populate` on the
 * board query — the one read that has to stay fast.
 */
export type TaskDetail = Task & {
  /** Who gave the task out. Null when nobody is assigned. */
  assignedBy: UserSummary | null;
  timeEntries: TimeEntry[];
  subtasks: Task[];
};

export type Comment = {
  id: string;
  taskId: string;
  author: UserSummary | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: string;
  taskId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedBy: UserSummary | null;
  createdAt: string;
};

/**
 * Everything the drawer shows, in one read.
 *
 * Bundled rather than four requests because they all arrive together when a
 * card is opened, and four spinners in one panel is four chances to look slow.
 */
export type TaskWorkspace = {
  task: TaskDetail;
  comments: Comment[];
  attachments: Attachment[];
  /** This task's own history, plus anything recorded against its comments. */
  activity: ActivityEntry[];
};

/** One board and everything needed to render any of its four views. */
export type BoardSnapshot = {
  board: Board;
  lists: List[];
  labels: Label[];
  tasks: Task[];
};

/** A board plus the counts the index page shows without loading its tasks. */
export type BoardSummary = Board & {
  taskCount: number;
  completedCount: number;
  overdueCount: number;
};
