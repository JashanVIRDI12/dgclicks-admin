import "server-only";

import { Types } from "mongoose";

import { ActivityModel } from "@/features/activity/server/activity.model";
import { USER_SUMMARY_SELECT } from "@/features/auth/server/serialize";
import { UserModel } from "@/features/auth/server/user.model";
import {
  isAdminUser,
  listTeamMembers,
  type TeamMember,
} from "@/features/auth/server/users.service";
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

function isWorkspaceManager(workspace: WorkspaceDoc, userId: string): boolean {
  return (
    workspace.createdBy.toString() === userId ||
    (workspace.managers ?? []).some(
      (managerId) => managerId.toString() === userId,
    )
  );
}

/**
 * Management access for a workspace.
 *
 * `assertWorkspaceMember` proves someone may work *inside* a workspace; this
 * proves they may change the workspace itself. Keeping the two apart is the
 * whole point of the permission: every member can move cards, but renaming the
 * workspace or deciding who is in it is a smaller circle.
 *
 * Returns the document so callers do not read it twice.
 */
export async function assertWorkspaceManager(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceDoc> {
  await connectToDatabase();

  const workspace = await WorkspaceModel.findById(workspaceId).lean<WorkspaceDoc>();
  const isMember = (workspace?.members ?? []).some(
    (memberId) => memberId.toString() === userId,
  );

  if (!workspace || !isMember) {
    throw new ForbiddenError("You do not have access to that workspace.");
  }

  // The role check is last because it is the only one that costs a query, and
  // the creator and listed managers are already in hand.
  if (isWorkspaceManager(workspace, userId) || (await isAdminUser(userId))) {
    return workspace;
  }

  throw new ForbiddenError(
    "Only a manager of this workspace can change that.",
  );
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

/**
 * Accounts that could join this workspace but have not.
 *
 * An invite link is the right answer for someone who has never signed in. For
 * someone who already has an account it is the long way round — they follow a
 * URL to be told they are already registered — so a manager can add them
 * directly instead.
 *
 * Every account is returned rather than a server-side search, because the whole
 * list is one small query and filtering it in the browser is what makes typing
 * a name feel instant. If this ever grows past a few hundred accounts it should
 * become a query with a term; until then a round trip per keystroke would be
 * slower for no benefit.
 */
export async function listAddableUsers(
  workspaceId: string,
): Promise<TeamMember[]> {
  await connectToDatabase();

  const workspace = await WorkspaceModel.findById(workspaceId)
    .select("members")
    .lean<{ members?: Types.ObjectId[] }>();

  if (!workspace) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  const members = new Set((workspace.members ?? []).map((id) => id.toString()));

  return (await listTeamMembers()).filter((user) => !members.has(user.id));
}

/**
 * Adds people without touching anyone already in.
 *
 * Deliberately not `setWorkspaceMembers` with the existing ids appended: that
 * sends the whole list, so two managers adding someone at the same moment would
 * each overwrite the other's addition with the list they loaded. `$addToSet`
 * has no such window and is idempotent, which also makes adding someone who
 * joined via a link a no-op rather than an error.
 */
export async function addWorkspaceMembers(
  id: string,
  memberIds: string[],
): Promise<Workspace> {
  await connectToDatabase();

  const uniqueIds = [...new Set(memberIds)];

  if (uniqueIds.length === 0) {
    return getWorkspaceById(id);
  }

  const found = await UserModel.countDocuments({ _id: { $in: uniqueIds } });

  if (found !== uniqueIds.length) {
    throw new ValidationError("Please check the selected people.", {
      memberIds: ["One or more of those people no longer exist."],
    });
  }

  const updated = await WorkspaceModel.findByIdAndUpdate(
    id,
    {
      $addToSet: {
        members: {
          $each: uniqueIds.map((memberId) => new Types.ObjectId(memberId)),
        },
      },
    },
    { new: true },
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

  const existing = await WorkspaceModel.findById(id)
    .select("managers")
    .lean<{ managers?: Types.ObjectId[] }>();

  if (!existing) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  const remaining = new Set(uniqueIds);

  const updated = await WorkspaceModel.findByIdAndUpdate(
    id,
    {
      // The actor stays a member whatever the form said. Removing yourself from
      // the workspace you are editing locks you out of your own boards, and the
      // recovery path is a database edit.
      members: uniqueIds.map((memberId) => new Types.ObjectId(memberId)),
      // Removing someone drops their management too. A manager id left behind
      // for a non-member is a promotion waiting to be handed back silently the
      // day anyone re-adds them.
      managers: (existing.managers ?? []).filter((managerId) =>
        remaining.has(managerId.toString()),
      ),
    },
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
 * Replaces the manager list.
 *
 * A manager has to be a member first — administration of a workspace someone
 * cannot open is a setting with no effect — and the actor keeps the role
 * whatever the form said, for the same reason `setWorkspaceMembers` keeps them
 * a member: demoting yourself out of the screen you are standing on leaves a
 * database edit as the way back.
 */
export async function setWorkspaceManagers(
  id: string,
  managerIds: string[],
  actorId: string,
): Promise<Workspace> {
  await connectToDatabase();

  const workspace = await WorkspaceModel.findById(id)
    .select("members")
    .lean<{ members: Types.ObjectId[] }>();

  if (!workspace) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  const memberIds = new Set(
    (workspace.members ?? []).map((memberId) => memberId.toString()),
  );
  const uniqueIds = [...new Set([...managerIds, actorId])];

  if (uniqueIds.some((managerId) => !memberIds.has(managerId))) {
    throw new ValidationError("Managers have to be members of the workspace.", {
      managerIds: ["Add them to the workspace before making them a manager."],
    });
  }

  const updated = await WorkspaceModel.findByIdAndUpdate(
    id,
    { managers: uniqueIds.map((managerId) => new Types.ObjectId(managerId)) },
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
