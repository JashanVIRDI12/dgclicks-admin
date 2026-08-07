import { KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { listTeamMembers } from "@/features/auth/server/users.service";
import { WorkspaceInvites } from "@/features/tasks/components/workspace-invites";
import { WorkspaceMembers } from "@/features/tasks/components/workspace-members";
import { WorkspaceDangerZone } from "@/features/tasks/components/workspace-danger-zone";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listWorkspaceInvites } from "@/features/tasks/server/invite.service";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${session.user.name.trim().split(/\s+/)[0] ?? "My"}'s workspace`}
      />
    );
  }

  const isAdmin = getSessionRole(session) === "admin";
  const teamMembers = isAdmin ? await listTeamMembers() : active.members;
  // Only administrators can create or revoke links, so only they are shown any.
  const invites = isAdmin
    ? await listWorkspaceInvites(active.id, session.user.id)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your workspace and your account."
      />

      <FadeIn className="space-y-4">
        <WorkspaceMembers
          workspace={active}
          teamMembers={teamMembers}
          currentUserId={session.user.id}
          canManage={isAdmin}
        />

        {isAdmin ? (
          <WorkspaceInvites workspaceId={active.id} invites={invites} />
        ) : null}

        <section className="rounded-2xl bg-card p-4 shadow-soft">
          <h2 className="mb-1 text-sm font-medium">Account</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Signed in as {session.user.email}.
          </p>

          <Button asChild variant="outline" size="sm">
            <Link href="/settings/security">
              <KeyRoundIcon className="size-4" aria-hidden="true" />
              Password and sessions
            </Link>
          </Button>
        </section>

        {isAdmin ? <WorkspaceDangerZone workspace={active} /> : null}
      </FadeIn>
    </div>
  );
}
