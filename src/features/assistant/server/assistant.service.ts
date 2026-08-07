import "server-only";

import { randomUUID } from "node:crypto";

import { Types } from "mongoose";

import {
  AssistantThreadModel,
  type AssistantStoredMessage,
  type AssistantThreadDoc,
} from "@/features/assistant/server/assistant.model";
import type { AssistantThreadView } from "@/features/assistant/types";
import { connectToDatabase } from "@/lib/db/connect";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";

const MAX_CONTEXT_MESSAGES = 80;
const REQUESTS_PER_MINUTE = 12;

export async function getLatestAssistantThread(
  userId: string,
): Promise<AssistantThreadDoc | null> {
  await connectToDatabase();

  return AssistantThreadModel.findOne({ user: userId })
    .sort({ updatedAt: -1 })
    .lean<AssistantThreadDoc>();
}

export async function getAssistantThread(
  threadId: string,
  userId: string,
): Promise<AssistantThreadDoc> {
  await connectToDatabase();

  const thread = await AssistantThreadModel.findOne({
    _id: threadId,
    user: userId,
  }).lean<AssistantThreadDoc>();

  if (!thread) {
    throw new NotFoundError("That assistant conversation no longer exists.");
  }

  return thread;
}

export async function createAssistantThread(
  userId: string,
  firstMessage: string,
  context: AssistantThreadDoc["context"],
): Promise<AssistantThreadDoc> {
  await connectToDatabase();

  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 72);
  const created = await AssistantThreadModel.create({
    user: userId,
    title,
    context,
    messages: [],
    pendingConfirmation: null,
  });

  return created.toObject() as AssistantThreadDoc;
}

export async function saveAssistantThread(
  thread: AssistantThreadDoc,
): Promise<AssistantThreadDoc> {
  await connectToDatabase();

  const messages = trimMessages(thread.messages);
  const updated = await AssistantThreadModel.findOneAndUpdate(
    { _id: thread._id, user: thread.user },
    {
      $set: {
        messages,
        context: thread.context,
        pendingConfirmation: thread.pendingConfirmation,
      },
    },
    { new: true },
  ).lean<AssistantThreadDoc>();

  if (!updated) {
    throw new NotFoundError("That assistant conversation no longer exists.");
  }

  return updated;
}

export async function claimAssistantConfirmation(
  threadId: string,
  userId: string,
  confirmationId: string,
): Promise<AssistantThreadDoc> {
  await connectToDatabase();

  const claimed = await AssistantThreadModel.findOneAndUpdate(
    {
      _id: threadId,
      user: userId,
      "pendingConfirmation.id": confirmationId,
    },
    { $set: { pendingConfirmation: null } },
    { new: false },
  ).lean<AssistantThreadDoc>();

  if (!claimed?.pendingConfirmation) {
    throw new ConflictError("That confirmation is no longer pending.");
  }

  return claimed;
}

export function appendAssistantMessage(
  thread: AssistantThreadDoc,
  message: Omit<AssistantStoredMessage, "id" | "createdAt">,
): void {
  thread.messages.push({
    ...message,
    id: randomUUID(),
    createdAt: new Date(),
  });
}

export async function assertAssistantRateLimit(userId: string): Promise<void> {
  await connectToDatabase();

  const since = new Date(Date.now() - 60_000);
  const result = await AssistantThreadModel.aggregate<{ count: number }>([
    { $match: { user: new Types.ObjectId(userId) } },
    { $unwind: "$messages" },
    {
      $match: {
        "messages.role": "user",
        "messages.createdAt": { $gte: since },
      },
    },
    { $count: "count" },
  ]);

  if ((result[0]?.count ?? 0) >= REQUESTS_PER_MINUTE) {
    throw new AppError("Please wait a moment before asking the assistant again.", {
      status: 429,
      code: "rate_limited",
    });
  }
}

export function assertNoPendingConfirmation(thread: AssistantThreadDoc): void {
  if (thread.pendingConfirmation) {
    throw new ConflictError(
      "Confirm or cancel the pending action before sending another message.",
    );
  }
}

export function toAssistantThreadView(
  thread: AssistantThreadDoc,
): AssistantThreadView {
  return {
    id: thread._id.toString(),
    title: thread.title,
    messages: thread.messages.flatMap((message) => {
      if (
        (message.role !== "user" && message.role !== "assistant") ||
        !message.content
      ) {
        return [];
      }

      return [
        {
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        },
      ];
    }),
    pendingConfirmation: thread.pendingConfirmation
      ? {
          id: thread.pendingConfirmation.id,
          title: thread.pendingConfirmation.title,
          description: thread.pendingConfirmation.description,
          confirmLabel: thread.pendingConfirmation.confirmLabel,
        }
      : null,
  };
}

function trimMessages(
  messages: AssistantStoredMessage[],
): AssistantStoredMessage[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) {
    return messages;
  }

  const minimumStart = messages.length - MAX_CONTEXT_MESSAGES;
  const firstUser = messages.findIndex(
    (message, index) => index >= minimumStart && message.role === "user",
  );

  return messages.slice(firstUser === -1 ? minimumStart : firstUser);
}
