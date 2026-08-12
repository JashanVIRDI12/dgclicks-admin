import { ArrowRightIcon, CheckCircle2Icon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import {
  AssigneeAvatar,
  DueDateBadge,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import type { Task } from "@/features/tasks/types";

/**
 * One number, with the thing it means.
 *
 * The tile is a link, not a readout. A count that cannot be acted on is
 * decoration, and a dashboard full of decoration is the thing this screen was
 * rebuilt to stop being — so every tile lands somewhere you can do the work.
 */
function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: Route;
  tone?: "urgent" | "warning";
}) {
  return (
    <Link
      href={href}
      className="card-surface card-interactive group flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span
        className="text-2xl leading-none font-semibold tabular-nums"
        style={
          tone
            ? {
                color:
                  tone === "urgent"
                    ? "var(--priority-urgent)"
                    : "var(--priority-medium)",
              }
            : undefined
        }
      >
        {value}
      </span>
      <span className="truncate text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

/**
 * The top of the dashboard: who you are, what needs you, and what to open next.
 *
 * The screen this replaced opened with six equally-weighted panels, which meant
 * it answered "here is everything" rather than "here is what matters". The
 * ordering here is deliberate — a greeting that states the count, one task
 * singled out to start on, then the numbers. Someone should be able to act
 * without reading past the first card.
 */
export function DashboardHero({
  name,
  overdue,
  dueToday,
  assignedCount,
  completedThisWeek,
  completedLastWeek,
}: {
  name: string;
  overdue: Task[];
  dueToday: Task[];
  assignedCount: number;
  completedThisWeek: number;
  completedLastWeek: number;
}) {
  const needsAttention = overdue.length + dueToday.length;

  // Overdue outranks due-today, and within each the board's own priority order
  // already applies — so the first overdue task is genuinely the most pressing
  // thing this person has.
  const startHere = overdue[0] ?? dueToday[0] ?? null;
  const delta = completedThisWeek - completedLastWeek;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {greeting()}, {name}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsAttention === 0
            ? "Nothing is late or due today. Good place to be."
            : `${needsAttention} ${needsAttention === 1 ? "thing needs" : "things need"} your attention.`}
        </p>
      </div>

      {startHere ? (
        <Link
          href={`/boards/${startHere.boardId}?task=${startHere.id}` as Route}
          className="card-surface card-interactive group block px-4 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
              Start here
            </span>
            {overdue.length > 0 ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium"
                style={{
                  color: "var(--priority-urgent)",
                  background:
                    "color-mix(in oklch, var(--priority-urgent) 12%, transparent)",
                }}
              >
                Overdue
              </span>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-2.5">
            <PriorityIcon priority={startHere.priority} className="shrink-0" />

            <p className="min-w-0 flex-1 truncate text-base font-medium">
              {startHere.title}
            </p>

            {startHere.dueDate ? (
              <DueDateBadge
                dueDate={startHere.dueDate}
                isComplete={false}
                className="shrink-0"
              />
            ) : null}

            <AssigneeAvatar user={startHere.assignee} />

            <ArrowRightIcon
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </Link>
      ) : (
        <div className="card-surface flex items-center gap-3 px-4 py-3.5">
          <CheckCircle2Icon
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Nothing overdue and nothing due today. Anything you pick up now is
            ahead of schedule.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2.5">
        <StatTile
          label="Overdue"
          value={overdue.length}
          href="/my-tasks"
          tone={overdue.length > 0 ? "urgent" : undefined}
        />
        <StatTile
          label="Due today"
          value={dueToday.length}
          href="/my-tasks"
          tone={dueToday.length > 0 ? "warning" : undefined}
        />
        <StatTile label="Assigned to you" value={assignedCount} href="/my-tasks" />

        {/*
          Not a link: "done" is the one number here with nowhere useful to go,
          and a tile that navigates to a filtered list of finished work would be
          a dead end dressed as an action.
        */}
        <div className="card-surface flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3">
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xl leading-none font-semibold tabular-nums">
              {completedThisWeek}
            </span>
            {delta > 0 ? (
              <span
                className="flex items-center gap-0.5 text-[0.6875rem] font-medium"
                style={{ color: "var(--chart-3)" }}
              >
                <TrendingUpIcon className="size-3" aria-hidden="true" />
                {delta}
              </span>
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Done this week
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Time-of-day greeting.
 *
 * Rendered on the server, so this is the server's clock rather than the
 * reader's. Close enough for a greeting, and the alternative — deferring it to
 * the client — would flash "Good evening" to somebody whose morning it is.
 */
function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
