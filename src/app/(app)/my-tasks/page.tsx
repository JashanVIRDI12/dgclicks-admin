import { CheckCircle2Icon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { requireSession } from "@/features/auth/server/session";
import { TaskListPanel } from "@/features/tasks/components/task-list-panel";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";
import { listTasksForUser } from "@/features/tasks/server/task.service";
import { daysUntil } from "@/features/tasks/components/task-meta";
import {
  AlarmClockIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  InboxIcon,
} from "lucide-react";
import type { Task } from "@/features/tasks/types";

export const metadata: Metadata = {
  title: "My Tasks",
};

/**
 * Groups by urgency rather than by board.
 *
 * "What do I have to do" is a question about time, not about which team a piece
 * of work belongs to — the board is shown as a hint on each row instead.
 */
function bucket(tasks: Task[]) {
  const overdue: Task[] = [];
  const today: Task[] = [];
  const soon: Task[] = [];
  const later: Task[] = [];
  const undated: Task[] = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      undated.push(task);
      continue;
    }

    const days = daysUntil(task.dueDate);

    if (days < 0) {
      overdue.push(task);
    } else if (days === 0) {
      today.push(task);
    } else if (days <= 7) {
      soon.push(task);
    } else {
      later.push(task);
    }
  }

  return { overdue, today, soon, later, undated };
}

export default async function MyTasksPage() {
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
  const tasks = await listTasksForUser({
    userId: session.user.id,
    boardIds: boards.map((board) => board.id),
    includeCompleted: false,
  });

  const groups = bucket(tasks);
  const boardNames = new Map(boards.map((board) => [board.id, board.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My tasks"
        description={
          tasks.length > 0
            ? `${tasks.length} open across ${active.name}.`
            : `Everything assigned to you in ${active.name}.`
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2Icon}
          title="Nothing on your plate"
          description="Tasks assigned to you show up here, grouped by how soon they are due."
        />
      ) : (
        <FadeIn className="space-y-4">
          {groups.overdue.length > 0 ? (
            <TaskListPanel
              title="Overdue"
              icon={AlarmClockIcon}
              tone="urgent"
              tasks={groups.overdue}
              emptyMessage=""
              showBoardHint
              boardNames={boardNames}
            />
          ) : null}

          {groups.today.length > 0 ? (
            <TaskListPanel
              title="Today"
              icon={CalendarCheckIcon}
              tone="warning"
              tasks={groups.today}
              emptyMessage=""
              showBoardHint
              boardNames={boardNames}
            />
          ) : null}

          {groups.soon.length > 0 ? (
            <TaskListPanel
              title="This week"
              icon={CalendarClockIcon}
              tasks={groups.soon}
              emptyMessage=""
              showBoardHint
              boardNames={boardNames}
            />
          ) : null}

          {groups.later.length > 0 ? (
            <TaskListPanel
              title="Later"
              icon={CalendarClockIcon}
              tasks={groups.later}
              emptyMessage=""
              showBoardHint
              boardNames={boardNames}
            />
          ) : null}

          {groups.undated.length > 0 ? (
            <TaskListPanel
              title="No date"
              icon={InboxIcon}
              tasks={groups.undated}
              emptyMessage=""
              showBoardHint
              boardNames={boardNames}
            />
          ) : null}
        </FadeIn>
      )}
    </div>
  );
}
