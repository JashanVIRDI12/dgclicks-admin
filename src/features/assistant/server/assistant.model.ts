import "server-only";

import { Schema, type Model, type Types } from "mongoose";

import { db } from "@/lib/db/connect";

// Registration side effect for the user reference.
import "@/features/auth/server/user.model";

export type AssistantToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type AssistantStoredMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls: AssistantToolCall[];
  toolCallId: string | null;
  createdAt: Date;
};

export type AssistantPendingConfirmation = {
  id: string;
  toolCallId: string;
  toolName: string;
  arguments: string;
  title: string;
  description: string;
  confirmLabel: string;
  createdAt: Date;
};

export type AssistantThreadDoc = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  context: {
    workspaceId: string | null;
    boardId: string | null;
    pathname: string;
  };
  messages: AssistantStoredMessage[];
  pendingConfirmation: AssistantPendingConfirmation | null;
  createdAt: Date;
  updatedAt: Date;
};

const toolCallSchema = new Schema<AssistantToolCall>(
  {
    id: { type: String, required: true, maxlength: 200 },
    name: { type: String, required: true, maxlength: 100 },
    arguments: { type: String, required: true, maxlength: 30_000 },
  },
  { _id: false },
);

const messageSchema = new Schema<AssistantStoredMessage>(
  {
    id: { type: String, required: true, maxlength: 100 },
    role: {
      type: String,
      enum: ["user", "assistant", "tool"],
      required: true,
    },
    content: { type: String, default: null, maxlength: 30_000 },
    toolCalls: { type: [toolCallSchema], default: [] },
    toolCallId: { type: String, default: null, maxlength: 200 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const pendingConfirmationSchema = new Schema<AssistantPendingConfirmation>(
  {
    id: { type: String, required: true, maxlength: 100 },
    toolCallId: { type: String, required: true, maxlength: 200 },
    toolName: { type: String, required: true, maxlength: 100 },
    arguments: { type: String, required: true, maxlength: 30_000 },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 1_000 },
    confirmLabel: { type: String, required: true, maxlength: 100 },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const assistantThreadSchema = new Schema<AssistantThreadDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, maxlength: 100 },
    context: {
      workspaceId: { type: String, default: null, maxlength: 24 },
      boardId: { type: String, default: null, maxlength: 24 },
      pathname: { type: String, required: true, maxlength: 500 },
    },
    messages: { type: [messageSchema], default: [] },
    pendingConfirmation: { type: pendingConfirmationSchema, default: null },
  },
  { collection: "assistant_threads", timestamps: true },
);

assistantThreadSchema.index({ user: 1, updatedAt: -1 });

export const AssistantThreadModel: Model<AssistantThreadDoc> =
  (db.models.AssistantThread as Model<AssistantThreadDoc>) ??
  db.model<AssistantThreadDoc>("AssistantThread", assistantThreadSchema);
