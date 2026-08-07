"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary. Next.js replaces the message with an opaque digest in
 * production, so the digest is shown — it is the only handle for finding the
 * real stack in server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          An unexpected error occurred. Trying again often resolves it.
        </p>
        {error.digest ? (
          <p className="pt-2 font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        ) : null}
      </div>

      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
