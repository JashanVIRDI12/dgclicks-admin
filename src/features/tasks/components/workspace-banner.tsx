"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setActiveWorkspaceAction } from "@/features/tasks/actions/workspace.actions";
import type { Workspace } from "@/features/tasks/types";

/**
 * Shown when the board being viewed belongs to a workspace that is not the
 * active one.
 *
 * The board itself opens fine — boards are unique by id — but the sidebar is
 * showing a different workspace's list, which is confusing without an
 * explanation. Switching is offered rather than done automatically: a cookie
 * cannot be written during a server render, and silently changing what every
 * other page shows because someone followed one link is worse behaviour anyway.
 */
export function WorkspaceBanner({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-4 py-2.5 text-sm">
      <p className="text-muted-foreground">
        This board lives in{" "}
        <span className="font-medium text-foreground">{workspace.name}</span>.
      </p>

      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-7"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setActiveWorkspaceAction({ id: workspace.id });

            if (!result.ok) {
              toast.error(result.error);
              return;
            }

            router.refresh();
          })
        }
      >
        Switch to it
      </Button>
    </div>
  );
}
