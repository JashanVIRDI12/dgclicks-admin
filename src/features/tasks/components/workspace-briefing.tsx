import {
  AlertTriangleIcon,
  PauseCircleIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";

import type { WorkspaceSignals } from "@/features/tasks/server/intelligence.service";

/**
 * The things nothing else on the dashboard would tell you.
 *
 * Deliberately not a summary. Overdue, due today and assigned-to-you already
 * have panels below, and repeating them here would be a second copy to keep in
 * step and a longer page to scroll. This surfaces only what has no other home:
 * work that has quietly stopped moving, urgent work nobody owns, one person
 * carrying the team, a board that has gone silent.
 *
 * Every figure comes from `getWorkspaceSignals`, counted in the database. None
 * of it is inferred, and none of it is written by a model.
 *
 * It renders nothing at all when there is nothing to say — an "all clear" card
 * is a thing to read every morning that never changes, which is how people
 * learn to stop reading a section.
 */

type Insight = {
  icon: LucideIcon;
  tone: "urgent" | "warning" | "neutral";
  title: string;
  detail: string;
  href?: Route;
};

const TONE_COLOR: Record<Insight["tone"], string> = {
  urgent: "var(--priority-urgent)",
  warning: "var(--priority-medium)",
  neutral: "var(--muted-foreground)",
};

function buildInsights(signals: WorkspaceSignals): Insight[] {
  const insights: Insight[] = [];

  if (signals.unassigned.urgent > 0) {
    insights.push({
      icon: UserPlusIcon,
      tone: "urgent",
      title: `${signals.unassigned.urgent} urgent ${
        signals.unassigned.urgent === 1 ? "task has" : "tasks have"
      } nobody on them`,
      // Names the work rather than just counting it: "3 unassigned" is a
      // number, "Replace images" is something you can act on.
      detail: signals.urgentUnassigned.slice(0, 3).join(" · "),
      href: "/boards",
    });
  }

  if (signals.stalled.count > 0) {
    insights.push({
      icon: PauseCircleIcon,
      tone: "warning",
      title: `${signals.stalled.count} ${
        signals.stalled.count === 1 ? "task has" : "tasks have"
      } not moved in a week`,
      detail: signals.stalled.examples.slice(0, 3).join(" · "),
    });
  }

  if (signals.overloaded) {
    insights.push({
      icon: UsersIcon,
      tone: "warning",
      title: `${signals.overloaded} is carrying most of the open work`,
      detail: signals.workload
        .slice(0, 3)
        .map((person) => `${person.name} ${person.open}`)
        .join(" · "),
    });
  }

  if (signals.quietBoards.length > 0) {
    insights.push({
      icon: AlertTriangleIcon,
      tone: "neutral",
      title: `${
        signals.quietBoards.length === 1 ? "A board has" : "Boards have"
      } gone quiet`,
      detail: `${signals.quietBoards.slice(0, 3).join(", ")} — nothing touched in two weeks`,
    });
  }

  return insights;
}

export function WorkspaceBriefing({ signals }: { signals: WorkspaceSignals }) {
  const insights = buildInsights(signals);

  if (insights.length === 0) {
    return null;
  }

  return (
    <section aria-label="Needs attention" className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-medium">Needs attention</h2>
        {signals.truncated ? (
          // Honest about its own limits rather than presenting a partial scan
          // as the whole picture.
          <span className="text-xs text-muted-foreground">
            based on the {signals.scanned} most recent open tasks
          </span>
        ) : null}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {insights.map((insight) => {
          const body = (
            <>
              <insight.icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: TONE_COLOR[insight.tone] }}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-pretty">
                  {insight.title}
                </span>
                {insight.detail ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {insight.detail}
                  </span>
                ) : null}
              </span>
            </>
          );

          return insight.href ? (
            <Link
              key={insight.title}
              href={insight.href}
              className="card-surface card-interactive flex gap-2.5 px-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {body}
            </Link>
          ) : (
            <div
              key={insight.title}
              className="card-surface flex gap-2.5 px-3.5 py-3"
            >
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
