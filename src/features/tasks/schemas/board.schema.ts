import { z } from "zod";

import {
  BOARD_ICONS,
  BOARD_ACCESS_MODES,
  LABEL_COLORS,
  LIMITS,
} from "@/features/tasks/constants";
import { objectId } from "@/lib/validation";

/** Trims, then treats an empty string as "not provided". */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || undefined)
    .optional();

export const boardFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the board a name.")
    .max(LIMITS.boardName, `Name must be at most ${LIMITS.boardName} characters.`),
  description: optionalText(
    LIMITS.boardDescription,
    `Description must be at most ${LIMITS.boardDescription} characters.`,
  ),
  icon: z.enum(BOARD_ICONS),
  color: z.enum(LABEL_COLORS),
});

export const createBoardSchema = boardFormSchema.extend({
  workspaceId: objectId,
});

export const updateBoardSchema = boardFormSchema.extend({ id: objectId });

export const boardIdSchema = z.object({ id: objectId });

export const boardPermissionsSchema = z.object({
  id: objectId,
  accessMode: z.enum(BOARD_ACCESS_MODES),
  editorIds: z.array(objectId).max(500, "Select at most 500 board editors."),
});

/** Reordering the board list in the sidebar. */
export const moveBoardSchema = z.object({
  id: objectId,
  beforeId: objectId.nullable(),
  afterId: objectId.nullable(),
});

export const listFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the column a name.")
    .max(LIMITS.listName, `Name must be at most ${LIMITS.listName} characters.`),
  isTerminal: z.boolean(),
});

export const createListSchema = listFormSchema.extend({ boardId: objectId });

export const updateListSchema = listFormSchema.extend({ id: objectId });

export const listIdSchema = z.object({ id: objectId });

export const moveListSchema = z.object({
  id: objectId,
  beforeId: objectId.nullable(),
  afterId: objectId.nullable(),
});

export const labelFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the label a name.")
    .max(
      LIMITS.labelName,
      `Name must be at most ${LIMITS.labelName} characters.`,
    ),
  color: z.enum(LABEL_COLORS),
});

export const createLabelSchema = labelFormSchema.extend({ boardId: objectId });

export const updateLabelSchema = labelFormSchema.extend({ id: objectId });

export const labelIdSchema = z.object({ id: objectId });

export type BoardFormValues = z.output<typeof boardFormSchema>;
export type ListFormValues = z.output<typeof listFormSchema>;
export type LabelFormValues = z.output<typeof labelFormSchema>;
