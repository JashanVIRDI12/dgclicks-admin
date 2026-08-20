"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LabelDot } from "@/features/tasks/components/label-chip";
import {
  MediaTypeIcon,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import { MEDIA_TYPE_LABELS } from "@/features/tasks/constants";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** `yyyy-MM-dd`, used as the droppable id for a day cell. */
function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function DayTask({
  task,
  onOpen,
  canEdit,
}: {
  task: Task;
  onOpen: () => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task" },
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={task.title}
      className={cn(
        "flex cursor-pointer items-center gap-1 rounded-md bg-card px-1.5 py-1 text-[0.6875rem] leading-tight shadow-soft transition-shadow hover:shadow-lift",
        canEdit && "touch-none",
        task.completedAt && "opacity-60",
        isDragging && "opacity-30",
      )}
    >
      {task.mediaType === "none" ? (
        <PriorityIcon priority={task.priority} className="size-3 shrink-0" />
      ) : (
        <span
          className="flex shrink-0 items-center gap-0.5"
          title={
            task.assetReadyAt
              ? `${MEDIA_TYPE_LABELS[task.mediaType]} — artwork made`
              : `${MEDIA_TYPE_LABELS[task.mediaType]} — artwork still with the designer`
          }
        >
          <MediaTypeIcon mediaType={task.mediaType} className="size-3" />
          <CircleIcon
            className={cn("size-1.5", task.assetReadyAt && "fill-current")}
            aria-hidden="true"
          />
        </span>
      )}
      {task.labels[0] ? <LabelDot color={task.labels[0].color} /> : null}
      <span
        className={cn("truncate", task.completedAt && "line-through")}
      >
        {task.title}
      </span>
    </div>
  );
}

function DayCell({
  date,
  month,
  tasks,
  onOpenTask,
  editableBoardIds,
}: {
  date: Date;
  month: Date;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  editableBoardIds: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dayKey(date),
    data: { type: "day", date: date.toISOString() },
    disabled: editableBoardIds.length === 0,
  });

  const isOutside = !isSameMonth(date, month);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "scrollbar-subtle flex min-h-24 flex-col gap-1 overflow-y-auto rounded-lg p-1.5 transition-colors",
        isOutside ? "bg-transparent" : "bg-surface",
        isOver && "bg-accent ring-2 ring-ring",
      )}
    >
      <span
        className={cn(
          "self-start rounded px-1 text-[0.6875rem] tabular-nums",
          isOutside && "text-muted-foreground/40",
          isToday(date) && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {format(date, "d")}
      </span>

      {tasks.map((task) => (
        <DayTask
          key={task.id}
          task={task}
          onOpen={() => onOpenTask(task.id)}
          canEdit={editableBoardIds.includes(task.boardId)}
        />
      ))}
    </div>
  );
}

/**
 * A month grid keyed on due date.
 *
 * Days are drop targets, so rescheduling is a drag rather than opening a card
 * and finding a date picker. Undated tasks are listed beside the grid instead
 * of being hidden — they are exactly the ones that need a date.
 */
export function CalendarView({
  dndContextId,
  tasks,
  onOpenTask,
  onReschedule,
  editableBoardIds,
}: {
  dndContextId: string;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onReschedule: (taskId: string, dueDate: Date) => void;
  editableBoardIds: string[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const dated = tasks.filter((task) => task.dueDate !== null);
  const undated = tasks.filter((task) => task.dueDate === null);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || over.data.current?.type !== "day") {
      return;
    }

    const target = new Date(String(over.data.current.date));
    const task = tasks.find((item) => item.id === active.id);

    if (!task) {
      return;
    }

    if (!editableBoardIds.includes(task.boardId)) {
      return;
    }

    // Keep the time of day that was already set; only the calendar date moved.
    const existing = task.dueDate ? new Date(task.dueDate) : null;
    target.setHours(
      existing?.getHours() ?? 17,
      existing?.getMinutes() ?? 0,
      0,
      0,
    );

    if (existing && isSameDay(existing, target)) {
      return;
    }

    onReschedule(String(active.id), target);
  }

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium">
              {format(month, "MMMM yyyy")}
            </h2>

            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Previous month"
                onClick={() => setMonth((current) => addMonths(current, -1))}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setMonth(startOfMonth(new Date()))}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Next month"
                onClick={() => setMonth((current) => addMonths(current, 1))}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 pb-1 text-[0.6875rem] font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}

            {days.map((day) => (
              <DayCell
                key={dayKey(day)}
                date={day}
                month={month}
                tasks={dated.filter((task) =>
                  isSameDay(new Date(task.dueDate as string), day),
                )}
                onOpenTask={onOpenTask}
                editableBoardIds={editableBoardIds}
              />
            ))}
          </div>
        </div>

        {undated.length > 0 ? (
          <aside className="w-full shrink-0 lg:w-60">
            <h2 className="mb-3 text-sm font-medium">
              No date{" "}
              <span className="text-muted-foreground tabular-nums">
                {undated.length}
              </span>
            </h2>
            <div className="scrollbar-subtle flex max-h-[32rem] flex-col gap-1 overflow-y-auto rounded-lg bg-surface p-1.5">
              {undated.map((task) => (
                <DayTask
                  key={task.id}
                  task={task}
                  onOpen={() => onOpenTask(task.id)}
                  canEdit={editableBoardIds.includes(task.boardId)}
                />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </DndContext>
  );
}
