import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth/auth";
import { toUserRole, type UserRole } from "@/lib/auth/roles";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * Reads the current session.
 *
 * Wrapped in React's `cache` so a layout, a page and a component in the same
 * render all share one lookup instead of repeating it.
 */
export const getSession = cache(
  async (): Promise<AuthenticatedSession | null> => {
    return auth.api.getSession({ headers: await headers() });
  },
);

/**
 * For pages and layouts: redirects to sign-in when there is no session.
 *
 * `callbackUrl` is not threaded through here — the proxy already records where
 * the user was heading. This is the fallback for direct navigation.
 */
export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

/**
 * For server actions and route handlers: throws instead of redirecting, so the
 * caller returns a proper 401 rather than an HTML redirect to a fetch client.
 *
 * Call this in every action. A guarded layout protects the page it renders, not
 * the actions that page invokes.
 */
export async function requireSessionOrThrow(): Promise<AuthenticatedSession> {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

export function getSessionRole(session: AuthenticatedSession): UserRole {
  return toUserRole((session.user as { role?: unknown }).role);
}

/**
 * Coarse role check for actions and route handlers. Resource-level checks in
 * the data layer still run afterwards for the specific workspace or board.
 */
export async function requireRole(
  ...allowed: readonly UserRole[]
): Promise<AuthenticatedSession> {
  const session = await requireSessionOrThrow();

  if (!allowed.includes(getSessionRole(session))) {
    throw new ForbiddenError();
  }

  return session;
}
