"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckSquareIcon,
  CircleIcon,
  GripVerticalIcon,
  MessageSquareIcon,
  PaperclipIcon,
  RepeatIcon,
} from "lucide-react";

import { LabelChip } from "@/features/tasks/components/label-chip";
import {
  AssigneeAvatar,
  DueDateBadge,
  MediaTypeIcon,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import { MEDIA_TYPE_LABELS } from "@/features/tasks/constants";
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
    task.mediaType !== "none" ||
    checklist.total > 0 ||
    task.commentCount > 0 ||
    task.attachmentCount > 0 ||
    task.recurrence !== null ||
    task.assignee !== null ||
    task.assignedBy !== null;

  // `none` is a real priority meaning "not triaged", so it gets no edge — a
  // colour for "no colour" would put four bars in a column where only three
  // people have made a decision.
  const hasPriority = task.priority !== "none";

  return (
    <article
      data-priority={task.priority}
      data-complete={isComplete}
      style={
        hasPriority
          ? ({
              "--priority-accent": `var(--priority-${task.priority})`,
            } as React.CSSProperties)
          : undefined
      }
      className={cn(
        "card-surface p-3 pr-8",
        // Lift on hover, settle on press. Skipped for the drag overlay, which
        // is already in the air and would otherwise stack two elevations.
        !isOverlay && "card-interactive",
        hasPriority && "priority-tint",
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

          {task.mediaType !== "none" ? (
            <span
              className="inline-flex items-center gap-1"
              title={
                task.assetReadyAt
                  ? `${MEDIA_TYPE_LABELS[task.mediaType]} — artwork made${
                      task.assetReadyBy ? ` by ${task.assetReadyBy.name}` : ""
                    }`
                  : `${MEDIA_TYPE_LABELS[task.mediaType]} — artwork still with the designer`
              }
            >
              <MediaTypeIcon mediaType={task.mediaType} className="size-3" />
              {MEDIA_TYPE_LABELS[task.mediaType]}
              {task.assetReadyAt ? (
                <CircleIcon
                  className="size-2 fill-current text-foreground"
                  aria-hidden="true"
                />
              ) : (
                <CircleIcon className="size-2" aria-hidden="true" />
              )}
              <span className="sr-only">
                {task.assetReadyAt
                  ? "Artwork made"
                  : "Artwork still with the designer"}
              </span>
            </span>
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

          {/*
            Shown whenever it is recorded, including when someone assigned the
            task to themselves. Suppressing the self-assigned case reads as
            cleaner but behaves worse: the row appears and disappears for
            reasons that are invisible from the card, so the first reaction to a
            missing line is "this is broken" rather than "that was me".
          */}
          {task.assignedBy ? (
            <span
              className="min-w-0 truncate"
              title={`Assigned by ${task.assignedBy.name}`}
            >
              Assigned by {task.assignedBy.name.split(" ")[0]}
            </span>
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
