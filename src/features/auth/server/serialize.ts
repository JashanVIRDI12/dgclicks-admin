import "server-only";

import type { Types } from "mongoose";

import type { UserSummary } from "@/features/auth/types";
import { isPopulated, type Populated } from "@/lib/db/serialize";

type UserSource = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  image?: string | null;
};

/**
 * Maps a populated `User` reference to the summary the UI renders.
 *
 * Returns `null` for an unpopulated reference rather than throwing: a query that
 * forgot to `populate` should degrade to "Unassigned", not take down the page
 * that was only ever going to show an avatar.
 */
export function toUserSummary(
  user: Populated<UserSource>,
): UserSummary | null {
  if (!isPopulated(user)) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
  };
}

/**
 * Projection for any `populate` of a user reference. Kept next to the mapper it
 * feeds so the two cannot drift — selecting fewer fields than `toUserSummary`
 * reads would silently render blank names.
 */
export const USER_SUMMARY_SELECT = "name email image";
