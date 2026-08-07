import type { Route } from "next";

export const DEFAULT_CALLBACK_URL = "/dashboard" satisfies Route;

/**
 * Reduces an untrusted `callbackUrl` to a safe same-origin path.
 *
 * The value arrives from the query string, so without this a crafted link like
 * `/sign-in?callbackUrl=https://evil.example` would hand an attacker an open
 * redirect off a page users are trained to trust. Only root-relative paths are
 * allowed through; `//host` is rejected because browsers read it as
 * protocol-relative and would leave the origin.
 *
 * Returns `Route` so callers can pass the result to `router.push`. The cast is
 * deliberate and lives here alone: a value that arrives at runtime cannot be
 * checked against the generated route union, and this function is the point at
 * which it is proven safe.
 */
export function sanitizeCallbackUrl(value: string | string[] | undefined): Route {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\")
  ) {
    return DEFAULT_CALLBACK_URL;
  }

  return candidate as Route;
}
