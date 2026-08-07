import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";

import { DEFAULT_USER_ROLE } from "@/lib/auth/roles";
import { mongoClient, mongoDb } from "@/lib/db/client";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";

/**
 * The first account created becomes the admin.
 *
 * Without this there is no path to an admin at all: `role` is `input: false`,
 * so nothing can be promoted from the outside, and every role-gated action
 * would be permanently unreachable. Counting is safe here because this runs
 * inside user creation, before the new document is written.
 */
async function resolveRoleForNewUser(): Promise<string> {
  const existingUsers = await mongoDb
    .collection("user")
    .countDocuments({}, { limit: 1 });

  return existingUsers === 0 ? "admin" : DEFAULT_USER_ROLE;
}

/**
 * Rejects accounts outside the configured company domains.
 *
 * Applied at the database layer rather than in a form handler so it covers
 * every entry point equally — including any OAuth provider added later, whose
 * callback also creates a user. With ALLOWED_EMAIL_DOMAINS unset this is a
 * no-op and anyone who reaches the sign-up page can register.
 */
function assertEmailDomainAllowed(email: string): void {
  if (env.allowedEmailDomains.length === 0) {
    return;
  }

  const domain = email.split("@").at(-1)?.toLowerCase();

  if (!domain || !env.allowedEmailDomains.includes(domain)) {
    throw new APIError("FORBIDDEN", {
      message: "That email address is not permitted to access this workspace.",
    });
  }
}

export const auth = betterAuth({
  appName: "DG Clicks",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  /**
   * The `baseURL` origin is trusted automatically; this adds the ones a
   * deployment actually answers on. On Vercel that is what lets a preview build
   * sign in at all, since `BETTER_AUTH_URL` has to stay pointed at production
   * for invite and reset links to be usable. Empty everywhere else.
   */
  trustedOrigins: env.deploymentOrigins,

  /**
   * Passing `client` alongside the database enables multi-document
   * transactions. Available here because Atlas runs as a replica set.
   */
  database: mongodbAdapter(mongoDb, { client: mongoClient }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Scheduling after the response prevents email delivery time from
      // revealing whether an account exists, while Next keeps the invocation
      // alive long enough for Resend to finish.
      after(async () => {
        try {
          await sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl: url,
          });
        } catch (error) {
          console.error("[email] failed to send password reset", error);
        }
      });
    },
    // Drops the user straight into the app after sign-up rather than bouncing
    // them to the sign-in form to retype what they just entered.
    autoSignIn: true,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: DEFAULT_USER_ROLE,
        // Critical: without this a crafted sign-up request could set its own
        // role. Roles are only ever changed server-side.
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      // Session reads hit a signed cookie instead of the database on every
      // navigation. Trade-off: a role change takes up to this long to take
      // effect. Acceptable for an internal tool; revisit if that changes.
      maxAge: 5 * 60,
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertEmailDomainAllowed(user.email);

          return { data: { ...user, role: await resolveRoleForNewUser() } };
        },
      },
    },
  },

  advanced: {
    useSecureCookies: env.isProduction,
  },

  // Wraps responses so server actions can set auth cookies.
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"]["session"];
export type SessionUser = Auth["$Infer"]["Session"]["user"];
