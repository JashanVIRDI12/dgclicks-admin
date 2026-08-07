"use client";

import { PanelLeftIcon } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { SidebarBoards } from "@/components/layout/sidebar-boards";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkspaceSwitcher } from "@/features/tasks/components/workspace-switcher";
import type { Board, Workspace } from "@/features/tasks/types";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/** Desktop sidebar. Hidden below `md`, where the sheet in `MobileNav` takes over. */
export function Sidebar({
  workspaces,
  activeWorkspaceId,
  boards,
  isAdmin,
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  boards: Board[];
  isAdmin: boolean;
}) {
  const isCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r bg-sidebar md:flex",
        "transition-[width] duration-200",
        isCollapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center px-4",
          isCollapsed && "justify-center px-0",
        )}
      >
        <Brand isCollapsed={isCollapsed} />
      </div>

      <div className={cn("px-3 pb-2", isCollapsed && "px-2")}>
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeId={activeWorkspaceId}
          isCollapsed={isCollapsed}
        />
      </div>

      <ScrollArea className="flex-1">
        <div className={cn("space-y-6 p-3", isCollapsed && "px-2")}>
          <SidebarNav isCollapsed={isCollapsed} />
          <SidebarBoards
            boards={boards}
            contextId="desktop"
            isCollapsed={isCollapsed}
            canReorder={isAdmin}
          />
        </div>
      </ScrollArea>

      <div className={cn("p-3", isCollapsed && "px-2")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              onClick={toggleSidebar}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              className={cn(
                "text-muted-foreground",
                !isCollapsed && "w-full justify-start",
              )}
            >
              <PanelLeftIcon className="size-4" aria-hidden="true" />
              {!isCollapsed ? <span>Collapse</span> : null}
            </Button>
          </TooltipTrigger>
          {isCollapsed ? (
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </aside>
  );
}
