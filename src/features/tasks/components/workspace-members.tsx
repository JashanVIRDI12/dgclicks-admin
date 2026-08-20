"use client";

import { PencilIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setWorkspaceMembersAction } from "@/features/tasks/actions/workspace.actions";
import { WorkspaceAddMembers } from "@/features/tasks/components/workspace-add-members";
import { WorkspaceFormDialog } from "@/features/tasks/components/workspace-form-dialog";
import { WorkspacePermissionsDialog } from "@/features/tasks/components/workspace-permissions-dialog";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import type { Workspace } from "@/features/tasks/types";

/**
 * Who is in the workspace, and which of them run it.
 *
 * Only its own members are listed. Showing every account in the app turned this
 * into a directory of the whole company that happened to have tick boxes, which
 * made "who is in this workspace" the hard question to answer on the screen that
 * exists to answer it. People come in through an invite link instead — the list
 * below is a record, not a picker.
 */
export function WorkspaceMembers({
  workspace,
  currentUserId,
  canManage,
}: {
  workspace: Workspace;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);

  const managerIds = new Set([workspace.createdById, ...workspace.managerIds]);

  function remove(userId: string) {
    startTransition(async () => {
      const result = await setWorkspaceMembersAction({
        id: workspace.id,
        memberIds: workspace.members
          .map((member) => member.id)
          .filter((id) => id !== userId),
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
      <section className="card-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-medium">{workspace.name}</h2>
          <span className="text-xs text-muted-foreground">
            {workspace.members.length}{" "}
            {workspace.members.length === 1 ? "member" : "members"}
          </span>

          {canManage ? (
            <div className="ml-auto flex items-center gap-1">
              <WorkspaceAddMembers workspace={workspace} />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground"
                onClick={() => setPermissionsOpen(true)}
              >
                <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
                Permissions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-muted-foreground"
                onClick={() => setRenameOpen(true)}
              >
                <PencilIcon className="size-3.5" aria-hidden="true" />
                Rename
              </Button>
            </div>
          ) : null}
        </div>

        <ul className="space-y-0.5">
          {workspace.members.map((member) => {
            const isSelf = member.id === currentUserId;

            return (
              <li
                key={member.id}
                className="group/member flex items-center gap-2.5 rounded-lg px-2 py-1.5"
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

                {managerIds.has(member.id) ? (
                  <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                    Manager
                  </span>
                ) : null}

                {/*
                  Removal is its own button rather than the row itself. When the
                  list was a picker, clicking a row toggled membership; now that
                  every row is already a member, the only thing a click could do
                  is remove somebody, and that is not a thing to trip over.
                */}
                {canManage && !isSelf ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name} from ${workspace.name}`}
                    disabled={isPending}
                    onClick={() => remove(member.id)}
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/member:opacity-100 focus-visible:opacity-100"
                  >
                    <XIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {canManage ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Add people who already have an account above, or share an invite
            link below with someone who does not. Removing a member also drops
            any workspace management they had.
          </p>
        ) : null}
      </section>

      {canManage ? (
        <>
          <WorkspaceFormDialog
            open={isRenameOpen}
            onOpenChange={setRenameOpen}
            workspace={workspace}
          />

          <WorkspacePermissionsDialog
            workspace={workspace}
            currentUserId={currentUserId}
            open={isPermissionsOpen}
            onOpenChange={setPermissionsOpen}
          />
        </>
      ) : null}
    </>
  );
}
