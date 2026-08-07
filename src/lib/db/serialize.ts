import "server-only";

import { Types } from "mongoose";

/**
 * Helpers for the one job every read path has: turning a Mongoose document into
 * a plain object that survives the server/client boundary.
 *
 * `ObjectId`s and `Date`s do not serialize usefully, so a forgotten conversion
 * surfaces as an opaque error at the boundary rather than at the query. Keeping
 * the narrowing here means feature serializers only describe their own shape.
 */

/** A reference that `populate()` may or may not have resolved. */
export type Populated<T> = T | Types.ObjectId | null | undefined;

/**
 * True when `populate()` resolved a reference rather than leaving a raw id.
 *
 * `.lean()` returns a real `ObjectId` instance for an unpopulated ref and a
 * plain object for a populated one, so the constructor check distinguishes them
 * without any per-model knowledge of which fields exist.
 */
export function isPopulated<T extends { _id: Types.ObjectId }>(
  value: Populated<T>,
): value is T {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Types.ObjectId)
  );
}

/**
 * The id of a reference, whether or not it was populated.
 *
 * Used where a caller only needs the foreign key and should not have to care
 * that some other query on the same model populated it.
 */
export function toIdString(value: unknown): string {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }

  return String(value);
}
