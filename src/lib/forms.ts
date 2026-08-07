import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionResult } from "@/types";

type ActionFailure = Extract<ActionResult<unknown>, { ok: false }>;

/**
 * Pushes a failed action's field errors back into the form.
 *
 * Returns the message that could not be attached to a field, so the caller can
 * surface it as a toast or inline alert. This is what closes the loop on
 * server-side validation: the server rejects, and the user sees it on the exact
 * field that was wrong rather than a generic banner.
 */
export function applyActionErrors<TValues extends FieldValues>(
  failure: ActionFailure,
  setError: UseFormSetError<TValues>,
  knownFields: readonly Path<TValues>[],
): string | null {
  const fieldErrors = failure.fieldErrors;

  if (!fieldErrors) {
    return failure.error;
  }

  let attachedAny = false;

  for (const field of knownFields) {
    const messages = fieldErrors[field];

    if (messages?.length) {
      setError(field, { type: "server", message: messages[0] });
      attachedAny = true;
    }
  }

  // Errors on keys the form does not render (or a form-level `root` issue)
  // would otherwise vanish silently.
  return attachedAny ? null : failure.error;
}
