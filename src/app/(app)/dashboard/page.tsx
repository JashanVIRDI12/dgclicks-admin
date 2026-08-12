import {
  AlarmClockIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  HistoryIcon,
  UserCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { listActivity } from "@/features/activity/server/activity.service";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { DashboardHero } from "@/features/tasks/components/dashboard-hero";
import { QuickCreateTask } from "@/features/tasks/components/quick-create-task";
import { TaskListPanel } from "@/features/tasks/components/task-list-panel";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { canEditBoard } from "@/features/tasks/permissions";
import { listBoards } from "@/features/tasks/server/board.service";
import { getDashboardData } from "@/features/tasks/server/insights.service";
import { catchUpRecurrences } from "@/features/tasks/server/recurrence.service";
import { archiveCompletedTasks } from "@/features/tasks/server/task.service";

export const metadata: Metadata = {
  title: "Dashboard",
};

/** First name only, so the greeting reads naturally. */
function getGreetingName(name: string, email: string): string {
  return name.trim().split(/\s+/)[0] || email;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${getGreetingName(session.user.name, session.user.email)}'s workspace`}
      />
    );
  }

  const boards = await listBoards(active.id, session.user.id);
  const isAdmin = getSessionRole(session) === "admin";
  const editableBoards = boards.filter(
    (board) => canEditBoard(board, session.user.id, isAdmin),
  );
  const boardIds = boards.map((board) => board.id);

  // Both read-triggered sweeps, run together because they are both "catch up on
  // what should have happened while nobody was looking". Recurrence spawns work;
  // the archive sweep retires it a day after it was finished.
  await Promise.all([
    catchUpRecurrences(boardIds),
    archiveCompletedTasks(boardIds),
  ]);

  const [data, activity] = await Promise.all([
    getDashboardData({ userId: session.user.id, boardIds }),
    listActivity({ page: 1, boardIds }),
  ]);

  const boardNames = new Map(boards.map((board) => [board.id, board.name]));

  return (
    <div className="space-y-6">
      <FadeIn>
        <DashboardHero
          name={getGreetingName(session.user.name, session.user.email)}
          overdue={data.overdue}
          dueToday={data.dueToday}
          assignedCount={data.assignedToMe.length}
          completedThisWeek={data.completedThisWeek}
          completedLastWeek={data.completedLastWeek}
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <QuickCreateTask boards={editableBoards} />
      </FadeIn>

      {/*
        Asymmetric on purpose. The old layout was a 2×3 grid of equal panels,
        which said every one of these mattered the same amount — so the eye had
        to read all six to find the one that did. Your own work gets the wide
        column; what the rest of the workspace is doing sits beside it, present
        but not competing.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <FadeIn delay={0.1} className="space-y-4">
          <TaskListPanel
            title="Needs you"
            icon={AlarmClockIcon}
            tone={data.overdue.length > 0 ? "urgent" : "warning"}
            tasks={[...data.overdue, ...data.dueToday]}
            emptyMessage="Nothing of yours is overdue or due today."
            showBoardHint
            boardNames={boardNames}
          />

          <TaskListPanel
            title="Next two weeks"
            icon={CalendarClockIcon}
            tasks={data.upcoming}
            emptyMessage="None of your work is due in the next two weeks."
            showBoardHint
            boardNames={boardNames}
          />

          <TaskListPanel
            title="Assigned to you"
            icon={UserCheckIcon}
            tasks={data.assignedToMe}
            emptyMessage="Nothing is assigned to you right now."
            showBoardHint
            boardNames={boardNames}
          />
        </FadeIn>

        <FadeIn delay={0.15} className="space-y-4">
          <section className="card-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <HistoryIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="text-sm font-medium">Team activity</h2>
            </div>

            {/*
              Three, not eight. This is a sidebar panel on a screen about your
              own work — a long scroll of everyone else's edits pushed the
              things you actually have to do off the fold, and the full history
              already has a page of its own that pages properly.
            */}
            <ActivityFeed
              entries={[...activity.items].slice(0, 3)}
              emptyDescription="Changes across your boards will appear here as the team works."
            />

            {activity.items.length > 0 ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="mt-2 h-8 w-full justify-center text-muted-foreground"
              >
                <Link href="/activity">
                  Show more
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </section>

          <TaskListPanel
            title="Recently updated"
            icon={CalendarCheckIcon}
            tasks={data.recentlyUpdated}
            emptyMessage="Nothing has changed yet."
            showBoardHint
            boardNames={boardNames}
          />
        </FadeIn>
      </div>
    </div>
  );
}
