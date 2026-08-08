import { KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { WorkspaceInvites } from "@/features/tasks/components/workspace-invites";
import { WorkspaceMembers } from "@/features/tasks/components/workspace-members";
import { WorkspaceDangerZone } from "@/features/tasks/components/workspace-danger-zone";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { canManageWorkspace } from "@/features/tasks/permissions";
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
  const canManage = canManageWorkspace(active, session.user.id, isAdmin);
  // A live link carries its own token, so it is shown only to the people who
  // could have created it.
  const invites = canManage
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
          currentUserId={session.user.id}
          canManage={canManage}
        />

        {canManage ? (
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
