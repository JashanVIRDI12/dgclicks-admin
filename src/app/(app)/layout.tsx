import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getSessionRole, requireSession } from "@/features/auth/server/session";
import { canManageWorkspace } from "@/features/tasks/permissions";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";
import { listBoards } from "@/features/tasks/server/board.service";
import { env } from "@/lib/env";

/**
 * The authorisation boundary for every page in this group.
 *
 * The proxy already redirected users without a session cookie; this is the
 * check that actually validates it. Server actions re-check independently —
 * a guarded layout protects the page it renders, not the actions that page
 * calls.
 *
 * The workspace and its boards are read once here and passed down, so the
 * sidebar and the command palette do not each repeat the query on every
 * navigation.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const { workspaces, active } = await getActiveWorkspaceContext(
    session.user.id,
  );
  const boards = active ? await listBoards(active.id, session.user.id) : [];
  const isAdmin = getSessionRole(session) === "admin";

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      workspaces={workspaces}
      activeWorkspaceId={active?.id ?? null}
      boards={boards}
      currentUserId={session.user.id}
      isAdmin={isAdmin}
      canManageWorkspace={
        active ? canManageWorkspace(active, session.user.id, isAdmin) : false
      }
      assistantEnabled={env.isAssistantEnabled}
    >
      {children}
    </AppShell>
  );
}
