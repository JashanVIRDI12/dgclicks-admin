"use client";

import { MenuIcon } from "lucide-react";
import { useEffect } from "react";

import { Brand } from "@/components/layout/brand";
import { SidebarBoards } from "@/components/layout/sidebar-boards";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WorkspaceSwitcher } from "@/features/tasks/components/workspace-switcher";
import type { Board, Workspace } from "@/features/tasks/types";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useUiStore } from "@/stores/ui-store";

/** Nav for viewports below `md`, as a sheet over the content. */
export function MobileNav({
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
  const isOpen = useUiStore((state) => state.isMobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Resizing past the breakpoint while the sheet is open would otherwise leave
  // an invisible open dialog holding the focus trap.
  useEffect(() => {
    if (isDesktop && isOpen) {
      setOpen(false);
    }
  }, [isDesktop, isOpen, setOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
        >
          <MenuIcon className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="h-14 justify-center px-4">
          <SheetTitle asChild>
            <Brand />
          </SheetTitle>
        </SheetHeader>

        <div className="px-3 pb-2">
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeId={activeWorkspaceId}
            isCollapsed={false}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-3">
            <SidebarNav onNavigate={() => setOpen(false)} />
            <SidebarBoards
              boards={boards}
              contextId="mobile"
              onNavigate={() => setOpen(false)}
              canReorder={isAdmin}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
