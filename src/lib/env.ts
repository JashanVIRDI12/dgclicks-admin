import "server-only";

import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * Parsed once at module load so a missing or malformed variable fails the boot
 * with a readable message, rather than surfacing as `undefined` deep inside a
 * request. Guarded by `server-only`: importing this from a client component is
 * a build error, so secrets can never reach the browser bundle.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    MONGODB_URI: z
      .string()
      .min(1)
      .refine((value) => value.startsWith("mongodb"), {
        message: "must be a mongodb:// or mongodb+srv:// connection string",
      }),
    /** Optional: falls back to the database encoded in MONGODB_URI. */
    MONGODB_DB_NAME: z.string().min(1).optional(),

    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "must be at least 32 characters (openssl rand -base64 32)"),
    BETTER_AUTH_URL: z.url(
      "must be an absolute URL, e.g. http://localhost:3000",
    ),

    /** Optional together; password-reset UI is disabled until both are set. */
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().min(3).max(320).optional(),

    /** Optional together; the workspace assistant stays hidden until configured. */
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().min(1).optional(),

  /**
   * Comma-separated list of email domains permitted to hold an account, e.g.
   * "dgclicks.com,contractor.dgclicks.com". Applies to every sign-up route.
   * Leave empty to allow any domain.
   */
    ALLOWED_EMAIL_DOMAINS: z.string().optional(),

    /**
     * Injected by Vercel, never set by hand. Hostnames only, no protocol.
     *
     * `VERCEL_URL` is the immutable per-deployment host, `VERCEL_BRANCH_URL` the
     * alias that follows a branch — a preview is usually opened through the
     * second, so trusting only the first still locks previews out.
     */
    VERCEL_URL: z.string().min(1).optional(),
    VERCEL_BRANCH_URL: z.string().min(1).optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.RESEND_API_KEY) !== Boolean(value.RESEND_FROM_EMAIL)) {
      context.addIssue({
        code: "custom",
        path: [value.RESEND_API_KEY ? "RESEND_FROM_EMAIL" : "RESEND_API_KEY"],
        message: "must be set together with the other Resend variable",
      });
    }

    if (Boolean(value.OPENROUTER_API_KEY) !== Boolean(value.OPENROUTER_MODEL)) {
      context.addIssue({
        code: "custom",
        path: [
          value.OPENROUTER_API_KEY
            ? "OPENROUTER_MODEL"
            : "OPENROUTER_API_KEY",
        ],
        message: "must be set together with the other OpenRouter variable",
      });
    }
  });

/**
 * Treats an empty or whitespace-only variable as absent.
 *
 * A `.env` file has no way to express "unset" other than `FOO=""`, and Zod's
 * `.optional()` only accepts `undefined` — so an optional variable left blank
 * in .env.local must be normalised here or it fails validation.
 */
function optionalVar(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB_NAME: optionalVar(process.env.MONGODB_DB_NAME),
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  RESEND_API_KEY: optionalVar(process.env.RESEND_API_KEY),
  RESEND_FROM_EMAIL: optionalVar(process.env.RESEND_FROM_EMAIL),
  OPENROUTER_API_KEY: optionalVar(process.env.OPENROUTER_API_KEY),
  OPENROUTER_MODEL: optionalVar(process.env.OPENROUTER_MODEL),
  ALLOWED_EMAIL_DOMAINS: optionalVar(process.env.ALLOWED_EMAIL_DOMAINS),
  VERCEL_URL: optionalVar(process.env.VERCEL_URL),
  VERCEL_BRANCH_URL: optionalVar(process.env.VERCEL_BRANCH_URL),
  VERCEL_PROJECT_PRODUCTION_URL: optionalVar(
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ),
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(
    `Invalid environment configuration:\n${details}\n\nCopy .env.example to .env.local and fill in the missing values.`,
  );
}

const raw = parsed.data;

const allowedEmailDomains = (raw.ALLOWED_EMAIL_DOMAINS ?? "")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

/**
 * Origins Better Auth will accept a request from, beyond `BETTER_AUTH_URL`.
 *
 * `BETTER_AUTH_URL` has to name the production domain — invite links and
 * password-reset emails are built from it and get opened somewhere else
 * entirely. That leaves every preview deployment answering on a host the origin
 * check does not recognise, so sign-in fails on previews only. Listing the
 * deployment's own hosts fixes that without trusting `*.vercel.app`, which
 * anyone can deploy under.
 */
const deploymentOrigins = [
  raw.VERCEL_URL,
  raw.VERCEL_BRANCH_URL,
  raw.VERCEL_PROJECT_PRODUCTION_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`)
  .filter((origin, index, origins) => origins.indexOf(origin) === index);

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === "production",
  isDevelopment: raw.NODE_ENV === "development",
  isEmailEnabled: Boolean(raw.RESEND_API_KEY && raw.RESEND_FROM_EMAIL),
  isAssistantEnabled: Boolean(
    raw.OPENROUTER_API_KEY && raw.OPENROUTER_MODEL,
  ),
  /** Normalised allowlist; empty array means "any domain". */
  allowedEmailDomains,
  /** Extra origins Better Auth trusts. Empty off Vercel. */
  deploymentOrigins,
} as const;
