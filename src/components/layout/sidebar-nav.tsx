"use client";

import { usePathname } from "next/navigation";

import { NavItem } from "@/components/layout/nav-item";
import { navigation, isNavItemActive } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * The navigation list itself, shared by the desktop sidebar and the mobile
 * sheet so there is exactly one place where nav is rendered.
 */
export function SidebarNav({
  isCollapsed = false,
  onNavigate,
}: {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {navigation.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          {section.label ? (
            <p
              className={cn(
                "px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                isCollapsed && "sr-only",
              )}
            >
              {section.label}
            </p>
          ) : null}

          {section.items.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isNavItemActive(pathname, item.href)}
              isCollapsed={isCollapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
