import "server-only";

import { cookies } from "next/headers";

import { listWorkspacesForUser } from "@/features/tasks/server/workspace.service";
import type { Workspace } from "@/features/tasks/types";
import { env } from "@/lib/env";

/**
 * Which workspace the index pages are showing.
 *
 * Held in a cookie rather than the URL. A `/w/[slug]/…` prefix would be more
 * explicit, but it would also thread a segment through every `<Link>`, every
 * generated `PageProps<"/route">` and every `revalidatePath` in the app — and
 * boards are globally unique by id, so `/boards/[boardId]` already resolves
 * correctly whichever workspace is active. Only the index pages read this.
 *
 * The trade-off it leaves: a board belonging to a non-active workspace opens
 * fine but is absent from the sidebar. The board page says so rather than
 * switching silently, which render-time cookie rules would forbid anyway.
 */
export const ACTIVE_WORKSPACE_COOKIE = "dgclicks.workspace";

export const ACTIVE_WORKSPACE_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  // Matches the auth cookies, which take `secure` from the same condition.
  // Not conditional on anything else: in development the app is served over
  // http://localhost and a secure-only cookie would never be sent back.
  secure: env.isProduction,
  maxAge: 60 * 60 * 24 * 365,
} as const;

export type ActiveWorkspaceContext = {
  workspaces: Workspace[];
  /** Null only when the user belongs to no workspace at all. */
  active: Workspace | null;
};

/**
 * Resolves the active workspace, always against the caller's own memberships.
 *
 * The cookie is untrusted input like anything else from a browser: a value the
 * user is not a member of falls back to their first workspace rather than
 * leaking someone else's boards.
 */
export async function getActiveWorkspaceContext(
  userId: string,
): Promise<ActiveWorkspaceContext> {
  const [workspaces, cookieStore] = await Promise.all([
    listWorkspacesForUser(userId),
    cookies(),
  ]);

  const requestedId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active =
    workspaces.find((workspace) => workspace.id === requestedId) ??
    workspaces[0] ??
    null;

  return { workspaces, active };
}
