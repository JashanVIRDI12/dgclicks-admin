import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

/**
 * Every Better Auth endpoint — sign-in, sign-up, session, and the callbacks of
 * any provider added later — is served from this catch-all.
 */
export const { GET, POST } = toNextJsHandler(auth);
