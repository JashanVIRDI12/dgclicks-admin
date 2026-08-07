import { BarChart3Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { Progress } from "@/components/ui/progress";
import { requireSession } from "@/features/auth/server/session";
import { BoardIcon } from "@/features/tasks/components/board-icon";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";
import { getWorkspaceReport } from "@/features/tasks/server/insights.service";

export const metadata: Metadata = {
  title: "Reports",
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "urgent" | "warning";
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
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
      </p>
    </div>
  );
}

/**
 * Completions per day for the last fortnight.
 *
 * Bars rather than a line: fourteen discrete daily counts are not a continuous
 * quantity, and a line implies values in between that do not exist.
 */
function Throughput({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const peak = Math.max(1, ...data.map((point) => point.count));
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-sm font-medium">Completed</h2>
        <span className="text-xs text-muted-foreground">
          {total} in the last {data.length} days
        </span>
      </div>

      <div className="flex h-24 items-end gap-1">
        {data.map((point) => (
          <div
            key={point.date}
            className="group/bar flex flex-1 flex-col items-center justify-end gap-1"
            title={`${point.count} completed on ${new Date(point.date).toLocaleDateString(undefined, { dateStyle: "medium" })}`}
          >
            <span className="text-[0.625rem] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/bar:opacity-100">
              {point.count}
            </span>
            <div
              className="w-full rounded-t-sm bg-chart-1 transition-colors group-hover/bar:bg-primary"
              style={{
                // A zero-count day still gets a hairline, so the axis reads as
                // a row of days rather than a gap in the data.
                height: `${Math.max(2, (point.count / peak) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-[0.625rem] text-muted-foreground">
        <span>
          {/* The service always returns a full window, so the first entry is
              the start of the axis; the guard is for the type, not the data. */}
          {data[0]
            ? new Date(data[0].date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })
            : null}
        </span>
        <span>Today</span>
      </div>
    </section>
  );
}

export default async function ReportsPage() {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${session.user.name.trim().split(/\s+/)[0] ?? "My"}'s workspace`}
      />
    );
  }

  const boards = await listBoards(active.id, session.user.id);
  const report = await getWorkspaceReport({ boards });

  if (boards.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reports" description={`How ${active.name} is doing.`} />
        <EmptyState
          icon={BarChart3Icon}
          title="Nothing to report yet"
          description="Create a board and start adding tasks — throughput and workload appear here once there is something to measure."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`How ${active.name} is doing.`}
      />

      <FadeIn className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={report.totals.open} />
        <StatCard label="Completed" value={report.totals.completed} />
        <StatCard
          label="Overdue"
          value={report.totals.overdue}
          tone="urgent"
        />
        <StatCard
          label="Due this week"
          value={report.totals.dueThisWeek}
          tone="warning"
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <Throughput data={report.throughput} />
      </FadeIn>

      <FadeIn delay={0.1} className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-medium">By board</h2>

          <ul className="space-y-3">
            {report.byBoard.map((row) => {
              const total = row.open + row.completed;
              const percent =
                total === 0 ? 0 : Math.round((row.completed / total) * 100);

              return (
                <li key={row.boardId}>
                  <Link
                    href={`/boards/${row.boardId}` as Route}
                    className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-accent/50"
                  >
                    <BoardIcon
                      icon={row.icon}
                      color={row.color}
                      className="size-7 rounded-lg"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm">{row.name}</span>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.completed}/{total}
                        </span>
                      </div>
                      <Progress
                        value={percent}
                        aria-label={`${percent}% complete`}
                        className="mt-1.5 h-1"
                      />
                    </div>

                    {row.overdue > 0 ? (
                      <span
                        className="shrink-0 text-xs font-medium tabular-nums"
                        style={{ color: "var(--priority-urgent)" }}
                      >
                        {row.overdue}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-sm font-medium">Workload</h2>

          {report.byAssignee.length > 0 ? (
            <ul className="space-y-2">
              {report.byAssignee.map((row) => (
                <li
                  key={row.user?.id ?? "unassigned"}
                  className="flex items-center gap-2.5 px-1 py-1"
                >
                  {row.user ? (
                    <AssigneeAvatar user={row.user} className="size-6" />
                  ) : (
                    <span className="size-6 shrink-0 rounded-full bg-muted" />
                  )}

                  <span className="min-w-0 flex-1 truncate text-sm">
                    {row.user?.name ?? "Unassigned"}
                  </span>

                  {row.overdue > 0 ? (
                    <span
                      className="shrink-0 text-xs tabular-nums"
                      style={{ color: "var(--priority-urgent)" }}
                    >
                      {row.overdue} late
                    </span>
                  ) : null}

                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {row.open} open
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No tasks yet.
            </p>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
