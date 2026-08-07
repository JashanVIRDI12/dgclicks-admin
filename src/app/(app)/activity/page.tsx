import type { Metadata } from "next";
import { z } from "zod";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { PaginationControls } from "@/components/common/pagination-controls";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { listActivity } from "@/features/activity/server/activity.service";
import { requireSession } from "@/features/auth/server/session";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";

export const metadata: Metadata = {
  title: "Activity",
};

const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

export default async function ActivityPage({
  searchParams,
}: PageProps<"/activity">) {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${session.user.name.trim().split(/\s+/)[0] ?? "My"}'s workspace`}
      />
    );
  }

  const page = pageSchema.parse((await searchParams).page ?? 1);

  // Scoped to the boards in this workspace, including archived ones: history
  // that disappears when a board is archived is not history.
  const boards = await listBoards(active.id, session.user.id, { includeArchived: true });
  const activity = await listActivity({
    page,
    boardIds: boards.map((board) => board.id),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description={`Everything that has happened across ${active.name}.`}
      />

      <FadeIn>
        <ActivityFeed
          entries={[...activity.items]}
          emptyDescription="Changes to boards, tasks and comments will appear here as your team works."
        />
      </FadeIn>

      <PaginationControls
        page={activity.page}
        pageSize={activity.pageSize}
        total={activity.total}
        hasMore={activity.hasMore}
      />
    </div>
  );
}
