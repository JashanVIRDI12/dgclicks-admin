import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { WorkspaceCalendar } from "@/features/tasks/components/workspace-calendar";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { canEditBoard } from "@/features/tasks/permissions";
import { listBoards } from "@/features/tasks/server/board.service";
import { catchUpRecurrences } from "@/features/tasks/server/recurrence.service";
import { listTasksOnBoards } from "@/features/tasks/server/task.service";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage() {
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
  const boardIds = boards.map((board) => board.id);
  const isAdmin = getSessionRole(session) === "admin";
  const editableBoardIds = boards
    .filter(
      (board) => canEditBoard(board, session.user.id, isAdmin),
    )
    .map((board) => board.id);

  await catchUpRecurrences(boardIds);

  const tasks = await listTasksOnBoards({
    boardIds,
    // Completed work stays visible: a month with everything hidden the moment
    // it is finished is a month that looks like nothing happened.
    includeCompleted: true,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description={`Everything with a date across ${active.name}. Drag a task to reschedule it.`}
      />

      <FadeIn>
        <WorkspaceCalendar
          workspaceId={active.id}
          tasks={tasks}
          editableBoardIds={editableBoardIds}
        />
      </FadeIn>
    </div>
  );
}
