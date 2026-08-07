import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { AssistantTrigger } from "@/features/assistant/components/assistant-trigger";
import {
  UserMenu,
  type UserMenuUser,
} from "@/features/auth/components/user-menu";
import { CommandPaletteTrigger } from "@/features/tasks/components/command-palette-trigger";
import type { Board, Workspace } from "@/features/tasks/types";

/**
 * Server component: the session is read once in the guarded layout and passed
 * down, so the topbar does not trigger its own session lookup on every render.
 */
export function Topbar({
  user,
  workspaces,
  activeWorkspaceId,
  boards,
  isAdmin,
}: {
  user: UserMenuUser;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  boards: Board[];
  isAdmin: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 bg-background/80 px-4 backdrop-blur-md md:px-8">
      <MobileNav
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        boards={boards}
        isAdmin={isAdmin}
      />

      <CommandPaletteTrigger />

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <AssistantTrigger />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
