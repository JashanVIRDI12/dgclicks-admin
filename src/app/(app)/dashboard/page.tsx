import {
  AlarmClockIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  HistoryIcon,
  UserCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { listActivity } from "@/features/activity/server/activity.service";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { QuickCreateTask } from "@/features/tasks/components/quick-create-task";
import { TaskListPanel } from "@/features/tasks/components/task-list-panel";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { canEditBoard } from "@/features/tasks/permissions";
import { listBoards } from "@/features/tasks/server/board.service";
import { getDashboardData } from "@/features/tasks/server/insights.service";
import { catchUpRecurrences } from "@/features/tasks/server/recurrence.service";

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

  // The other half of recurrence generation: a task due today appears here even
  // if nobody has opened its board.
  await catchUpRecurrences(boardIds);

  const [data, activity] = await Promise.all([
    getDashboardData({ userId: session.user.id, boardIds }),
    listActivity({ page: 1, boardIds }),
  ]);

  const boardNames = new Map(boards.map((board) => [board.id, board.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good to see you, ${getGreetingName(session.user.name, session.user.email)}`}
        description={`What needs attention across ${active.name}.`}
      />

      <FadeIn>
        <QuickCreateTask boards={editableBoards} />
      </FadeIn>

      <FadeIn delay={0.05} className="grid gap-4 lg:grid-cols-2">
        <TaskListPanel
          title="Overdue"
          icon={AlarmClockIcon}
          tone="urgent"
          tasks={data.overdue}
          emptyMessage="Nothing is late. "
          showBoardHint
          boardNames={boardNames}
        />

        <TaskListPanel
          title="Due today"
          icon={CalendarCheckIcon}
          tone="warning"
          tasks={data.dueToday}
          emptyMessage="Nothing due today."
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

        <TaskListPanel
          title="Next two weeks"
          icon={CalendarClockIcon}
          tasks={data.upcoming}
          emptyMessage="No deadlines coming up."
          showBoardHint
          boardNames={boardNames}
        />
      </FadeIn>

      <FadeIn delay={0.1} className="grid gap-4 lg:grid-cols-2">
        <TaskListPanel
          title="Recently updated"
          icon={HistoryIcon}
          tasks={data.recentlyUpdated}
          emptyMessage="Nothing has changed yet."
          showBoardHint
          boardNames={boardNames}
        />

        <section className="rounded-2xl bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <HistoryIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-medium">Activity</h2>
          </div>

          <ActivityFeed
            entries={[...activity.items].slice(0, 8)}
            emptyDescription="Changes across your boards will appear here as the team works."
          />
        </section>
      </FadeIn>
    </div>
  );
}
