import { z } from "zod";

import { ValidationError } from "@/lib/errors";

/**
 * A MongoDB ObjectId as it arrives from a form or a URL.
 *
 * Every schema that takes an id uses this, so `new Types.ObjectId(value)` in a
 * service can never throw on malformed input — the boundary rejects it first,
 * with a message a form can render.
 */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Not a valid identifier.");

/**
 * Collapses a ZodError into `{ fieldName: [messages] }`.
 *
 * Built from `issues` directly rather than a Zod helper so the shape stays
 * stable across Zod versions, and so nested paths (`address.city`) flatten to a
 * dotted key that React Hook Form's `setError` understands.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "root";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

/**
 * Parses untrusted input, throwing a `ValidationError` the API and action
 * layers already know how to render.
 *
 * This is the only place input crosses from unknown to typed. Client-side
 * validation is a UX affordance; this is the check that counts.
 */
export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      "Please check the highlighted fields.",
      toFieldErrors(result.error),
    );
  }

  return result.data;
}
