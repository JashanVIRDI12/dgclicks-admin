import "server-only";

import { Types } from "mongoose";

import { USER_SUMMARY_SELECT } from "@/features/auth/server/serialize";
import { UserModel } from "@/features/auth/server/user.model";
import {
  POST_PAGE_LIMIT,
  type ContentFormat,
  type PostStage,
} from "@/features/social/constants";
import {
  SocialClientModel,
  SocialPostModel,
  type SocialClientDoc,
  type SocialPostDoc,
} from "@/features/social/server/models";
import {
  toSocialClient,
  toSocialPost,
} from "@/features/social/server/serialize";
import type {
  SocialCalendar,
  SocialClient,
  SocialPost,
} from "@/features/social/types";
import type { LabelColor } from "@/features/tasks/constants";
import { assertWorkspaceMember } from "@/features/tasks/server/workspace.service";
import { connectToDatabase } from "@/lib/db/connect";
import { NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Reads and writes for the social calendar.
 *
 * Access is workspace membership and nothing finer. There are no private posts
 * and no per-client permissions: an agency's social team all work on all of it,
 * and inventing a second permission model here would be a setting nobody asked
 * for that could only ever hide work from a colleague.
 *
 * Every function still proves membership itself. A guarded page protects the
 * page, not the actions it calls.
 */

const POST_POPULATE = [
  { path: "assignee", select: USER_SUMMARY_SELECT },
  { path: "readyBy", select: USER_SUMMARY_SELECT },
  { path: "createdBy", select: USER_SUMMARY_SELECT },
];

export async function listClients(
  workspaceId: string,
  userId: string,
): Promise<SocialClient[]> {
  await assertWorkspaceMember(workspaceId, userId);

  const docs = await SocialClientModel.find({
    workspace: workspaceId,
    archivedAt: null,
  })
    .collation({ locale: "en", strength: 2 })
    .sort({ name: 1 })
    .lean<SocialClientDoc[]>();

  return docs.map(toSocialClient);
}

/**
 * One month of posting.
 *
 * The range is a string comparison because `scheduledFor` is a `yyyy-MM-dd`
 * string — which sorts lexicographically in date order, so `$gte`/`$lte` on the
 * first and last day of the month is an index scan and not a conversion.
 */
export async function getCalendar(
  workspaceId: string,
  userId: string,
  range: { from: string; to: string },
): Promise<SocialCalendar> {
  await assertWorkspaceMember(workspaceId, userId);
  await connectToDatabase();

  const [clients, posts] = await Promise.all([
    SocialClientModel.find({ workspace: workspaceId, archivedAt: null })
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 })
      .lean<SocialClientDoc[]>(),
    SocialPostModel.find({
      workspace: workspaceId,
      scheduledFor: { $gte: range.from, $lte: range.to },
    })
      .populate(POST_POPULATE)
      .sort({ scheduledFor: 1, createdAt: 1 })
      .limit(POST_PAGE_LIMIT)
      .lean<SocialPostDoc[]>(),
  ]);

  return {
    clients: clients.map(toSocialClient),
    posts: posts.map(toSocialPost),
  };
}

export async function createClient(
  workspaceId: string,
  input: { name: string; handle: string | null; color: LabelColor },
  userId: string,
): Promise<SocialClient> {
  await assertWorkspaceMember(workspaceId, userId);
  await connectToDatabase();

  const duplicate = await SocialClientModel.findOne({
    workspace: workspaceId,
    name: input.name,
    archivedAt: null,
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (duplicate) {
    throw new ValidationError("That client already exists.", {
      name: ["A client with that name is already on this calendar."],
    });
  }

  const created = await SocialClientModel.create({
    workspace: new Types.ObjectId(workspaceId),
    name: input.name,
    handle: input.handle,
    color: input.color,
    createdBy: new Types.ObjectId(userId),
  });

  return toSocialClient(created.toObject<SocialClientDoc>());
}

/**
 * Retires a client without deleting their history.
 *
 * Their posts stay exactly where they are. Deleting a year of a client's
 * calendar because the retainer ended is a data loss dressed up as tidying, and
 * an archived client is still the answer to "what did we post for them".
 */
export async function archiveClient(
  workspaceId: string,
  clientId: string,
  userId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, userId);
  await connectToDatabase();

  const updated = await SocialClientModel.findOneAndUpdate(
    { _id: clientId, workspace: workspaceId },
    { archivedAt: new Date() },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That client no longer exists.");
  }
}

/** Proves a post belongs to a workspace the caller is in. */
export async function assertPostAccess(
  postId: string,
  userId: string,
): Promise<SocialPostDoc> {
  await connectToDatabase();

  const post = await SocialPostModel.findById(postId).lean<SocialPostDoc>();

  if (!post) {
    throw new NotFoundError("That post no longer exists.");
  }

  await assertWorkspaceMember(post.workspace.toString(), userId);

  return post;
}

async function assertClientInWorkspace(
  workspaceId: string,
  clientId: string,
): Promise<void> {
  const client = await SocialClientModel.findOne({
    _id: clientId,
    workspace: workspaceId,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!client) {
    throw new ValidationError("Choose a client on this calendar.", {
      clientId: ["That client is not on this calendar."],
    });
  }
}

async function assertAssigneeExists(assigneeId: string): Promise<void> {
  if (!(await UserModel.exists({ _id: assigneeId }))) {
    throw new ValidationError("Choose an existing person.", {
      assigneeId: ["That person no longer exists."],
    });
  }
}

export type PostInput = {
  clientId: string;
  scheduledFor: string;
  heading: string;
  caption: string;
  format: ContentFormat;
  reference: string | null;
  stage: PostStage;
  assigneeId: string | null;
};

export async function createPost(
  workspaceId: string,
  input: PostInput,
  userId: string,
): Promise<SocialPost> {
  await assertWorkspaceMember(workspaceId, userId);
  await connectToDatabase();
  await assertClientInWorkspace(workspaceId, input.clientId);

  if (input.assigneeId) {
    await assertAssigneeExists(input.assigneeId);
  }

  const isReady = input.stage === "ready" || input.stage === "posted";

  const created = await SocialPostModel.create({
    workspace: new Types.ObjectId(workspaceId),
    client: new Types.ObjectId(input.clientId),
    scheduledFor: input.scheduledFor,
    heading: input.heading,
    caption: input.caption,
    format: input.format,
    reference: input.reference,
    stage: input.stage,
    assignee: input.assigneeId ? new Types.ObjectId(input.assigneeId) : null,
    // A post written straight into Ready was made by somebody, and leaving the
    // hand-off blank would show it as ready with nobody having said so.
    readyAt: isReady ? new Date() : null,
    readyBy: isReady ? new Types.ObjectId(userId) : null,
    createdBy: new Types.ObjectId(userId),
  });

  return getPostById(created.id as string);
}

export async function getPostById(id: string): Promise<SocialPost> {
  await connectToDatabase();

  const doc = await SocialPostModel.findById(id)
    .populate(POST_POPULATE)
    .lean<SocialPostDoc>();

  if (!doc) {
    throw new NotFoundError("That post no longer exists.");
  }

  return toSocialPost(doc);
}

/**
 * A patch, not a replacement. Absent keys are left alone; `null` clears.
 *
 * The hand-off timestamps are derived rather than accepted from the caller, so
 * "who marked this ready" is always somebody who actually pressed the button.
 */
export async function updatePost(
  id: string,
  patch: Partial<PostInput>,
  userId: string,
): Promise<SocialPost> {
  const existing = await assertPostAccess(id, userId);
  const workspaceId = existing.workspace.toString();

  if (patch.clientId !== undefined) {
    await assertClientInWorkspace(workspaceId, patch.clientId);
  }

  if (patch.assigneeId) {
    await assertAssigneeExists(patch.assigneeId);
  }

  const update: Record<string, unknown> = {};

  if (patch.clientId !== undefined) {
    update.client = new Types.ObjectId(patch.clientId);
  }

  if (patch.scheduledFor !== undefined) {
    update.scheduledFor = patch.scheduledFor;
  }

  if (patch.heading !== undefined) update.heading = patch.heading;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.format !== undefined) update.format = patch.format;
  if (patch.reference !== undefined) update.reference = patch.reference;

  if (patch.assigneeId !== undefined) {
    update.assignee = patch.assigneeId
      ? new Types.ObjectId(patch.assigneeId)
      : null;
  }

  if (patch.stage !== undefined) {
    update.stage = patch.stage;

    const reached = patch.stage === "ready" || patch.stage === "posted";
    const alreadyRecorded = existing.readyAt !== null;

    if (reached && !alreadyRecorded) {
      update.readyAt = new Date();
      update.readyBy = new Types.ObjectId(userId);
    }

    // Sent back to the designer: the hand-off has not happened, so the credit
    // for it should not still be sitting on the post.
    if (!reached && alreadyRecorded) {
      update.readyAt = null;
      update.readyBy = null;
    }
  }

  const updated = await SocialPostModel.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That post no longer exists.");
  }

  return getPostById(id);
}

export async function deletePost(id: string, userId: string): Promise<void> {
  await assertPostAccess(id, userId);
  await SocialPostModel.deleteOne({ _id: id });
}
