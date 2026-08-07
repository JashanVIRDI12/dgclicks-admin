"use client";

import type { ReactNode } from "react";

import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * Offsets the content column by the sidebar's width.
 *
 * Isolated into its own client component purely so `AppShell` — and therefore
 * everything rendered inside it — can stay on the server. This subscribes to
 * the collapse state; its children do not re-render when it changes.
 */
export function AppShellContent({ children }: { children: ReactNode }) {
  const isCollapsed = useUiStore((state) => state.isSidebarCollapsed);

  return (
    <div
      className={cn(
        "flex min-h-svh flex-col transition-[padding] duration-200",
        isCollapsed ? "md:pl-[68px]" : "md:pl-60",
      )}
    >
      {children}
    </div>
  );
}
