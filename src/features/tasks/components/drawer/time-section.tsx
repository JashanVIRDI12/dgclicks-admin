"use client";

import { PlayIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { UserSummary } from "@/features/auth/types";
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
function useElapsedMinutes(startedAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
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
  const elapsed = useElapsedMinutes(running?.startedAt ?? null);
  const isMine = running?.user?.id === currentUser.id;

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
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Time</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDuration(task.loggedMinutes)}
          {task.estimateMinutes
            ? ` of ${formatDuration(task.estimateMinutes)}`
            : ""}
        </span>

        {running ? (
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto h-7"
            disabled={timer.stop.isPending}
            onClick={() => timer.stop.mutate()}
          >
            <SquareIcon className="size-3 fill-current" aria-hidden="true" />
            {/* Whose timer it is matters — stopping someone else's is a
                deliberate act, not an accident of hitting the same button. */}
            {isMine
              ? `Stop · ${formatDuration(Math.max(1, elapsed))}`
              : `Stop ${running.user?.name ?? "timer"}`}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-muted-foreground"
            disabled={timer.start.isPending}
            onClick={() => timer.start.mutate()}
          >
            <PlayIcon className="size-3.5" aria-hidden="true" />
            Start timer
          </Button>
        )}
      </div>

      {percentOfEstimate !== null ? (
        <Progress
          value={percentOfEstimate}
          aria-label={`${percentOfEstimate}% of the estimate used`}
          className="h-1"
        />
      ) : null}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              logDraft();
            }
          }}
          placeholder="Log time — 45m, 1h 30m, 90"
          aria-label="Log time"
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={parseDuration(draft) === null || timer.log.isPending}
          onClick={logDraft}
        >
          Log
        </Button>
      </div>

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
                onClick={() => timer.remove.mutate(entry.id)}
                className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/entry:opacity-100 focus-visible:opacity-100"
              >
                <Trash2Icon className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
