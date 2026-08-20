import { z } from "zod";

import {
  CONTENT_FORMATS,
  POST_STAGES,
  SOCIAL_LIMITS,
} from "@/features/social/constants";
import { LABEL_COLORS } from "@/features/tasks/constants";
import { objectId } from "@/lib/validation";

/** `yyyy-MM-dd`. A post belongs to a day, so the wire format is a day. */
const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");

const headingSchema = z
  .string()
  .trim()
  .min(1, "Give the post a heading.")
  .max(
    SOCIAL_LIMITS.heading,
    `Heading must be at most ${SOCIAL_LIMITS.heading} characters.`,
  );

/**
 * A link or a note.
 *
 * Not `z.url()`: half of what people paste here is "same as last Diwali post",
 * and rejecting that would make the field useless for the thing it is mostly
 * used for. It renders as a link when it parses as one and as text otherwise.
 */
const referenceSchema = z
  .string()
  .trim()
  .max(
    SOCIAL_LIMITS.reference,
    `Reference must be at most ${SOCIAL_LIMITS.reference} characters.`,
  );

export const createClientSchema = z.object({
  workspaceId: objectId,
  name: z
    .string()
    .trim()
    .min(1, "Give the client a name.")
    .max(
      SOCIAL_LIMITS.clientName,
      `Name must be at most ${SOCIAL_LIMITS.clientName} characters.`,
    ),
  handle: z
    .string()
    .trim()
    .max(SOCIAL_LIMITS.clientHandle)
    // The @ is presentation, so it is stripped once here rather than guarded
    // against on every screen that renders one.
    .transform((value) => value.replace(/^@+/, ""))
    .nullable(),
  color: z.enum(LABEL_COLORS),
});

export const archiveClientSchema = z.object({
  workspaceId: objectId,
  clientId: objectId,
});

export const createPostSchema = z.object({
  workspaceId: objectId,
  clientId: objectId,
  scheduledFor: dayString,
  heading: headingSchema,
  caption: z
    .string()
    .trim()
    .max(
      SOCIAL_LIMITS.caption,
      `Caption must be at most ${SOCIAL_LIMITS.caption.toLocaleString()} characters.`,
    ),
  format: z.enum(CONTENT_FORMATS),
  reference: referenceSchema.nullable(),
  stage: z.enum(POST_STAGES),
  assigneeId: objectId.nullable(),
});

export const updatePostSchema = z.object({
  id: objectId,
  clientId: objectId.optional(),
  scheduledFor: dayString.optional(),
  heading: headingSchema.optional(),
  caption: z.string().trim().max(SOCIAL_LIMITS.caption).optional(),
  format: z.enum(CONTENT_FORMATS).optional(),
  reference: referenceSchema.nullable().optional(),
  stage: z.enum(POST_STAGES).optional(),
  assigneeId: objectId.nullable().optional(),
});

export const postIdSchema = z.object({ id: objectId });

/**
 * The browser's version of the create form.
 *
 * Separate from `createPostSchema` because a form field is never absent — an
 * empty reference arrives as `""`, not `null`, and the empty string is what the
 * inputs are initialised with.
 */
export const postFormSchema = z.object({
  clientId: objectId,
  scheduledFor: dayString,
  heading: headingSchema,
  caption: z.string().trim().max(SOCIAL_LIMITS.caption),
  format: z.enum(CONTENT_FORMATS),
  reference: referenceSchema,
  stage: z.enum(POST_STAGES),
  assigneeId: objectId.nullable(),
});

export type PostFormValues = z.output<typeof postFormSchema>;
