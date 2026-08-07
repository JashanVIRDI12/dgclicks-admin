"use client";

import { format } from "date-fns";
import { CalendarIcon, UserIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSummary } from "@/features/auth/types";
import { LabelPicker } from "@/features/tasks/components/drawer/label-picker";
import { RecurrenceEditor } from "@/features/tasks/components/drawer/recurrence-editor";
import {
  AssigneeAvatar,
  formatDuration,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
} from "@/features/tasks/constants";
import { parseDuration } from "@/features/tasks/components/drawer/time-section";
import { useUpdateTask } from "@/features/tasks/hooks/use-board";
import type { Label, TaskDetail } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

const UNASSIGNED = "__unassigned__";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
      <span className="pt-1.5 text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * A control that reads as text until you reach for it.
 *
 * `dark:bg-transparent` is load-bearing: `Input` and `SelectTrigger` both carry
 * `dark:bg-input/30`, which beats a plain `bg-transparent` and renders every
 * one of these rows as a filled box in dark mode.
 */
const BARE_CONTROL =
  "h-7 w-full border-0 bg-transparent px-2 shadow-none transition-colors hover:bg-accent dark:bg-transparent dark:hover:bg-accent";

/** A date field: pick, clear, done. Autosaves on selection. */
function DateField({
  value,
  placeholder,
  onChange,
}: {
  value: string | null;
  placeholder: string;
  onChange: (date: Date | null) => void;
}) {
  const [isOpen, setOpen] = useState(false);
  const selected = value ? new Date(value) : undefined;

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 justify-start gap-1.5 px-2 font-normal"
          >
            <CalendarIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {selected ? (
              format(selected, "d MMM yyyy")
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            autoFocus
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => {
              onChange(date ?? null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {selected ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Clear ${placeholder.toLowerCase()}`}
          onClick={() => onChange(null)}
          className="size-6 shrink-0 text-muted-foreground"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The task's fields, every one of them autosaving.
 *
 * There is no Save button anywhere in this drawer: a panel that can be closed
 * by clicking outside it must not be able to lose an edit, and asking people to
 * confirm each of eight fields is exactly the friction the spec rules out.
 */
export function TaskProperties({
  task,
  boardId,
  labels,
  members,
}: {
  task: TaskDetail;
  boardId: string;
  labels: Label[];
  members: UserSummary[];
}) {
  const update = useUpdateTask(boardId);
  const [estimateDraft, setEstimateDraft] = useState(
    task.estimateMinutes ? formatDuration(task.estimateMinutes) : "",
  );

  function commitEstimate() {
    const trimmed = estimateDraft.trim();

    if (!trimmed) {
      if (task.estimateMinutes !== null) {
        update.mutate({ id: task.id, estimateMinutes: null });
      }

      return;
    }

    const minutes = parseDuration(trimmed);

    if (minutes === null) {
      // Unparseable input reverts rather than saving a wrong number.
      setEstimateDraft(
        task.estimateMinutes ? formatDuration(task.estimateMinutes) : "",
      );
      return;
    }

    if (minutes !== task.estimateMinutes) {
      update.mutate({ id: task.id, estimateMinutes: minutes });
    }

    setEstimateDraft(formatDuration(minutes));
  }

  return (
    <div className="space-y-2">
      <Row label="Status">
        <span className="inline-flex h-7 items-center px-2 text-sm">
          {task.completedAt ? "Complete" : "In progress"}
        </span>
      </Row>

      <Row label="Priority">
        <Select
          value={task.priority}
          onValueChange={(value) =>
            update.mutate({ id: task.id, priority: value as TaskPriority })
          }
        >
          <SelectTrigger
            size="sm"
            className={BARE_CONTROL}
            aria-label="Priority"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                <PriorityIcon priority={priority} />
                {TASK_PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="Assignee">
        <Select
          value={task.assignee?.id ?? UNASSIGNED}
          onValueChange={(value) =>
            update.mutate({
              id: task.id,
              assigneeId: value === UNASSIGNED ? null : value,
            })
          }
        >
          <SelectTrigger
            size="sm"
            className={BARE_CONTROL}
            aria-label="Assignee"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>
              <UserIcon className="size-3.5 text-muted-foreground" />
              Unassigned
            </SelectItem>
            {members.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                <AssigneeAvatar user={member} className="size-4" />
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>

      <Row label="Due">
        <DateField
          value={task.dueDate}
          placeholder="No due date"
          onChange={(date) => update.mutate({ id: task.id, dueDate: date })}
        />
      </Row>

      <Row label="Start">
        <DateField
          value={task.startDate}
          placeholder="No start date"
          onChange={(date) => update.mutate({ id: task.id, startDate: date })}
        />
      </Row>

      <Row label="Labels">
        <LabelPicker
          boardId={boardId}
          labels={labels}
          selectedIds={task.labels.map((label) => label.id)}
          onChange={(labelIds) => update.mutate({ id: task.id, labelIds })}
        />
      </Row>

      <Row label="Estimate">
        <Input
          value={estimateDraft}
          onChange={(event) => setEstimateDraft(event.target.value)}
          onBlur={commitEstimate}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="e.g. 2h 30m"
          aria-label="Estimate"
          className={cn(BARE_CONTROL, "text-sm focus-visible:bg-background dark:focus-visible:bg-input/30")}
        />
      </Row>

      <Row label="Repeat">
        <RecurrenceEditor task={task} />
      </Row>
    </div>
  );
}
