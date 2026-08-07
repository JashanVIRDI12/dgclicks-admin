import { z } from "zod";

import { objectId } from "@/lib/validation";

/**
 * How long a new link stays usable.
 *
 * A closed set rather than a number: the field exists so an admin can hand out
 * a link that stops working on its own, and free-form input invites a typo that
 * silently creates a link lasting a decade.
 */
export const INVITE_DURATIONS = ["1", "7", "30", "never"] as const;

export type InviteDuration = (typeof INVITE_DURATIONS)[number];

export const INVITE_DURATION_LABELS: Record<InviteDuration, string> = {
  "1": "1 day",
  "7": "7 days",
  "30": "30 days",
  never: "Never expires",
};

export const createInviteSchema = z.object({
  workspaceId: objectId,
  expiresIn: z.enum(INVITE_DURATIONS),
});

export const revokeInviteSchema = z.object({
  id: objectId,
});

export const acceptInviteSchema = z.object({
  // The token is base64url from 32 random bytes, so it is fixed-length and has
  // no business reaching the database in another shape.
  token: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/, "That invite link is not valid."),
});
