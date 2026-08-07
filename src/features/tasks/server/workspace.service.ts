import "server-only";

import { Types } from "mongoose";

import { ActivityModel } from "@/features/activity/server/activity.model";
import { USER_SUMMARY_SELECT } from "@/features/auth/server/serialize";
import { UserModel } from "@/features/auth/server/user.model";
import { deleteWorkspaceBoards } from "@/features/tasks/server/deletion.service";
import {
  WorkspaceModel,
  type WorkspaceDoc,
} from "@/features/tasks/server/models";
import { toWorkspace } from "@/features/tasks/server/serialize";
import type { Workspace } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const MEMBERS_POPULATE = {
  path: "members",
  select: USER_SUMMARY_SELECT,
} as const;

/**
 * Turns a name into a URL-safe slug.
 *
 * Kept even though the slug is not in any route today: it is the stable,
 * human-readable handle a workspace is identified by in the switcher and in
 * support conversations, and generating it at creation time means it never has
 * to be back-filled.
 */
function toSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Strip the combining marks NFKD just separated out, so "Réseau" becomes
      // "reseau" rather than losing the letter entirely.
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "workspace"
  );
}

/**
 * Finds a slug nobody is using.
 *
 * Loops rather than trusting a single check because the unique index is the
 * real arbiter and two people can create "Marketing" at the same moment; the
 * bounded retry keeps that from becoming an unhandled duplicate-key error.
 */
async function uniqueSlug(name: string): Promise<string> {
  const base = toSlug(name);

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;

    if (!(await WorkspaceModel.exists({ slug: candidate }))) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function listWorkspacesForUser(
  userId: string,
): Promise<Workspace[]> {
  await connectToDatabase();

  const docs = await WorkspaceModel.find({ members: userId })
    .populate(MEMBERS_POPULATE)
    .sort({ createdAt: 1 })
    .lean<WorkspaceDoc[]>();

  return docs.map(toWorkspace);
}

export async function getWorkspaceById(id: string): Promise<Workspace> {
  await connectToDatabase();

  const doc = await WorkspaceModel.findById(id)
    .populate(MEMBERS_POPULATE)
    .lean<WorkspaceDoc>();

  if (!doc) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  return toWorkspace(doc);
}

/**
 * The resource-level authorisation check every board and task operation runs
 * through.
 *
 * `createAction` proves who is calling; this proves they are allowed to touch
 * *this* record. Without it any signed-in user could pass another workspace's id
 * and edit boards they cannot see.
 */
export async function assertWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await connectToDatabase();

  const isMember = await WorkspaceModel.exists({
    _id: workspaceId,
    members: userId,
  });

  if (!isMember) {
    // Deliberately the same error as a genuine denial rather than a 404: which
    // workspace ids exist is not something a non-member should be able to probe.
    throw new ForbiddenError("You do not have access to that workspace.");
  }
}

export async function createWorkspace(
  input: { name: string },
  createdById: string,
): Promise<Workspace> {
  await connectToDatabase();

  const created = await WorkspaceModel.create({
    name: input.name,
    slug: await uniqueSlug(input.name),
    members: [new Types.ObjectId(createdById)],
    createdBy: new Types.ObjectId(createdById),
  });

  return getWorkspaceById(created._id.toString());
}

export async function updateWorkspace(
  id: string,
  input: { name: string },
): Promise<Workspace> {
  await connectToDatabase();

  const updated = await WorkspaceModel.findByIdAndUpdate(
    id,
    { name: input.name },
    { new: true, runValidators: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  return getWorkspaceById(id);
}

export async function setWorkspaceMembers(
  id: string,
  memberIds: string[],
  actorId: string,
): Promise<Workspace> {
  await connectToDatabase();

  const uniqueIds = [...new Set([...memberIds, actorId])];
  const found = await UserModel.countDocuments({ _id: { $in: uniqueIds } });

  if (found !== uniqueIds.length) {
    throw new ValidationError("Please check the selected people.", {
      memberIds: ["One or more of those people no longer exist."],
    });
  }

  const updated = await WorkspaceModel.findByIdAndUpdate(
    id,
    // The actor stays a member whatever the form said. Removing yourself from
    // the workspace you are editing locks you out of your own boards, and the
    // recovery path is a database edit.
    { members: uniqueIds.map((memberId) => new Types.ObjectId(memberId)) },
    { new: true, runValidators: true },
  )
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  if (!updated) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  return getWorkspaceById(id);
}

/**
 * Permanently removes a workspace and every board, task, discussion and file
 * inside it. The name is checked again here, from the database, so bypassing
 * the client dialog cannot turn this into a one-click destructive endpoint.
 */
export async function deleteWorkspace(
  id: string,
  confirmation: string,
): Promise<void> {
  await connectToDatabase();

  const workspace = await WorkspaceModel.findById(id)
    .select("name")
    .lean<{ name: string }>();

  if (!workspace) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  if (confirmation !== workspace.name) {
    throw new ValidationError("Type the workspace name exactly to confirm.", {
      confirmation: ["The name does not match this workspace."],
    });
  }

  await deleteWorkspaceBoards(id);

  const workspaceObjectId = new Types.ObjectId(id);

  await ActivityModel.deleteMany({
    $or: [
      { entityType: "workspace", entityId: workspaceObjectId },
      { "context.id": workspaceObjectId },
    ],
  });

  const deleted = await WorkspaceModel.deleteOne({ _id: id });

  if (deleted.deletedCount !== 1) {
    throw new NotFoundError("That workspace no longer exists.");
  }
}
