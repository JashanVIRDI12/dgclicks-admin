/**
 * Role vocabulary for the app.
 *
 * Deliberately minimal: a single role string on the user, enforced by
 * `requireRole()` on the server. The Permissions module will layer Better
 * Auth's access-control plugin (`better-auth/plugins/access`) on top of these
 * same role names, so nothing here has to be renamed when it lands.
 */
export const USER_ROLES = ["admin", "member"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_USER_ROLE: UserRole = "member";

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && USER_ROLES.includes(value as UserRole)
  );
}

/** Narrows an unknown role off a session into a valid one. */
export function toUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : DEFAULT_USER_ROLE;
}
