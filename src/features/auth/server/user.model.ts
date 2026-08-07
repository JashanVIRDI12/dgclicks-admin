import "server-only";

import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";

import { db } from "@/lib/db/connect";

/**
 * Read-only Mongoose view of Better Auth's `user` collection.
 *
 * Better Auth owns this collection and its shape — `strict: false` means new
 * fields it adds do not need mirroring here. This model exists so other
 * features can `populate()` owners and authors in a single round trip, and so
 * `ref: "User"` resolves. Never write through it; user records are created and
 * updated by Better Auth alone.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    image: { type: String },
    role: { type: String },
  },
  { collection: "user", timestamps: false, strict: false },
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};

export const UserModel: Model<UserDoc> =
  (db.models.User as Model<UserDoc>) ?? db.model<UserDoc>("User", userSchema);
