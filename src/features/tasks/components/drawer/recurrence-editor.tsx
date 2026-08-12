"use client";

import { format } from "date-fns";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  type RecurrenceFrequency,
} from "@/features/tasks/constants";
import {
  describeRecurrence,
  nextOccurrence,
  type RecurrenceInput,
} from "@/features/tasks/recurrence";
import { useSetTaskRecurrence } from "@/features/tasks/hooks/use-board";
import type { TaskDetail } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/** Sunday-first indices, Monday-first display — matches the calendar view. */
const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

function initialRule(task: TaskDetail): RecurrenceInput {
  if (task.recurrence) {
    return {
      frequency: task.recurrence.frequency,
      interval: task.recurrence.interval,
      weekdays: task.recurrence.weekdays,
      dayOfMonth: task.recurrence.dayOfMonth,
      endsAt: task.recurrence.endsAt,
    };
  }

  const anchor = task.dueDate ? new Date(task.dueDate) : new Date();

  return {
    frequency: "monthly",
    interval: 1,
    weekdays: [anchor.getDay()],
    dayOfMonth: anchor.getDate(),
    endsAt: null,
  };
}

/**
 * The repeat rule.
 *
 * Shows the next three dates the rule produces as it is edited. "Every 3
 * months on the 31st" is ambiguous enough that a preview is the only honest way
 * to confirm the rule means what someone thinks it means — and it is computed
 * with the same function the server spawns from.
 */
export function RecurrenceEditor({ task }: { task: TaskDetail }) {
  const recurrence = useSetTaskRecurrence(task.id, task.boardId);
  const [isOpen, setOpen] = useState(false);
  const [rule, setRule] = useState<RecurrenceInput>(() => initialRule(task));

  function save(next: RecurrenceInput | null) {
    recurrence.mutate(next, {
      onSuccess: () => {
        setOpen(false);
        toast.success(next ? "Repeat set." : "Repeat removed.");
      },
    });
  }

  const preview = (() => {
    const dates: Date[] = [];
    let cursor = task.dueDate ? new Date(task.dueDate) : new Date();

    for (let index = 0; index < 3; index += 1) {
      cursor = nextOccurrence(rule, cursor);
      dates.push(cursor);
    }

    return dates;
  })();

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 justify-start gap-1.5 px-2 font-normal"
          >
            {/* No icon here: the property label beside it already carries the
                repeat glyph, and two of them read as a stutter. */}
            {task.recurrence ? (
              describeRecurrence(task.recurrence)
            ) : (
              <span className="text-muted-foreground">Does not repeat</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-80 space-y-3">
          <div className="flex gap-2">
            <Select
              value={rule.frequency}
              onValueChange={(value) =>
                setRule((current) => ({
                  ...current,
                  frequency: value as RecurrenceFrequency,
                }))
              }
            >
              <SelectTrigger className="flex-1" aria-label="Repeat frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_FREQUENCIES.map((frequency) => (
                  <SelectItem key={frequency} value={frequency}>
                    {RECURRENCE_FREQUENCY_LABELS[frequency]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {rule.frequency !== "custom" ? (
              <div className="flex w-24 items-center gap-1">
                <span className="text-xs text-muted-foreground">every</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={rule.interval}
                  onChange={(event) =>
                    setRule((current) => ({
                      ...current,
                      interval: Math.max(1, Number(event.target.value) || 1),
                    }))
                  }
                  aria-label="Repeat interval"
                  className="h-9 px-2 text-sm"
                />
              </div>
            ) : null}
          </div>

          {rule.frequency === "custom" ? (
            <div>
              <p className="mb-1.5 text-xs text-muted-foreground">
                On these days
              </p>
              <div className="flex gap-1" role="group" aria-label="Weekdays">
                {WEEKDAYS.map((day, index) => {
                  const isSelected = rule.weekdays.includes(day.value);

                  return (
                    <button
                      // Two days share the letter "T" and two share "S", so the
                      // index disambiguates what the label cannot.
                      key={`${day.value}-${index}`}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`Weekday ${day.value}`}
                      onClick={() =>
                        setRule((current) => ({
                          ...current,
                          weekdays: isSelected
                            ? current.weekdays.filter(
                                (value) => value !== day.value,
                              )
                            : [...current.weekdays, day.value],
                        }))
                      }
                      className={cn(
                        "size-8 rounded-lg text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {rule.frequency === "monthly" || rule.frequency === "quarterly" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">On day</span>
              <Input
                type="number"
                min={1}
                max={31}
                value={rule.dayOfMonth ?? ""}
                onChange={(event) =>
                  setRule((current) => ({
                    ...current,
                    dayOfMonth: event.target.value
                      ? Math.min(31, Math.max(1, Number(event.target.value)))
                      : null,
                  }))
                }
                aria-label="Day of month"
                className="h-8 w-20 px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">
                of the month
              </span>
            </div>
          ) : null}

          <div className="rounded-lg bg-surface p-2.5">
            <p className="text-xs font-medium">{describeRecurrence(rule)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Next: {preview.map((date) => format(date, "d MMM")).join(" · ")}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={recurrence.isPending}
              onClick={() => save(rule)}
            >
              {task.recurrence ? "Update repeat" : "Set repeat"}
            </Button>

            {task.recurrence ? (
              <Button
                size="sm"
                variant="outline"
                disabled={recurrence.isPending}
                onClick={() => save(null)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      {task.recurrence ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Stop repeating"
          disabled={recurrence.isPending}
          onClick={() => save(null)}
          className="size-6 shrink-0 text-muted-foreground"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
