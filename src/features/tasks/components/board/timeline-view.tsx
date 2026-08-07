"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  format,
  isToday,
  isWeekend,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";
import { CalendarOffIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { LabelDot } from "@/features/tasks/components/label-chip";
import {
  AssigneeAvatar,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const DAY_WIDTH = 36;
const PADDING_DAYS = 3;

type Span = {
  task: Task;
  start: Date;
  end: Date;
};

/**
 * The window a task occupies.
 *
 * A task with only a due date is drawn as a single day rather than being
 * dropped: most work in this app is a deadline, not a range, and hiding it
 * would make the timeline show a fraction of the board.
 */
function toSpan(task: Task): Span | null {
  if (!task.startDate && !task.dueDate) {
    return null;
  }

  const start = startOfDay(
    new Date((task.startDate ?? task.dueDate) as string),
  );
  const end = endOfDay(new Date((task.dueDate ?? task.startDate) as string));

  return { task, start, end: end < start ? endOfDay(start) : end };
}

export function TimelineView({
  tasks,
  onOpenTask,
}: {
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
}) {
  const spans = tasks
    .map(toSpan)
    .filter((span): span is Span => span !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (spans.length === 0) {
    return (
      <EmptyState
        icon={CalendarOffIcon}
        title="Nothing scheduled"
        description="Give a task a start or due date and it will appear on the timeline."
      />
    );
  }

  // Always include today, so the marker has somewhere to land even when every
  // task sits in the past or the future.
  const rangeStart = addDays(
    minDate([...spans.map((span) => span.start), startOfDay(new Date())]),
    -PADDING_DAYS,
  );
  const rangeEnd = addDays(
    maxDate([...spans.map((span) => span.end), startOfDay(new Date())]),
    PADDING_DAYS,
  );

  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const gridWidth = days.length * DAY_WIDTH;

  return (
    <div className="scrollbar-subtle overflow-x-auto rounded-xl bg-surface">
      <div style={{ width: gridWidth, minWidth: "100%" }}>
        <div
          className="sticky top-0 z-10 grid border-b bg-surface"
          style={{
            gridTemplateColumns: `repeat(${days.length}, ${DAY_WIDTH}px)`,
          }}
        >
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-l px-1 py-1.5 text-center text-[0.625rem] leading-tight",
                isWeekend(day) && "bg-accent/30",
                isToday(day) ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <div>{format(day, "EEEEE")}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 w-5 rounded tabular-nums",
                  isToday(day) && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        <div className="relative py-2">
          {/* One absolutely positioned line rather than a per-row marker. */}
          <div
            className="pointer-events-none absolute inset-y-0 z-0 w-px bg-primary/60"
            style={{
              left:
                differenceInCalendarDays(startOfDay(new Date()), rangeStart) *
                  DAY_WIDTH +
                DAY_WIDTH / 2,
            }}
            aria-hidden="true"
          />

          {spans.map(({ task, start, end }) => {
            const offset = differenceInCalendarDays(start, rangeStart);
            const length = differenceInCalendarDays(end, start) + 1;
            const isComplete = task.completedAt !== null;

            return (
              <div key={task.id} className="relative h-9">
                <button
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  title={`${task.title} — ${format(start, "d MMM")} to ${format(end, "d MMM")}`}
                  className={cn(
                    "absolute top-1 flex h-7 items-center gap-1.5 overflow-hidden rounded-lg bg-card px-2 text-left shadow-soft transition-shadow hover:shadow-lift",
                    isComplete && "opacity-60",
                  )}
                  style={{
                    left: offset * DAY_WIDTH + 3,
                    width: Math.max(length * DAY_WIDTH - 6, DAY_WIDTH - 6),
                  }}
                >
                  <PriorityIcon
                    priority={task.priority}
                    className="size-3 shrink-0"
                  />
                  {task.labels[0] ? (
                    <LabelDot color={task.labels[0].color} />
                  ) : null}
                  <span
                    className={cn(
                      "truncate text-xs",
                      isComplete && "line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  <span className="ml-auto shrink-0">
                    <AssigneeAvatar user={task.assignee} className="size-4" />
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
