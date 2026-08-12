"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveWorkspaceAction } from "@/features/tasks/actions/workspace.actions";
import { WorkspaceFormDialog } from "@/features/tasks/components/workspace-form-dialog";
import type { Workspace } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Picks which workspace the index pages show.
 *
 * The choice is a cookie written by a server action, not client state, because
 * the pages that honour it render on the server — so switching has to round
 * trip. `router.refresh()` is what re-renders them once the cookie is set.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
  isCollapsed,
}: {
  workspaces: Workspace[];
  activeId: string | null;
  isCollapsed: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setCreateOpen] = useState(false);

  const active = workspaces.find((workspace) => workspace.id === activeId);

  function handleSelect(id: string) {
    if (id === activeId) {
      return;
    }

    startTransition(async () => {
      const result = await setActiveWorkspaceAction({ id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Everything TanStack is holding was fetched while a different workspace
      // was active — board snapshots, task drawers, palette search results.
      // None of it is necessarily wrong, but "necessarily" is doing too much
      // work there, and a switch is rare enough that refetching from scratch
      // costs nothing worth protecting.
      queryClient.clear();
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            disabled={isPending}
            aria-label={
              active ? `Workspace: ${active.name}` : "Choose a workspace"
            }
            className={cn(
              "h-9 w-full justify-start gap-2 px-2 font-medium",
              isCollapsed && "justify-center px-0",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[0.6875rem] font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {(active?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>

            {!isCollapsed ? (
              <>
                <span className="flex-1 truncate text-left text-sm">
                  {active?.name ?? "No workspace"}
                </span>
                <ChevronsUpDownIcon
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </>
            ) : null}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>

          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={() => handleSelect(workspace.id)}
              className="gap-2"
            >
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === activeId ? (
                <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" aria-hidden="true" />
            New workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WorkspaceFormDialog open={isCreateOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
