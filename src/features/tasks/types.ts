import type { ActivityEntry } from "@/features/activity/types";
import type { UserSummary } from "@/features/auth/types";
import type {
  BoardIcon,
  BoardAccessMode,
  LabelColor,
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
  assignee: UserSummary | null;
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
  archivedAt: string | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Everything the drawer needs that a card does not. */
export type TaskDetail = Task & {
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
