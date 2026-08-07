"use client";

import { Loader2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Submit button with a built-in pending state.
 *
 * Stays enabled-looking but disabled while in flight, and swaps in a spinner
 * rather than changing width, so the layout does not shift on submit.
 */
export function SubmitButton({
  isPending,
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & {
  isPending: boolean;
  pendingLabel?: string;
  children: ReactNode;
}) {
  return (
    <Button type="submit" disabled={isPending} aria-busy={isPending} {...props}>
      {isPending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
