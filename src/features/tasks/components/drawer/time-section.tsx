"use client";

import {
  PlayIcon,
  PlusIcon,
  SquareIcon,
  TimerIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import type { UserSummary } from "@/features/auth/types";
import { DrawerSection } from "@/features/tasks/components/drawer/section";
import { formatDuration } from "@/features/tasks/components/task-meta";
import { useTimeTracking } from "@/features/tasks/hooks/use-task-workspace";
import type { TaskDetail } from "@/features/tasks/types";

/**
 * Parses what someone actually types into a duration box: `90`, `1h 30m`,
 * `1.5h`, `45m`.
 *
 * Returns null for anything it cannot read, so the caller can refuse rather
 * than silently logging a number the user did not mean.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();

  if (!text) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(Number(text));
  }

  const pattern = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/;
  const match = pattern.exec(text);

  if (!match || (!match[1] && !match[2])) {
    return null;
  }

  const minutes =
    Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);

  return minutes > 0 ? Math.round(minutes) : null;
}

/** Ticks once a second so a running timer reads as running. */
function useElapsedSeconds(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    // Only the interval writes state. Seeding it synchronously here would be a
    // setState in an effect body, which the compiler rules reject — and it buys
    // at most one second of accuracy, since the first tick corrects a clock
    // that went stale while the tab was backgrounded.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

/**
 * `MM:SS`, or `H:MM:SS` once it has been running an hour.
 *
 * Seconds are the point: the old display floored to whole minutes, so a timer
 * you had just started read "0m" for sixty seconds and looked broken.
 */
function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export function TimeSection({
  task,
  boardId,
  currentUser,
}: {
  task: TaskDetail;
  boardId: string;
  currentUser: UserSummary;
}) {
  const timer = useTimeTracking(task.id, boardId);
  const [draft, setDraft] = useState("");

  const running = task.runningTimer;
  const elapsedSeconds = useElapsedSeconds(running?.startedAt ?? null);
  const isMine = running?.user?.id === currentUser.id;
  const canLog = parseDuration(draft) !== null;

  const percentOfEstimate =
    task.estimateMinutes && task.estimateMinutes > 0
      ? Math.min(
          100,
          Math.round((task.loggedMinutes / task.estimateMinutes) * 100),
        )
      : null;

  function logDraft() {
    const minutes = parseDuration(draft);

    if (minutes === null) {
      return;
    }

    timer.log.mutate({ minutes });
    setDraft("");
  }

  return (
    <DrawerSection
      icon={TimerIcon}
      title="Time"
      meta={`${formatDuration(task.loggedMinutes)}${
        task.estimateMinutes
          ? ` of ${formatDuration(task.estimateMinutes)}`
          : ""
      }`}
    >
      {percentOfEstimate !== null ? (
        <Progress
          value={percentOfEstimate}
          aria-label={`${percentOfEstimate}% of the estimate used`}
          className="h-1"
        />
      ) : null}

      {/*
        A running timer takes the whole row and says so, rather than hiding
        behind a ghost button in the header. The clock ticks in seconds because
        a timer that reads "0m" for its first minute looks like it failed to
        start.
      */}
      {running ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
          <span className="relative flex size-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>

          <span
            className="text-sm font-medium tabular-nums"
            role="timer"
            aria-live="off"
          >
            {formatClock(elapsedSeconds)}
          </span>

          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {isMine ? "Recording" : `${running.user?.name ?? "Someone"} is recording`}
          </span>

          {/* Whose timer it is matters — stopping someone else's is a
              deliberate act, not an accident of hitting the same button. */}
          <Button
            size="sm"
            className="ml-auto h-7"
            aria-busy={timer.stop.isPending}
            disabled={timer.stop.isPending}
            onClick={() => timer.stop.mutate()}
          >
            {timer.stop.isPending ? (
              <Spinner />
            ) : (
              <SquareIcon className="size-3 fill-current" aria-hidden="true" />
            )}
            {isMine ? "Stop" : `Stop ${running.user?.name?.split(" ")[0] ?? ""}`}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            aria-busy={timer.start.isPending}
            disabled={timer.start.isPending}
            onClick={() => timer.start.mutate()}
          >
            {timer.start.isPending ? (
              <Spinner />
            ) : (
              <PlayIcon className="size-3.5" aria-hidden="true" />
            )}
            Start timer
          </Button>

          {/*
            The manual box carries its own label as an addon instead of leaning
            on placeholder text, so what the field is for survives being typed
            in. The examples stay as the placeholder, where they are a hint
            rather than the only clue.
          */}
          <InputGroup className="h-8">
            <InputGroupAddon align="inline-start">
              <PlusIcon className="size-3.5" aria-hidden="true" />
            </InputGroupAddon>

            <InputGroupInput
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  logDraft();
                }
              }}
              placeholder="45m, 1h 30m, 90"
              aria-label="Log time already spent"
              className="text-sm"
            />

            <InputGroupAddon align="inline-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                aria-busy={timer.log.isPending}
                disabled={!canLog || timer.log.isPending}
                onClick={logDraft}
              >
                {timer.log.isPending ? <Spinner className="size-3" /> : "Log"}
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}

      {task.timeEntries.length > 0 ? (
        <ul className="space-y-0.5">
          {task.timeEntries.map((entry) => (
            <li
              key={entry.id}
              className="group/entry flex items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-accent/50"
            >
              <span className="w-14 shrink-0 tabular-nums">
                {formatDuration(entry.minutes)}
              </span>
              <span className="truncate text-muted-foreground">
                {entry.user?.name ?? "Unknown"}
                {entry.note ? ` — ${entry.note}` : ""}
              </span>
              <span className="ml-auto shrink-0 text-muted-foreground">
                {new Date(entry.loggedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove time entry"
                disabled={timer.remove.isPending}
                onClick={() => timer.remove.mutate(entry.id)}
                className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/entry:opacity-100 focus-visible:opacity-100"
              >
                {timer.remove.isPending &&
                timer.remove.variables === entry.id ? (
                  <Spinner className="size-3" />
                ) : (
                  <Trash2Icon className="size-3" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </DrawerSection>
  );
}
