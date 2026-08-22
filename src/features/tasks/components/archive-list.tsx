"use client";

import { ArchiveRestoreIcon, InboxIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/common/spinner";
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
import {
  deleteTaskAction,
  setTaskArchivedAction,
} from "@/features/tasks/actions/task.actions";
import {
  AssigneeStack,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import type { Task } from "@/features/tasks/types";

function archivedOn(iso: string | null): string {
  if (!iso) return "";

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Archived work: put it back, or destroy it for good.
 *
 * This is now the only place a task can be permanently deleted. It used to sit
 * in the task menu directly beneath Archive, which put the irreversible action
 * one row from the reversible one on a card somebody was already looking at.
 * Routing it through here means destroying a task takes two deliberate steps —
 * archive it, then come and find it — and everything before the last one can be
 * undone.
 *
 * Deletion stays admin-only, and asks. Restore does not: putting something back
 * is not a decision anyone needs protecting from.
 */
export function ArchiveList({
  tasks,
  boardNames,
  isAdmin,
}: {
  tasks: Task[];
  boardNames: Record<string, string>;
  /** Permanent deletion is admin-only; restore is open to anyone who can see it. */
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  function destroy(task: Task) {
    startTransition(async () => {
      const result = await deleteTaskAction({ id: task.id });

      setPendingDelete(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${task.title} deleted permanently.`);
      router.refresh();
    });
  }

  function restore(task: Task) {
    setRestoringId(task.id);

    startTransition(async () => {
      // The action toggles rather than takes a target, so calling it on an
      // archived task is what un-archives it.
      const result = await setTaskArchivedAction({ id: task.id });

      setRestoringId(null);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`${task.title} restored.`);
      router.refresh();
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="card-surface flex flex-col items-center gap-2 px-6 py-12 text-center">
        <InboxIcon
          className="size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Nothing archived yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Completed work moves here a day after it is finished, and anything you
          archive by hand lands here too. It still counts towards your totals.
        </p>
      </div>
    );
  }

  return (
    <ul className="card-surface divide-y p-1.5">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="group/row flex items-center gap-2.5 px-2 py-2"
        >
          <PriorityIcon priority={task.priority} className="shrink-0" />

          <Link
            href={`/boards/${task.boardId}?task=${task.id}` as Route}
            className="min-w-0 flex-1 truncate text-sm hover:underline"
          >
            {task.title}
          </Link>

          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {boardNames[task.boardId] ?? ""}
          </span>

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {archivedOn(task.archivedAt)}
          </span>

          <AssigneeStack users={task.assignees} />

          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
            aria-label={`Restore ${task.title}`}
            disabled={isPending}
            onClick={() => restore(task)}
          >
            {restoringId === task.id ? (
              <Spinner />
            ) : (
              <ArchiveRestoreIcon className="size-3.5" aria-hidden="true" />
            )}
            Restore
          </Button>

          {isAdmin ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${task.title} permanently`}
              disabled={isPending}
              onClick={() => setPendingDelete(task)}
              className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100"
            >
              <Trash2Icon className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </li>
      ))}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.title} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task and its subtasks, comments and time entries.
              It cannot be undone — restoring it puts it back on the board, and
              that option disappears with it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => pendingDelete && destroy(pendingDelete)}
            >
              {isPending ? <Spinner /> : null}
              Delete permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ul>
  );
}
