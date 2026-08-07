"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { UserSummary } from "@/features/auth/types";
import {
  deleteBoardAction,
  setBoardArchivedAction,
} from "@/features/tasks/actions/board.actions";
import { BoardFormDialog } from "@/features/tasks/components/board-form-dialog";
import { BoardPermissionsDialog } from "@/features/tasks/components/board-permissions-dialog";
import type { Board } from "@/features/tasks/types";

/**
 * Everything you can do to a board itself.
 *
 * Archive is the everyday action and sits first; deleting takes the columns,
 * cards, comments and files with it, which is why it is admin-only and why the
 * confirmation makes you type the name rather than click once.
 */
export function BoardMenu({
  board,
  taskCount,
  isAdmin,
  canEdit,
  members,
}: {
  board: Board;
  taskCount: number;
  isAdmin: boolean;
  canEdit: boolean;
  members: UserSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isPermissionsOpen, setPermissionsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const isArchived = board.archivedAt !== null;

  if (!canEdit && !isAdmin) {
    return null;
  }

  function toggleArchived() {
    startTransition(async () => {
      const result = await setBoardArchivedAction({ id: board.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(isArchived ? "Board restored." : "Board archived.");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteBoardAction({ id: board.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setDeleteOpen(false);
      toast.success(`${board.name} deleted.`);
      router.push("/boards");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Board options"
            className="shrink-0 text-muted-foreground"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
              Board settings
            </DropdownMenuItem>
          ) : null}

          {isAdmin ? (
            <>
              <DropdownMenuItem onSelect={() => setPermissionsOpen(true)}>
                <ShieldCheckIcon className="size-4" aria-hidden="true" />
                Board permissions
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={toggleArchived} disabled={isPending}>
                {isArchived ? (
                  <>
                    <ArchiveRestoreIcon className="size-4" aria-hidden="true" />
                    Restore board
                  </>
                ) : (
                  <>
                    <ArchiveIcon className="size-4" aria-hidden="true" />
                    Archive board
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setConfirmation("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2Icon className="size-4" aria-hidden="true" />
                Delete board
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <BoardFormDialog
        workspaceId={board.workspaceId}
        board={board}
        open={isEditOpen}
        onOpenChange={setEditOpen}
      />

      <BoardPermissionsDialog
        board={board}
        members={members}
        open={isPermissionsOpen}
        onOpenChange={setPermissionsOpen}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {board.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the board, its columns, and{" "}
              {taskCount === 1 ? "its 1 task" : `all ${taskCount} of its tasks`}{" "}
              along with every comment, file and logged hour on them. It cannot
              be undone — archiving keeps all of it and hides the board instead.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{board.name}</span>{" "}
              to confirm.
            </p>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-label={`Type ${board.name} to confirm deletion`}
              autoComplete="off"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <HoldToConfirm
              disabled={isPending || confirmation.trim() !== board.name}
              onConfirm={remove}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              {isPending ? "Deleting…" : "Hold to delete board"}
            </HoldToConfirm>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
