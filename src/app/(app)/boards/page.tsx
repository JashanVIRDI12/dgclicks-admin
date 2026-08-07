import { LayoutGridIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { BoardFormDialog } from "@/features/tasks/components/board-form-dialog";
import { BoardGrid } from "@/features/tasks/components/board-grid";
import { InviteLinkButton } from "@/features/tasks/components/invite-link-button";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { WorkspaceSoloStrip } from "@/features/tasks/components/workspace-solo-strip";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoardSummaries } from "@/features/tasks/server/board.service";
import { listWorkspaceInvites } from "@/features/tasks/server/invite.service";

export const metadata: Metadata = {
  title: "Boards",
};

export default async function BoardsPage() {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${session.user.name.trim().split(/\s+/)[0] ?? "My"}'s workspace`}
      />
    );
  }

  const boards = await listBoardSummaries(active.id, session.user.id);
  const isAdmin = getSessionRole(session) === "admin";
  const isSolo = active.members.length <= 1;
  // Reused by both the header button and the strip, so pressing either hands
  // out the link that already exists rather than minting a second one.
  const inviteUrl = isAdmin
    ? ((await listWorkspaceInvites(active.id, session.user.id))[0]?.url ?? null)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Boards"
        description={`Every workflow in ${active.name}.`}
        actions={isAdmin ? (
          <div className="flex items-center gap-2">
            <InviteLinkButton
              workspaceId={active.id}
              existingUrl={inviteUrl}
              size="default"
            />
            <BoardFormDialog
              workspaceId={active.id}
              trigger={
                <Button>
                  <PlusIcon className="size-4" aria-hidden="true" />
                  New board
                </Button>
              }
            />
          </div>
        ) : undefined}
      />

      {isSolo ? (
        <WorkspaceSoloStrip
          workspaceName={active.name}
          workspaceId={active.id}
          existingInviteUrl={inviteUrl}
          canInvite={isAdmin}
        />
      ) : null}

      <FadeIn>
        {boards.length > 0 ? (
          <BoardGrid boards={boards} />
        ) : (
          <EmptyState
            icon={LayoutGridIcon}
            title="No boards yet"
            description="A board is one team or workflow — SEO, Development, Content. It starts with five columns you can rename."
            action={isAdmin ? (
              <BoardFormDialog
                workspaceId={active.id}
                trigger={
                  <Button>
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Create your first board
                  </Button>
                }
              />
            ) : undefined}
          />
        )}
      </FadeIn>
    </div>
  );
}
