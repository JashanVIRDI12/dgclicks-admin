import type { CSSProperties } from "react";

import type { LabelColor } from "@/features/tasks/constants";
import type { Label } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * The colour a chip paints itself with.
 *
 * Every colour-carrying element in the board sets this one variable and lets
 * `.chip-tinted` in globals.css derive the background, text and hairline from
 * it. Nine label colours therefore cost nine tokens rather than twenty-seven,
 * and none of them need a dark-mode counterpart at the component level.
 */
export function chipStyle(color: LabelColor | string): CSSProperties {
  return { "--chip-color": `var(--label-${color})` } as CSSProperties;
}

export function LabelChip({
  label,
  className,
}: {
  label: Label;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "chip-tinted inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[0.6875rem] leading-4 font-medium",
        className,
      )}
      style={chipStyle(label.color)}
    >
      <span className="truncate">{label.name}</span>
    </span>
  );
}

/** The colour alone, for dense rows where a full chip would not fit. */
export function LabelDot({
  color,
  className,
}: {
  color: LabelColor;
  className?: string;
}) {
  return (
    <span
      className={cn("chip-dot size-2 shrink-0 rounded-full", className)}
      style={chipStyle(color)}
      aria-hidden="true"
    />
  );
}
