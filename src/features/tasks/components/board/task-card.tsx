"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquareIcon,
  GripVerticalIcon,
  MessageSquareIcon,
  PaperclipIcon,
  RepeatIcon,
} from "lucide-react";

import { LabelChip } from "@/features/tasks/components/label-chip";
import {
  AssigneeAvatar,
  DueDateBadge,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export function checklistProgress(task: Task): { done: number; total: number } {
  return {
    done: task.checklist.filter((item) => item.done).length,
    total: task.checklist.length,
  };
}

/**
 * The card, with no interaction attached.
 *
 * Purely presentational so `DragOverlay` can render exactly the same markup
 * without a second `useSortable` claiming the same id — two registrations for
 * one card make dnd-kit lose track of what is being dragged.
 */
export function TaskCard({
  task,
  isDragging,
  isOverlay,
}: {
  task: Task;
  isDragging?: boolean;
  isOverlay?: boolean;
}) {
  const checklist = checklistProgress(task);
  const isComplete = task.completedAt !== null;
  const hasFooter =
    task.dueDate !== null ||
    checklist.total > 0 ||
    task.commentCount > 0 ||
    task.attachmentCount > 0 ||
    task.recurrence !== null ||
    task.assignee !== null;

  return (
    <article
      className={cn(
        "rounded-xl bg-card p-3 pr-8 shadow-soft transition-shadow duration-150",
        isComplete && "opacity-60",
        isDragging && "opacity-40",
        isOverlay && "rotate-[1.5deg] shadow-drag",
      )}
    >
      {task.labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}

      <div className="flex items-start gap-1.5">
        <PriorityIcon priority={task.priority} className="mt-0.5 shrink-0" />
        <p
          className={cn(
            "flex-1 text-sm leading-snug text-pretty",
            isComplete && "line-through",
          )}
        >
          {task.title}
        </p>
      </div>

      {hasFooter ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.6875rem] text-muted-foreground">
          {task.dueDate ? (
            <DueDateBadge dueDate={task.dueDate} isComplete={isComplete} />
          ) : null}

          {task.recurrence ? (
            <RepeatIcon
              className="size-3"
              aria-label={`Repeats ${task.recurrence.frequency}`}
            />
          ) : null}

          {checklist.total > 0 ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                checklist.done === checklist.total && "text-foreground",
              )}
              title={`${checklist.done} of ${checklist.total} steps done`}
            >
              <CheckSquareIcon className="size-3" aria-hidden="true" />
              {checklist.done}/{checklist.total}
            </span>
          ) : null}

          {task.commentCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              title={`${task.commentCount} comment${task.commentCount === 1 ? "" : "s"}`}
            >
              <MessageSquareIcon className="size-3" aria-hidden="true" />
              {task.commentCount}
            </span>
          ) : null}

          {task.attachmentCount > 0 ? (
            <PaperclipIcon
              className="size-3"
              aria-label={`${task.attachmentCount} attachment${task.attachmentCount === 1 ? "" : "s"}`}
            />
          ) : null}

          <span className="ml-auto">
            <AssigneeAvatar user={task.assignee} />
          </span>
        </div>
      ) : null}
    </article>
  );
}

/**
 * A card that can be dragged and opened.
 *
 * Opening and dragging have separate controls. Keeping dnd-kit's listeners off
 * the card button prevents a small pointer movement from swallowing a click,
 * while the compact handle remains available to mouse and keyboard users.
 */
export function SortableTaskCard({
  task,
  onOpen,
  canDrag,
}: {
  task: Task;
  onOpen: () => void;
  canDrag: boolean;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", listId: task.listId },
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    disabled: !canDrag,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="group/task relative rounded-xl"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${task.title}`}
        className="block w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <TaskCard task={task} isDragging={isDragging} />
      </button>

      {canDrag ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${task.title}`}
          className="absolute top-2 right-2 cursor-grab touch-none rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/task:opacity-100"
        >
          <GripVerticalIcon className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
