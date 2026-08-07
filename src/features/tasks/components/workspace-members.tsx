"use client";

import { CheckIcon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { UserSummary } from "@/features/auth/types";
import { setWorkspaceMembersAction } from "@/features/tasks/actions/workspace.actions";
import { WorkspaceFormDialog } from "@/features/tasks/components/workspace-form-dialog";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import type { Workspace } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Who is in the workspace.
 *
 * Membership is what board access is derived from — there is no per-board
 * permission — so this list is the whole access-control surface, and it is
 * deliberately visible rather than buried behind an admin screen.
 */
export function WorkspaceMembers({
  workspace,
  teamMembers,
  currentUserId,
  canManage,
}: {
  workspace: Workspace;
  teamMembers: UserSummary[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRenameOpen, setRenameOpen] = useState(false);

  const memberIds = new Set(workspace.members.map((member) => member.id));

  function toggle(userId: string) {
    if (userId === currentUserId) {
      toast.error("You cannot remove yourself from a workspace you are in.");
      return;
    }

    const next = memberIds.has(userId)
      ? [...memberIds].filter((id) => id !== userId)
      : [...memberIds, userId];

    startTransition(async () => {
      const result = await setWorkspaceMembersAction({
        id: workspace.id,
        memberIds: next,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <section className="rounded-2xl bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium">{workspace.name}</h2>
          <span className="text-xs text-muted-foreground">
            {workspace.members.length}{" "}
            {workspace.members.length === 1 ? "member" : "members"}
          </span>

          {canManage ? (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-muted-foreground"
              onClick={() => setRenameOpen(true)}
            >
              <PencilIcon className="size-3.5" aria-hidden="true" />
              Rename
            </Button>
          ) : null}
        </div>

        <ul className="space-y-0.5">
          {teamMembers.map((member) => {
            const isMember = memberIds.has(member.id);
            const isSelf = member.id === currentUserId;

            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggle(member.id)}
                  disabled={isPending || isSelf || !canManage}
                  aria-pressed={isMember}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                    isSelf || !canManage
                      ? "cursor-default"
                      : "hover:bg-accent/60 disabled:opacity-60",
                  )}
                >
                  <AssigneeAvatar user={member} className="size-6" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {member.name}
                      {isSelf ? (
                        <span className="text-muted-foreground"> (you)</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>

                  {isMember ? (
                    <CheckIcon
                      className="size-4 shrink-0 text-foreground"
                      aria-hidden="true"
                    />
                  ) : canManage ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      Add
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {canManage ? (
        <WorkspaceFormDialog
          open={isRenameOpen}
          onOpenChange={setRenameOpen}
          workspace={workspace}
        />
      ) : null}
    </>
  );
}
