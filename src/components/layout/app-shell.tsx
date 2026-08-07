import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AssistantPanel } from "@/features/assistant/components/assistant-panel";
import { AssistantProvider } from "@/features/assistant/components/assistant-provider";
import type { UserMenuUser } from "@/features/auth/components/user-menu";
import { CommandPalette } from "@/features/tasks/components/command-palette";
import { TaskCelebration } from "@/features/tasks/components/task-celebration";
import type { Board, Workspace } from "@/features/tasks/types";

import { AppShellContent } from "./app-shell-content";

/**
 * Frame for every authenticated page: fixed sidebar, sticky topbar, scrolling
 * content.
 *
 * Stays a server component so `children` render on the server; only the parts
 * that need browser state — the collapse toggle, the palette, the switcher —
 * are client components.
 */
export function AppShell({
  user,
  workspaces,
  activeWorkspaceId,
  boards,
  currentUserId,
  isAdmin,
  assistantEnabled,
  children,
}: {
  user: UserMenuUser;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  boards: Board[];
  currentUserId: string;
  isAdmin: boolean;
  assistantEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh">
      {/* First tab stop on every page: lets keyboard users jump the nav. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-popover focus:px-3 focus:py-2 focus:text-sm focus:shadow-panel"
      >
        Skip to content
      </a>

      <Sidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        boards={boards}
        isAdmin={isAdmin}
      />

      {/*
        Wraps the topbar and the page, the two places an "Ask AI" button can
        appear. The sidebar and the panel below have no need for it.
      */}
      <AssistantProvider enabled={assistantEnabled}>
        <AppShellContent>
          <Topbar
            user={user}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            boards={boards}
            isAdmin={isAdmin}
          />

          <main
            id="main"
            className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-7"
          >
            {/*
              Boards need the full width and their own scroll container; every
              other page reads better in a measured column. `has-` keys off the
              board's own marker rather than the route, so the rule lives with
              the layout that needs it.
            */}
            <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col has-[[data-board-surface]]:max-w-none">
              {children}
            </div>
          </main>
        </AppShellContent>
      </AssistantProvider>

      <CommandPalette
        boards={boards}
        activeWorkspaceId={activeWorkspaceId}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      <AssistantPanel
        enabled={assistantEnabled}
        activeWorkspaceId={activeWorkspaceId}
      />
      <TaskCelebration />
    </div>
  );
}
