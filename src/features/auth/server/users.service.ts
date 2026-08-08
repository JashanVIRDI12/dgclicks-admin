import "server-only";

import { UserModel, type UserDoc } from "@/features/auth/server/user.model";
import { connectToDatabase } from "@/lib/db/connect";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Everyone with an account, for owner and assignee pickers.
 *
 * There is no separate "team" concept — this is a single-company workspace, so
 * having an account is what makes someone a team member.
 */
export async function listTeamMembers(): Promise<TeamMember[]> {
  await connectToDatabase();

  const docs = await UserModel.find()
    .select("name email image")
    .sort({ name: 1 })
    .lean<UserDoc[]>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    image: doc.image ?? null,
  }));
}

/**
 * Whether an account holds the global administrator role.
 *
 * Read from the database rather than from a session, because the resource
 * checks in the data layer run deep below the action that has the session in
 * hand — and because a role revoked five minutes ago should take effect on the
 * next request rather than the next sign-in.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  await connectToDatabase();

  return Boolean(await UserModel.exists({ _id: userId, role: "admin" }));
}
