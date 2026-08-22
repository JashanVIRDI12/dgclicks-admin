"use client";

import { ArchiveIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { checklistProgress } from "@/features/tasks/components/board/task-card";
import { LabelDot } from "@/features/tasks/components/label-chip";
import {
  AssigneeStack,
  DueDateBadge,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import { useArchiveTask } from "@/features/tasks/hooks/use-board";
import type { BoardSnapshot, List, Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * A dense row per task, grouped by column.
 *
 * Rows rather than a table: a table implies cells you can sort, compare and
 * export, which is the spreadsheet feeling this board is meant to avoid. What
 * is wanted here is a scannable list where the title dominates and everything
 * else sits quietly to the right.
 */
function TaskRow({
  task,
  onOpen,
  onToggleComplete,
  canEdit,
}: {
  task: Task;
  onOpen: () => void;
  onToggleComplete: (isComplete: boolean) => void;
  canEdit: boolean;
}) {
  const isComplete = task.completedAt !== null;
  const checklist = checklistProgress(task);
  const archive = useArchiveTask(task.boardId);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group/row flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/60",
        isComplete && "opacity-60",
      )}
    >
      {/* Stops the checkbox from also opening the drawer behind it. */}
      <span onClick={(event) => event.stopPropagation()} className="flex">
        <Checkbox
          checked={isComplete}
          disabled={!canEdit}
          onCheckedChange={(checked) => onToggleComplete(checked === true)}
          aria-label={`Mark ${task.title} ${isComplete ? "incomplete" : "complete"}`}
        />
      </span>

      <PriorityIcon priority={task.priority} className="shrink-0" />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isComplete && "line-through",
        )}
      >
        {task.title}
      </span>

      {task.labels.length > 0 ? (
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {task.labels.slice(0, 3).map((label) => (
            <LabelDot key={label.id} color={label.color} />
          ))}
        </span>
      ) : null}

      {checklist.total > 0 ? (
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
          {checklist.done}/{checklist.total}
        </span>
      ) : null}

      {task.dueDate ? (
        <DueDateBadge
          dueDate={task.dueDate}
          isComplete={isComplete}
          className="shrink-0"
        />
      ) : null}

      <span className="shrink-0">
        <AssigneeStack users={task.assignees} />
      </span>

      {/* Same one-click archive the board card offers, so a row and a card
          put something away the same way. Reversible from the toast. */}
      {canEdit ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            archive.mutate({ id: task.id, title: task.title });
          }}
          disabled={archive.isPending}
          aria-label={`Archive ${task.title}`}
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 disabled:opacity-40 group-hover/row:opacity-100"
        >
          <ArchiveIcon className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}

      <ChevronRightIcon
        className="size-4 shrink-0 text-muted-foreground/50"
        aria-hidden="true"
      />
    </div>
  );
}

function ListGroup({
  list,
  tasks,
  onOpenTask,
  onToggleComplete,
  canEdit,
}: {
  list: List;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onToggleComplete: (taskId: string, isComplete: boolean) => void;
  canEdit: boolean;
}) {
  const [isOpen, setOpen] = useState(true);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/40"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-90",
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{list.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </button>

      {isOpen ? (
        <div className="pb-2">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task.id)}
                onToggleComplete={(isComplete) =>
                  onToggleComplete(task.id, isComplete)
                }
                canEdit={canEdit}
              />
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nothing here.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function ListView({
  snapshot,
  tasks,
  onOpenTask,
  onToggleComplete,
  canEdit,
}: {
  snapshot: BoardSnapshot;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onToggleComplete: (taskId: string, isComplete: boolean) => void;
  canEdit: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-1">
      {snapshot.lists.map((list) => (
        <ListGroup
          key={list.id}
          list={list}
          tasks={tasks
            .filter((task) => task.listId === list.id)
            .sort((a, b) => a.position - b.position)}
          onOpenTask={onOpenTask}
          onToggleComplete={onToggleComplete}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
