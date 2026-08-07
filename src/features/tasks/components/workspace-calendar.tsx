"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTaskAction } from "@/features/tasks/actions/task.actions";
import { CalendarView } from "@/features/tasks/components/board/calendar-view";
import type { Task } from "@/features/tasks/types";

/**
 * The calendar across every board in the workspace.
 *
 * Reuses the board's own calendar rather than a second implementation — the
 * only differences are where a task opens (its own board) and that the working
 * copy is local state here, because there is no single board query to write
 * into.
 */
export function WorkspaceCalendar({
  workspaceId,
  tasks: initialTasks,
  editableBoardIds,
}: {
  workspaceId: string;
  tasks: Task[];
  editableBoardIds: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tasks, setTasks] = useState(initialTasks);

  /**
   * Re-sync when the server sends a new list — after a reschedule, or when the
   * workspace is switched. Done during render rather than in an effect so there
   * is no frame showing the previous month's data.
   */
  const [synced, setSynced] = useState(initialTasks);

  if (synced !== initialTasks) {
    setSynced(initialTasks);
    setTasks(initialTasks);
  }

  function reschedule(taskId: string, dueDate: Date) {
    const previous = tasks;

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, dueDate: dueDate.toISOString() } : task,
      ),
    );

    startTransition(async () => {
      const result = await updateTaskAction({ id: taskId, dueDate });

      if (!result.ok) {
        setTasks(previous);
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <CalendarView
      dndContextId={`workspace-calendar-${workspaceId}`}
      tasks={tasks}
      onOpenTask={(taskId) => {
        const task = tasks.find((item) => item.id === taskId);

        if (task) {
          router.push(`/boards/${task.boardId}?task=${task.id}` as Route);
        }
      }}
      onReschedule={reschedule}
      editableBoardIds={editableBoardIds}
    />
  );
}
