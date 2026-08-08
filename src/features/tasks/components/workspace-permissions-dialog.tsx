"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setWorkspaceManagersAction } from "@/features/tasks/actions/workspace.actions";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import type { Workspace } from "@/features/tasks/types";

/**
 * Who administers the workspace.
 *
 * Only its members are listed, because managing a workspace you cannot open is
 * a setting with no effect — bringing someone in comes first, from the members
 * list behind this dialog.
 *
 * Two rows are fixed rather than hidden: the creator, who manages it by having
 * made it, and whoever is looking, who cannot demote themselves out of this
 * screen. Showing them ticked and disabled explains the rule; leaving them out
 * would just look like a list that forgot somebody.
 */
export function WorkspacePermissionsDialog({
  workspace,
  currentUserId,
  open,
  onOpenChange,
}: {
  workspace: Workspace;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [managerIds, setManagerIds] = useState(workspace.managerIds);

  function toggle(userId: string) {
    setManagerIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await setWorkspaceManagersAction({
        id: workspace.id,
        managerIds,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      toast.success("Workspace permissions updated.");
      router.refresh();
    });
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);

    if (!next) {
      setManagerIds(workspace.managerIds);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workspace permissions</DialogTitle>
          <DialogDescription>
            Managers run this workspace: its name, its people, its invite links,
            its boards and their permissions — and they can delete the whole
            workspace. Everyone else works inside it normally. Administrators
            always manage it, whether or not they are listed here.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-subtle max-h-72 space-y-1 overflow-y-auto rounded-xl bg-surface p-1.5">
          {workspace.members.map((member) => {
            const isCreator = member.id === workspace.createdById;
            const isSelf = member.id === currentUserId;
            const isFixed = isCreator || isSelf;
            const checked = isFixed || managerIds.includes(member.id);

            return (
              <label
                key={member.id}
                className={
                  isFixed
                    ? "flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                    : "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60"
                }
              >
                <Checkbox
                  checked={checked}
                  disabled={isFixed}
                  onCheckedChange={() => toggle(member.id)}
                />
                <AssigneeAvatar user={member} className="size-6" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{member.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </span>
                {isFixed ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {isCreator ? "Creator" : "You"}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
