import { NextResponse } from "next/server";

import { toPublicError, ValidationError } from "@/lib/errors";
import type { ApiResult } from "@/types";

/** Success envelope. */
export function apiOk<TData>(data: TData, status = 200) {
  return NextResponse.json<ApiResult<TData>>({ ok: true, data }, { status });
}

/**
 * Failure envelope. Anything that is not an `AppError` is logged and replaced
 * with a generic message, so stack traces and driver errors never reach the
 * client.
 */
export function apiFail(error: unknown) {
  const appError = toPublicError(error);

  return NextResponse.json<ApiResult<never>>(
    {
      ok: false,
      error: appError.message,
      code: appError.code,
      ...(appError instanceof ValidationError
        ? { fieldErrors: appError.fieldErrors }
        : {}),
    },
    { status: appError.status },
  );
}
