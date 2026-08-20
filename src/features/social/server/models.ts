import "server-only";

import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import {
  CONTENT_FORMATS,
  POST_STAGES,
  SOCIAL_LIMITS,
} from "@/features/social/constants";
import { DEFAULT_LABEL_COLOR, LABEL_COLORS } from "@/features/tasks/constants";
import { db } from "@/lib/db/connect";

// Registered for the side effect, so `ref: "User"` can resolve on this
// connection. Same reason the task models import it.
import "@/features/auth/server/user.model";

/**
 * The social calendar's own collections.
 *
 * Nothing here references a board, a list or a task, and nothing over there
 * references a post. A post is not a card that happens to be about Instagram —
 * it has a client, a format and a designer hand-off, and none of those mean
 * anything on a kanban board. Keeping the two apart is what lets each stay the
 * shape its own users need.
 */

const socialClientSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: SOCIAL_LIMITS.clientName,
    },
    /** Stored without the leading @, which is presentation. */
    handle: {
      type: String,
      trim: true,
      maxlength: SOCIAL_LIMITS.clientHandle,
      default: null,
    },
    color: {
      type: String,
      enum: LABEL_COLORS,
      required: true,
      default: DEFAULT_LABEL_COLOR,
    },
    /** Set instead of deleting, so a past client's posts keep their name. */
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "social_client", timestamps: true },
);

// Case-insensitive uniqueness per workspace: "Acme" and "acme" are one client,
// and letting both exist splits their calendar in half.
socialClientSchema.index(
  { workspace: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export type SocialClientDoc = InferSchemaType<typeof socialClientSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SocialClientModel: Model<SocialClientDoc> =
  (db.models.SocialClient as Model<SocialClientDoc>) ??
  db.model<SocialClientDoc>("SocialClient", socialClientSchema);

const socialPostSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "SocialClient",
      required: true,
      index: true,
    },
    /**
     * `yyyy-MM-dd`, not a Date.
     *
     * A post is scheduled for a day, not an instant. Stored as a string so the
     * day it lands on is the day everyone typed, whatever timezone their
     * machine is set to — and so a month query is a plain string range rather
     * than an arithmetic problem about midnight.
     */
    scheduledFor: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    heading: {
      type: String,
      required: true,
      trim: true,
      maxlength: SOCIAL_LIMITS.heading,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: SOCIAL_LIMITS.caption,
      default: "",
    },
    format: { type: String, enum: CONTENT_FORMATS, required: true },
    /** A link to a post to imitate, or a written note. Free text either way. */
    reference: {
      type: String,
      trim: true,
      maxlength: SOCIAL_LIMITS.reference,
      default: null,
    },
    stage: {
      type: String,
      enum: POST_STAGES,
      required: true,
      default: "planned",
    },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** When the designer handed it back, and who did. Cleared on a step back. */
    readyAt: { type: Date, default: null },
    readyBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "social_post", timestamps: true },
);

// The month query: one workspace, a date range, in the order a day is read.
socialPostSchema.index({ workspace: 1, scheduledFor: 1 });
// The designer's own queue, across every client.
socialPostSchema.index({ assignee: 1, stage: 1, scheduledFor: 1 });

export type SocialPostDoc = InferSchemaType<typeof socialPostSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SocialPostModel: Model<SocialPostDoc> =
  (db.models.SocialPost as Model<SocialPostDoc>) ??
  db.model<SocialPostDoc>("SocialPost", socialPostSchema);
