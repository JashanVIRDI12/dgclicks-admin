"use client";

import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth/auth";
import { inferAdditionalFields } from "better-auth/client/plugins";

/**
 * Browser-side auth client.
 *
 * No `baseURL`: it defaults to the current origin, so the same build works on
 * localhost, previews and production without a NEXT_PUBLIC_* variable.
 *
 * `inferAdditionalFields` carries the server's `user.additionalFields` (the
 * `role` field) into the client's session types, so `session.user.role` is
 * typed rather than `any`.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
