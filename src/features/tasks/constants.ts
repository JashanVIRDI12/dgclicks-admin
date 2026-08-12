/**
 * Closed sets shared by the Zod schemas, the Mongoose enums and the UI.
 *
 * Declared once as `as const` tuples so the schema, the database constraint and
 * the dropdown can never disagree about what a valid value is.
 */

/**
 * Ordered least to most urgent. `none` is a real value rather than `null` so a
 * card can show "no priority set" without a special case at every read.
 */
export const TASK_PRIORITIES = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/**
 * Sort weight for "most urgent first". Separate from the array order because
 * `none` sorts last despite being first in the list.
 */
export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

/**
 * Fixed palette rather than a free colour picker: a bounded set keeps the UI
 * coherent, and storing the name (not a hex value) means swatches restyle with
 * the theme instead of clashing in dark mode. Each name resolves to a
 * `--label-*` token in globals.css.
 */
export const LABEL_COLORS = [
  "slate",
  "blue",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
  "pink",
  "teal",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export const DEFAULT_LABEL_COLOR: LabelColor = "blue";

/** Icons a board can carry. Resolved to a component in `board-icon.tsx`. */
export const BOARD_ICONS = [
  "layout",
  "search",
  "code",
  "palette",
  "megaphone",
  "pen",
  "camera",
  "chart",
  "rocket",
  "target",
  "settings",
  "user",
] as const;

export type BoardIcon = (typeof BOARD_ICONS)[number];

export const DEFAULT_BOARD_ICON: BoardIcon = "layout";

/**
 * The columns a new board starts with.
 *
 * A board with no columns cannot accept a task, so an empty board would be a
 * dead end on first open. `isTerminal` marks the column that means "done" —
 * dropping a card there completes it and fires any recurrence rule.
 */
export const DEFAULT_LISTS: readonly {
  name: string;
  isTerminal: boolean;
}[] = [
  { name: "Backlog", isTerminal: false },
  { name: "To Do", isTerminal: false },
  { name: "In Progress", isTerminal: false },
  { name: "Review", isTerminal: false },
  { name: "Done", isTerminal: true },
];

/** How a board renders. Kanban is the default and the one the board is built around. */
export const BOARD_VIEWS = ["kanban", "list", "calendar", "timeline"] as const;

export type BoardView = (typeof BOARD_VIEWS)[number];

export const DEFAULT_BOARD_VIEW: BoardView = "kanban";

/**
 * Who may see and mutate a board.
 *
 * Workspace membership is the floor for the first two; `private` raises it, so
 * a board can belong to one team without the rest of the workspace knowing it
 * exists. Administrators keep both rights under every mode — a board that could
 * lock its administrators out would need a database edit to recover.
 *
 * | mode         | can view          | can edit          |
 * | ------------ | ----------------- | ----------------- |
 * | `workspace`  | workspace members | workspace members |
 * | `restricted` | workspace members | admins + editors  |
 * | `private`    | admins + editors  | admins + editors  |
 */
export const BOARD_ACCESS_MODES = ["workspace", "restricted", "private"] as const;

export type BoardAccessMode = (typeof BOARD_ACCESS_MODES)[number];

export const BOARD_VIEW_LABELS: Record<BoardView, string> = {
  kanban: "Board",
  list: "List",
  calendar: "Calendar",
  timeline: "Timeline",
};

/**
 * How often a recurring task repeats.
 *
 * `quarterly` is its own frequency rather than "monthly, interval 3" because
 * that is how people describe it, and the rule editor should not make someone
 * translate their own schedule.
 */
export const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};

/** Field limits, shared by the Zod schemas and the Mongoose `maxlength`. */
export const LIMITS = {
  workspaceName: 60,
  boardName: 60,
  boardDescription: 400,
  listName: 40,
  labelName: 32,
  taskTitle: 200,
  taskDescription: 20_000,
  commentBody: 5_000,
  checklistItem: 200,
  checklistItems: 100,
  timeEntryNote: 200,
  /**
   * Bounded by the host, not by us.
   *
   * Vercel rejects a request body over 4.5 MB at the edge, before the route
   * handler is ever invoked — so a larger limit here would be a promise the
   * platform overrules, and the upload would fail with a platform error page
   * instead of this app's validation message. 4 MB leaves room for the
   * multipart envelope around the file.
   *
   * Raising this means moving uploads off the request body entirely (a signed
   * direct-to-storage URL), not just changing the number.
   */
  attachmentBytes: 4 * 1024 * 1024,
  attachmentsPerTask: 25,
} as const;

/**
 * How long a finished task stays on the board before it is archived.
 *
 * Archiving hides a task from the board and from every open-work list. It does
 * not delete it, and — importantly — it does not stop it counting as completed:
 * the throughput numbers deliberately ignore `archivedAt` so a tidy board and an
 * honest "done this week" are not in competition.
 *
 * A day is long enough to see your own work land in Done and feel it, short
 * enough that the column stops being a graveyard.
 */
export const ARCHIVE_COMPLETED_AFTER_HOURS = 24;

export const BOARD_LABEL_LIMIT = 40;
export const TASK_SEARCH_LIMIT = 8;

/**
 * How many subtasks may be listed while creating their parent.
 *
 * They are written in the same request as the parent, so an unbounded array
 * would turn one create into an arbitrarily long write. Adding more afterwards
 * from the task drawer is not capped — this bounds the single request, not the
 * task.
 */
export const SUBTASK_CREATE_LIMIT = 20;
