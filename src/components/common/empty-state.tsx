import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "nothing here yet" panel. Used for empty lists, empty search results and
 * unbuilt surfaces, so absence of data always looks deliberate.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <div
          className="mb-4 flex size-10 items-center justify-center rounded-full bg-muted"
          aria-hidden="true"
        >
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}

      <p className="font-medium">{title}</p>

      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
