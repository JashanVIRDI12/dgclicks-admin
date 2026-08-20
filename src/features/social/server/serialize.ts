import "server-only";

import type { Types } from "mongoose";

import { toUserSummary } from "@/features/auth/server/serialize";
import type {
  ContentFormat,
  PostStage,
} from "@/features/social/constants";
import type { SocialClient, SocialPost } from "@/features/social/types";
import type { LabelColor } from "@/features/tasks/constants";
import { toIdString } from "@/lib/db/serialize";

/** One place where an ObjectId becomes a string, as in every other module. */

type ClientSource = {
  _id: Types.ObjectId;
  workspace: unknown;
  name: string;
  handle?: string | null;
  color: string;
  archivedAt?: Date | null;
  createdAt: Date;
};

export function toSocialClient(doc: ClientSource): SocialClient {
  return {
    id: doc._id.toString(),
    workspaceId: toIdString(doc.workspace),
    name: doc.name,
    handle: doc.handle ?? null,
    color: doc.color as LabelColor,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  };
}

type PostSource = {
  _id: Types.ObjectId;
  workspace: unknown;
  client: unknown;
  scheduledFor: string;
  heading: string;
  caption?: string | null;
  format: string;
  reference?: string | null;
  stage: string;
  assignee?: unknown;
  readyAt?: Date | null;
  readyBy?: unknown;
  createdBy?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export function toSocialPost(doc: PostSource): SocialPost {
  return {
    id: doc._id.toString(),
    workspaceId: toIdString(doc.workspace),
    clientId: toIdString(doc.client),
    scheduledFor: doc.scheduledFor,
    heading: doc.heading,
    caption: doc.caption ?? "",
    format: doc.format as ContentFormat,
    reference: doc.reference ?? null,
    stage: doc.stage as PostStage,
    assignee: toUserSummary(doc.assignee as Parameters<typeof toUserSummary>[0]),
    readyAt: doc.readyAt ? doc.readyAt.toISOString() : null,
    readyBy: toUserSummary(doc.readyBy as Parameters<typeof toUserSummary>[0]),
    createdBy: toUserSummary(
      doc.createdBy as Parameters<typeof toUserSummary>[0],
    ),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
