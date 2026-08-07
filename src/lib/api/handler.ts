import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

import {
  getSessionRole,
  requireSessionOrThrow,
  type AuthenticatedSession,
} from "@/features/auth/server/session";
import { apiFail, apiOk } from "@/lib/api/response";
import type { UserRole } from "@/lib/auth/roles";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { parseInput } from "@/lib/validation";

/** `false` = public, `true` = any signed-in user, array = those roles only. */
type AuthMode = boolean | readonly UserRole[];

type RouteParams = { params: Promise<Record<string, string | string[]>> };

type HandlerContext<TAuth extends AuthMode, TSchema> = {
  readonly request: NextRequest;
  readonly params: Promise<Record<string, string | string[]>>;
  readonly session: TAuth extends false ? null : AuthenticatedSession;
  readonly input: TSchema extends z.ZodType ? z.infer<TSchema> : undefined;
};

/**
 * Wraps a route handler with the three things every endpoint needs: an auth
 * check, server-side validation, and an error boundary that maps `AppError`s to
 * status codes while hiding everything else.
 *
 * The `session` field is typed non-nullable whenever `auth` is not `false`, so
 * a protected route cannot forget to handle the signed-out case.
 */
export function withRoute<
  const TAuth extends AuthMode,
  TSchema extends z.ZodType | undefined = undefined,
  TData = unknown,
>(config: {
  auth: TAuth;
  input?: TSchema;
  /** Where to read `input` from. Defaults to the JSON body. */
  from?: "json" | "query";
  handler: (context: HandlerContext<TAuth, TSchema>) => Promise<TData>;
}) {
  return async function route(
    request: NextRequest,
    context?: RouteParams,
  ): Promise<NextResponse> {
    try {
      let session: AuthenticatedSession | null = null;

      if (config.auth !== false) {
        session = await requireSessionOrThrow();

        if (Array.isArray(config.auth) && !config.auth.includes(getSessionRole(session))) {
          throw new ForbiddenError();
        }
      }

      let input: unknown;

      if (config.input) {
        input = parseInput(config.input, await readInput(request, config.from));
      }

      const data = await config.handler({
        request,
        params: context?.params ?? Promise.resolve({}),
        session,
        input,
      } as HandlerContext<TAuth, TSchema>);

      return apiOk(data);
    } catch (error) {
      return apiFail(error);
    }
  };
}

async function readInput(
  request: NextRequest,
  from: "json" | "query" = "json",
): Promise<unknown> {
  if (from === "query") {
    return Object.fromEntries(request.nextUrl.searchParams);
  }

  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
