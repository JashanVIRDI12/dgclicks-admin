import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

import { LabelDot } from "@/features/tasks/components/label-chip";
import {
  AssigneeStack,
  DueDateBadge,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * A read-only list of tasks that links into the board drawer.
 *
 * Shared by the dashboard panels and My Tasks so the same task looks the same
 * wherever it is listed — and so every one of them is one click from the card
 * itself rather than a dead end.
 */
export function TaskListPanel({
  title,
  icon: Icon,
  tone,
  tasks,
  emptyMessage,
  showBoardHint,
  boardNames,
}: {
  title: string;
  icon: LucideIcon;
  /** Colours the count, for panels that mean something is wrong. */
  tone?: "urgent" | "warning";
  tasks: Task[];
  emptyMessage: string;
  showBoardHint?: boolean;
  boardNames?: Map<string, string>;
}) {
  return (
    <section className="card-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-sm font-medium">{title}</h2>
        {tasks.length > 0 ? (
          <span
            className="text-xs tabular-nums"
            style={
              tone
                ? {
                    color:
                      tone === "urgent"
                        ? "var(--priority-urgent)"
                        : "var(--priority-medium)",
                  }
                : { color: "var(--muted-foreground)" }
            }
          >
            {tasks.length}
          </span>
        ) : null}
      </div>

      {tasks.length > 0 ? (
        <ul className="space-y-0.5">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={
                  `/boards/${task.boardId}?task=${task.id}` as Route
                }
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
              >
                <PriorityIcon priority={task.priority} className="shrink-0" />

                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    task.completedAt && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>

                {showBoardHint && boardNames?.get(task.boardId) ? (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {boardNames.get(task.boardId)}
                  </span>
                ) : null}

                {task.labels[0] ? (
                  <LabelDot color={task.labels[0].color} />
                ) : null}

                {task.dueDate ? (
                  <DueDateBadge
                    dueDate={task.dueDate}
                    isComplete={task.completedAt !== null}
                    className="shrink-0"
                  />
                ) : null}

                <AssigneeStack users={task.assignees} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
