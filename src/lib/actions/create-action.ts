import "server-only";

import type { z } from "zod";

import {
  getSessionRole,
  requireSessionOrThrow,
  type AuthenticatedSession,
} from "@/features/auth/server/session";
import type { UserRole } from "@/lib/auth/roles";
import { ForbiddenError, toPublicError, ValidationError } from "@/lib/errors";
import { parseInput } from "@/lib/validation";
import type { ActionResult } from "@/types";

/** `false` = public, `true` = any signed-in user, array = those roles only. */
type AuthMode = boolean | readonly UserRole[];

type ActionContext<TAuth extends AuthMode, TInput> = {
  readonly input: TInput;
  readonly session: TAuth extends false ? null : AuthenticatedSession;
};

/**
 * Builds a server action with auth, validation and error handling applied in
 * that order.
 *
 * Two properties matter here:
 *
 * 1. Input is re-parsed against the same Zod schema the form uses. The client
 *    can post anything it likes; this is the boundary that decides.
 * 2. The action resolves to an `ActionResult` rather than throwing. A thrown
 *    error crossing the server-action boundary reaches the browser as an opaque
 *    digest, which is useless to a form. Returning a discriminated union lets
 *    the caller branch, and hands `fieldErrors` straight to `setError`.
 */
export function createAction<
  const TAuth extends AuthMode,
  TSchema extends z.ZodType,
  TData = void,
>(config: {
  auth: TAuth;
  input: TSchema;
  handler: (
    context: ActionContext<TAuth, z.infer<TSchema>>,
  ) => Promise<TData>;
}): (input: unknown) => Promise<ActionResult<TData>> {
  return async function action(rawInput: unknown): Promise<ActionResult<TData>> {
    try {
      let session: AuthenticatedSession | null = null;

      if (config.auth !== false) {
        session = await requireSessionOrThrow();

        if (
          Array.isArray(config.auth) &&
          !config.auth.includes(getSessionRole(session))
        ) {
          throw new ForbiddenError();
        }
      }

      const input = parseInput(config.input, rawInput);

      const data = await config.handler({ input, session } as ActionContext<
        TAuth,
        z.infer<TSchema>
      >);

      return { ok: true, data };
    } catch (error) {
      const appError = toPublicError(error);

      return {
        ok: false,
        error: appError.message,
        code: appError.code,
        ...(appError instanceof ValidationError
          ? { fieldErrors: appError.fieldErrors }
          : {}),
      };
    }
  };
}
