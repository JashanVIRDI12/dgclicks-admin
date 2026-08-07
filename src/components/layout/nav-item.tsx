"use client";

import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavItem as NavItemConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function NavItem({
  item,
  isActive,
  isCollapsed,
  onNavigate,
}: {
  item: NavItemConfig;
  isActive: boolean;
  isCollapsed: boolean;
  /** Lets the mobile sheet close itself when a destination is chosen. */
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      // `aria-current` is what tells a screen reader which page it is on;
      // the background colour only conveys that to sighted users.
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive && "bg-sidebar-accent text-sidebar-foreground",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={cn(isCollapsed && "sr-only")}>{item.title}</span>
    </Link>
  );

  if (!isCollapsed) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.title}</TooltipContent>
    </Tooltip>
  );
}
