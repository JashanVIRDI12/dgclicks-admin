"use client";

import { ArchiveRestoreIcon, InboxIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { setTaskArchivedAction } from "@/features/tasks/actions/task.actions";
import {
  AssigneeAvatar,
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
 * Archived work, with a way back.
 *
 * Restore is the only action here. Deleting from the archive would make this
 * screen the most dangerous one in the app — a list of things already out of
 * sight, with a permanent action next to each — and permanent task deletion
 * already exists in the drawer, where the task is in front of you.
 */
export function ArchiveList({
  tasks,
  boardNames,
}: {
  tasks: Task[];
  boardNames: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

          <AssigneeAvatar user={task.assignee} />

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
        </li>
      ))}
    </ul>
  );
}
