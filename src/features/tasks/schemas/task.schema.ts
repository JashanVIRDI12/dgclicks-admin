import { z } from "zod";

import {
  BOARD_LABEL_LIMIT,
  LIMITS,
  RECURRENCE_FREQUENCIES,
  SUBTASK_CREATE_LIMIT,
  TASK_PRIORITIES,
} from "@/features/tasks/constants";
import { objectId } from "@/lib/validation";

/**
 * Accepts both a `Date` and an ISO string.
 *
 * Server actions serialize `Date` objects natively, so a date picker's value
 * arrives as a real `Date`; the same field posted from a URL or a fetch arrives
 * as a string. `.nullable()` short-circuits before coercion, which is what makes
 * `null` mean "clear this" rather than the epoch.
 */
const dateInput = z.coerce.date();

const MAX_ESTIMATE_MINUTES = 60 * 24 * 365;

const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the task a title.")
  .max(
    LIMITS.taskTitle,
    `Title must be at most ${LIMITS.taskTitle} characters.`,
  );

const taskDescriptionSchema = z
  .string()
  .trim()
  .max(
    LIMITS.taskDescription,
    `Description must be at most ${LIMITS.taskDescription.toLocaleString()} characters.`,
  );

export const recurrenceSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z
      .number()
      .int()
      .min(1, "Repeat at least every 1.")
      .max(365, "Repeat at most every 365."),
    /** 0 = Sunday … 6 = Saturday. Only meaningful for `custom`. */
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    endsAt: dateInput.nullable(),
  })
  .superRefine((rule, context) => {
    // `custom` is the "specific weekdays" mode — every Mon/Wed/Fri, say. Every
    // other frequency derives its weekday from the task's own due date, so this
    // is the one case where an empty selection would never fire.
    if (rule.frequency === "custom" && rule.weekdays.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["weekdays"],
        message: "Choose at least one day of the week.",
      });
    }
  });

export const taskFieldsSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema.nullable(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: objectId.nullable(),
  startDate: dateInput.nullable(),
  dueDate: dateInput.nullable(),
  labelIds: z
    .array(objectId)
    .max(BOARD_LABEL_LIMIT, `At most ${BOARD_LABEL_LIMIT} labels.`),
  estimateMinutes: z
    .number()
    .int()
    .min(0)
    .max(MAX_ESTIMATE_MINUTES, "That estimate is longer than a year.")
    .nullable(),
});

/**
 * Titles for subtasks spawned alongside their parent.
 *
 * A subtask is a real task with a parent id, so there is nothing to attach one
 * to until the parent exists — the create form collects the titles and they are
 * written with the parent in the same request rather than one call each.
 */
const subtaskTitlesSchema = z
  .array(taskTitleSchema)
  .max(SUBTASK_CREATE_LIMIT, `At most ${SUBTASK_CREATE_LIMIT} subtasks.`);

/**
 * Checklist steps supplied with a new task.
 *
 * Unlike subtasks these are embedded on the task document, so there is nothing
 * to create separately — they are written as part of the same insert. Bounded
 * by the same limits the drawer enforces, so a list built here and a list built
 * afterwards obey one rule.
 */
const checklistTitlesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Describe the step.")
      .max(
        LIMITS.checklistItem,
        `Each step must be at most ${LIMITS.checklistItem} characters.`,
      ),
  )
  .max(LIMITS.checklistItems, `At most ${LIMITS.checklistItems} steps.`);

/**
 * Creating only requires a title and a home. Everything else is set afterwards
 * from the drawer, which is what keeps quick-create to one keystroke and one
 * field.
 */
export const createTaskSchema = taskFieldsSchema
  .partial()
  .required({ title: true })
  .extend({
    boardId: objectId,
    /** Omitted means the board's first column. */
    listId: objectId.optional(),
    /** Set to create this as a subtask of an existing task. */
    parentId: objectId.optional(),
    recurrence: recurrenceSchema.optional(),
    subtasks: subtaskTitlesSchema.optional(),
    checklist: checklistTitlesSchema.optional(),
    /**
     * An opening comment, posted as the creator once the task exists.
     *
     * One, not many: a thread starts somewhere, and a form that collected a
     * conversation before anyone could reply to it would be pretending the task
     * had a history it does not have.
     */
    comment: z
      .string()
      .trim()
      .max(
        LIMITS.commentBody,
        `Comment must be at most ${LIMITS.commentBody.toLocaleString()} characters.`,
      )
      .optional(),
  })
  .superRefine((task, context) => {
    if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date cannot be before the start date.",
      });
    }

    // Subtasks are one level deep. The drawer renders a parent's children as a
    // flat list with no way in to a third level, so a grandchild would be a row
    // that exists in the database and nowhere on screen.
    if (task.parentId && task.subtasks?.length) {
      context.addIssue({
        code: "custom",
        path: ["subtasks"],
        message: "A subtask cannot have subtasks of its own.",
      });
    }
  });

const optionalDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .nullable();

/**
 * Browser-friendly creation values. Only the title is required; every detail
 * is presented up front but can be left empty and filled in later.
 */
export const createTaskFormSchema = z
  .object({
    title: taskTitleSchema,
    description: taskDescriptionSchema,
    priority: z.enum(TASK_PRIORITIES),
    assigneeId: objectId.nullable(),
    startDate: optionalDateString,
    dueDate: optionalDateString,
    labelIds: z
      .array(objectId)
      .max(BOARD_LABEL_LIMIT, `At most ${BOARD_LABEL_LIMIT} labels.`),
    recurrenceFrequency: z.enum(RECURRENCE_FREQUENCIES).nullable(),
    subtasks: subtaskTitlesSchema,
    checklist: checklistTitlesSchema,
    comment: z
      .string()
      .trim()
      .max(
        LIMITS.commentBody,
        `Comment must be at most ${LIMITS.commentBody.toLocaleString()} characters.`,
      ),
    estimateHours: z
      .number()
      .min(0.25, "Estimate at least 15 minutes.")
      .max(24 * 365, "That estimate is longer than a year.")
      .nullable(),
  })
  .refine(
    (task) =>
      !task.startDate || !task.dueDate || task.dueDate >= task.startDate,
    {
      path: ["dueDate"],
      message: "Due date cannot be before the start date.",
    },
  );

/**
 * A patch, not a replacement.
 *
 * The drawer autosaves one field at a time, so every field is optional and only
 * the keys present are written. `null` is distinct from absent: it clears the
 * value, where absent leaves it alone.
 */
export const updateTaskSchema = taskFieldsSchema.partial().extend({
  id: objectId,
});

export const taskIdSchema = z.object({ id: objectId });

/**
 * A drop. The neighbours are sent rather than an index because positions are
 * fractional — the server needs to know what the card landed *between*, and an
 * index would be stale the moment anyone else reordered the column.
 */
export const moveTaskSchema = z.object({
  id: objectId,
  listId: objectId,
  beforeId: objectId.nullable(),
  afterId: objectId.nullable(),
});

export const setTaskCompleteSchema = z.object({
  id: objectId,
  isComplete: z.boolean(),
});

export const setTaskRecurrenceSchema = z.object({
  id: objectId,
  /** Null removes the rule and stops the task repeating. */
  recurrence: recurrenceSchema.nullable(),
});

export const addChecklistItemSchema = z.object({
  taskId: objectId,
  title: z
    .string()
    .trim()
    .min(1, "Describe the step.")
    .max(
      LIMITS.checklistItem,
      `Item must be at most ${LIMITS.checklistItem} characters.`,
    ),
});

export const updateChecklistItemSchema = z.object({
  taskId: objectId,
  itemId: objectId,
  title: z
    .string()
    .trim()
    .min(1, "Describe the step.")
    .max(LIMITS.checklistItem)
    .optional(),
  done: z.boolean().optional(),
});

export const removeChecklistItemSchema = z.object({
  taskId: objectId,
  itemId: objectId,
});

export const createCommentSchema = z.object({
  taskId: objectId,
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(
      LIMITS.commentBody,
      `Comment must be at most ${LIMITS.commentBody.toLocaleString()} characters.`,
    ),
});

export const commentIdSchema = z.object({ id: objectId });

export const logTimeSchema = z.object({
  taskId: objectId,
  minutes: z
    .number()
    .int()
    .min(1, "Log at least a minute.")
    .max(MAX_ESTIMATE_MINUTES, "That is longer than a year."),
  note: z
    .string()
    .trim()
    .max(LIMITS.timeEntryNote)
    .transform((value) => value || undefined)
    .optional(),
});

export const timeEntryIdSchema = z.object({
  taskId: objectId,
  entryId: objectId,
});

export const attachmentIdSchema = z.object({ id: objectId });

export type RecurrenceFormValues = z.output<typeof recurrenceSchema>;
export type TaskFieldValues = z.output<typeof taskFieldsSchema>;
export type CreateTaskFormValues = z.output<typeof createTaskFormSchema>;
