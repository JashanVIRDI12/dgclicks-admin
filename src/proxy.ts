import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Network-boundary redirects only. Replaces `middleware.ts`, removed in
 * Next.js 16.
 *
 * This is an OPTIMISTIC check: it looks for the presence of a session cookie,
 * never for a valid one. It does not read the database, and a forged cookie
 * gets past it. That is deliberate — this layer exists so signed-out users land
 * on the sign-in page instead of a flash of empty chrome.
 *
 * Real enforcement lives in two places that cannot be bypassed:
 *   1. `app/(app)/layout.tsx`, which validates the session server-side.
 *   2. `requireSessionOrThrow()` in every server action and route handler.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSessionCookie ? "/dashboard" : "/sign-in", request.url),
    );
  }

  const isAuthRoute = [
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  if (isAuthRoute) {
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    // Preserve where they were going so sign-in can return them there.
    signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except API routes (they authenticate themselves and must return
   * JSON, not a redirect), Next internals, and static files.
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
