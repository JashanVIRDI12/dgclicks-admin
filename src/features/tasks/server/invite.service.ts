import "server-only";

import { randomBytes } from "node:crypto";

import { Types } from "mongoose";

import {
  WorkspaceInviteModel,
  WorkspaceModel,
  type WorkspaceInviteDoc,
} from "@/features/tasks/server/models";
import { assertWorkspaceManager } from "@/features/tasks/server/workspace.service";
import type { WorkspaceInvite } from "@/features/tasks/types";
import { connectToDatabase } from "@/lib/db/connect";
import { env } from "@/lib/env";
import { NotFoundError, ValidationError } from "@/lib/errors";

/** 32 bytes of entropy, url-safe. Long enough that guessing is not a threat. */
function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function isLive(invite: WorkspaceInviteDoc, now = new Date()): boolean {
  return !invite.revokedAt && (!invite.expiresAt || invite.expiresAt > now);
}

function toInvite(invite: WorkspaceInviteDoc): WorkspaceInvite {
  return {
    id: invite._id.toString(),
    url: inviteUrl(invite.token),
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    useCount: invite.useCount ?? 0,
    createdAt: invite.createdAt.toISOString(),
  };
}

/**
 * The link an admin copies.
 *
 * Built from `BETTER_AUTH_URL` rather than the request, because an invite is
 * pasted into a chat and opened somewhere else entirely — a link carrying
 * whatever `Host` header the admin's browser happened to send is how these end
 * up pointing at `localhost`.
 */
export function inviteUrl(token: string): string {
  return new URL(`/invite/${token}`, env.BETTER_AUTH_URL).toString();
}

/**
 * Managers only, not every member: a live invite URL contains the token, and
 * the token is the credential. Listing them to anyone who can read the
 * workspace would hand out the ability to invite without the right to.
 */
export async function listWorkspaceInvites(
  workspaceId: string,
  actorId: string,
): Promise<WorkspaceInvite[]> {
  await connectToDatabase();
  await assertWorkspaceManager(workspaceId, actorId);

  const invites = await WorkspaceInviteModel.find({
    workspace: workspaceId,
    revokedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean<WorkspaceInviteDoc[]>();

  return invites.filter((invite) => isLive(invite)).map(toInvite);
}

export async function createWorkspaceInvite(
  workspaceId: string,
  actorId: string,
  expiresInDays: number | null,
): Promise<WorkspaceInvite> {
  await connectToDatabase();
  await assertWorkspaceManager(workspaceId, actorId);

  const created = await WorkspaceInviteModel.create({
    workspace: new Types.ObjectId(workspaceId),
    token: createToken(),
    expiresAt:
      expiresInDays === null
        ? null
        : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1_000),
    createdBy: new Types.ObjectId(actorId),
  });

  return toInvite(created.toObject() as WorkspaceInviteDoc);
}

export async function revokeWorkspaceInvite(
  inviteId: string,
  actorId: string,
): Promise<void> {
  await connectToDatabase();

  const invite = await WorkspaceInviteModel.findById(inviteId).lean<WorkspaceInviteDoc>();

  if (!invite) {
    throw new NotFoundError("That invite link no longer exists.");
  }

  await assertWorkspaceManager(invite.workspace.toString(), actorId);

  await WorkspaceInviteModel.updateOne(
    { _id: inviteId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export type InvitePreview = {
  workspaceName: string;
  /** The reader is already in this workspace; there is nothing to accept. */
  isAlreadyMember: boolean;
};

/**
 * What the invite page shows before anyone commits to joining.
 *
 * Returns `null` for a token that is unknown, revoked or expired — the page
 * cannot tell those apart, and neither should the reader: distinguishing them
 * turns the page into an oracle for which tokens once existed.
 */
export async function previewInvite(
  token: string,
  userId: string,
): Promise<InvitePreview | null> {
  await connectToDatabase();

  const invite = await WorkspaceInviteModel.findOne({
    token,
  }).lean<WorkspaceInviteDoc>();

  if (!invite || !isLive(invite)) {
    return null;
  }

  const workspace = await WorkspaceModel.findById(invite.workspace)
    .select("name members")
    .lean<{ name: string; members: Types.ObjectId[] }>();

  if (!workspace) {
    return null;
  }

  return {
    workspaceName: workspace.name,
    isAlreadyMember: (workspace.members ?? []).some(
      (member) => member.toString() === userId,
    ),
  };
}

/**
 * Redeems an invite.
 *
 * `$addToSet` rather than a read-modify-write: two people opening the same link
 * at the same moment would otherwise each write a members array built from the
 * state they read, and the second would erase the first. Validity is re-checked
 * inside the same call that redeems, so a link revoked between the preview and
 * the click does not still let someone in.
 */
export async function acceptWorkspaceInvite(
  token: string,
  userId: string,
): Promise<{ workspaceId: string; workspaceName: string }> {
  await connectToDatabase();

  const invite = await WorkspaceInviteModel.findOne({
    token,
  }).lean<WorkspaceInviteDoc>();

  if (!invite || !isLive(invite)) {
    throw new ValidationError("That invite link is no longer valid.");
  }

  const workspace = await WorkspaceModel.findByIdAndUpdate(
    invite.workspace,
    { $addToSet: { members: new Types.ObjectId(userId) } },
    { returnDocument: "after" },
  )
    .select("_id name")
    .lean<{ _id: Types.ObjectId; name: string }>();

  if (!workspace) {
    throw new NotFoundError("That workspace no longer exists.");
  }

  await WorkspaceInviteModel.updateOne(
    { _id: invite._id },
    { $inc: { useCount: 1 } },
  );

  return {
    workspaceId: workspace._id.toString(),
    workspaceName: workspace.name,
  };
}
