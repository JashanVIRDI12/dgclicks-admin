import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { requireSession } from "@/features/auth/server/session";
import { ArchiveList } from "@/features/tasks/components/archive-list";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";
import { listArchivedTasks } from "@/features/tasks/server/task.service";
import { ARCHIVE_COMPLETED_AFTER_HOURS } from "@/features/tasks/constants";

export const metadata: Metadata = {
  title: "Archive",
};

/**
 * Where finished work goes.
 *
 * Scoped through `listBoards(workspaceId, viewerId)` like every other list in
 * the app, so a private board's tasks cannot surface here to someone who cannot
 * see the board itself — an archive is exactly the kind of screen where that
 * check gets forgotten.
 */
export default async function ArchivePage() {
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
  const tasks = await listArchivedTasks(boards.map((board) => board.id));

  const boardNames = Object.fromEntries(
    boards.map((board) => [board.id, board.name]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        description={`Completed work moves here ${ARCHIVE_COMPLETED_AFTER_HOURS} hours after it is finished. Nothing is deleted, and it all still counts towards your totals.`}
      />

      <FadeIn>
        <ArchiveList tasks={tasks} boardNames={boardNames} />
      </FadeIn>
    </div>
  );
}
