/**
 * Errors that are safe to show a user.
 *
 * Anything thrown that is not an `AppError` is treated as a bug: the API and
 * action layers log it server-side and return a generic message, so internals
 * never leak to the client.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = new.target.name;
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "internal_error";
  }
}

/** No valid session. The caller should sign in. */
export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to do that.") {
    super(message, { status: 401, code: "unauthorized" });
  }
}

/** Authenticated, but not allowed. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do that.") {
    super(message, { status: 403, code: "forbidden" });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, { status: 404, code: "not_found" });
  }
}

/** Input failed server-side validation. `fieldErrors` maps to form fields. */
export class ValidationError extends AppError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(
    message = "Please check the highlighted fields.",
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message, { status: 422, code: "validation_error" });
    this.fieldErrors = fieldErrors;
  }
}

/** A valid request that conflicts with current state, e.g. a duplicate email. */
export class ConflictError extends AppError {
  constructor(message = "That conflicts with something that already exists.") {
    super(message, { status: 409, code: "conflict" });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Narrows an unknown throw into a message safe for the client. Unknown errors
 * are logged here so the detail is not lost when it is replaced.
 */
export function toPublicError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  console.error("[unhandled]", error);
  return new AppError("Something went wrong. Please try again.");
}
