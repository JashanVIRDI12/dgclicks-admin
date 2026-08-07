import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Brand({
  isCollapsed = false,
  className,
}: {
  isCollapsed?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm font-semibold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
      >
        {siteConfig.shortName}
      </span>
      <span className={cn("truncate", isCollapsed && "sr-only")}>
        {siteConfig.name}
      </span>
    </Link>
  );
}
