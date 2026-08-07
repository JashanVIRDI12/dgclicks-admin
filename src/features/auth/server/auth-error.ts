import "server-only";

import { isAPIError } from "better-auth/api";

import {
  AppError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

/**
 * Translates a Better Auth `APIError` into our error hierarchy.
 *
 * Without this the action layer would see an unrecognised throw and replace it
 * with "Something went wrong", losing messages like "Invalid email or password"
 * that the user actually needs. Better Auth's own messages are user-facing, so
 * they are passed through rather than rewritten.
 */
export function toAuthError(error: unknown): AppError {
  if (!isAPIError(error)) {
    return error instanceof AppError
      ? error
      : new AppError("Something went wrong. Please try again.");
  }

  const message = error.body?.message ?? "Authentication failed.";

  switch (error.statusCode) {
    case 400:
    case 422:
      return new ValidationError(message);
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 409:
      return new ConflictError(message);
    default:
      return new AppError(message, {
        status: error.statusCode,
        code: error.body?.code ?? "auth_error",
      });
  }
}
