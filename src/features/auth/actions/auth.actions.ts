"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { toAuthError } from "@/features/auth/server/auth-error";
import {
  changePasswordSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas/auth.schema";
import { createAction } from "@/lib/actions/create-action";
import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Email/password sign-in.
 *
 * Runs through `createAction` so the payload is re-validated server-side
 * against the same schema the form uses — the browser can post anything, this
 * is the check that counts. The session cookie is set by the `nextCookies`
 * plugin as the response unwinds.
 *
 * Navigation is left to the caller rather than calling `redirect()` here:
 * `redirect` works by throwing, which the factory's error boundary would
 * swallow and report as a failure.
 */
export const signInAction = createAction({
  auth: false,
  input: signInSchema,
  handler: async ({ input }) => {
    try {
      await auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: await headers(),
      });
    } catch (error) {
      throw toAuthError(error);
    }
  },
});

/**
 * Email/password sign-up. `autoSignIn` in the auth config means a successful
 * registration leaves the user signed in.
 *
 * Note there is no `role` in the payload: it is declared `input: false` on the
 * server, so it cannot be set from here even if a caller tried.
 */
export const signUpAction = createAction({
  auth: false,
  input: signUpSchema,
  handler: async ({ input }) => {
    try {
      await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
        headers: await headers(),
      });
    } catch (error) {
      throw toAuthError(error);
    }
  },
});

export const requestPasswordResetAction = createAction({
  auth: false,
  input: requestPasswordResetSchema,
  handler: async ({ input }) => {
    if (!env.isEmailEnabled) {
      throw new AppError("Password reset email is not configured yet.", {
        status: 503,
        code: "email_not_configured",
      });
    }

    try {
      await auth.api.requestPasswordReset({
        body: {
          email: input.email,
          redirectTo: new URL("/reset-password", env.BETTER_AUTH_URL).href,
        },
        headers: await headers(),
      });
    } catch (error) {
      throw toAuthError(error);
    }
  },
});

export const resetPasswordAction = createAction({
  auth: false,
  input: resetPasswordSchema,
  handler: async ({ input }) => {
    try {
      await auth.api.resetPassword({
        body: { token: input.token, newPassword: input.newPassword },
        headers: await headers(),
      });
    } catch (error) {
      throw toAuthError(error);
    }
  },
});

export const changePasswordAction = createAction({
  auth: true,
  input: changePasswordSchema,
  handler: async ({ input }) => {
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (error) {
      throw toAuthError(error);
    }
  },
});

/**
 * Clears the session and returns to sign-in.
 *
 * A plain action rather than a `createAction`: there is no input to validate,
 * and `redirect()` must be able to throw past the caller uninterrupted.
 */
export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
