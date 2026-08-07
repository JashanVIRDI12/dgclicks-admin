import "server-only";

import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
} from "@/features/activity/constants";
import { db } from "@/lib/db/connect";

// Registration side effect: `ref: "User"` cannot resolve without it.
import "@/features/auth/server/user.model";

const activitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    entityType: { type: String, enum: ACTIVITY_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    /** Snapshot of the record's name; see `entityLabel` in types.ts. */
    entityLabel: { type: String, required: true, maxlength: 200 },

    /** Routing anchor for the board feed and every deep link. */
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },

    context: {
      type: {
        type: String,
        enum: ACTIVITY_ENTITIES,
      },
      id: { type: Schema.Types.ObjectId },
      label: { type: String, maxlength: 200 },
    },

    changes: [
      {
        _id: false,
        field: { type: String, required: true },
        from: { type: String, default: null },
        to: { type: String, default: null },
      },
    ],
  },
  // Only `createdAt` — an audit entry that can be updated is not an audit entry.
  { collection: "activity", timestamps: { createdAt: true, updatedAt: false } },
);

// The global feed.
activitySchema.index({ createdAt: -1 });
// One board's feed, including everything nested under it.
activitySchema.index({ board: 1, createdAt: -1 });
// A single record's timeline, and the same for anything nested under it.
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activitySchema.index({ "context.id": 1, createdAt: -1 });

export type ActivityDoc = InferSchemaType<typeof activitySchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};

export const ActivityModel: Model<ActivityDoc> =
  (db.models.Activity as Model<ActivityDoc>) ??
  db.model<ActivityDoc>("Activity", activitySchema);
