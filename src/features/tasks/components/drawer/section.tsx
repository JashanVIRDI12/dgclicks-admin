import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One section of the task panel.
 *
 * Six sections were each hand-rolling the same header, with small drifts: a
 * count in three of them, an action button aligned by hand every time, headings
 * that all looked identical so the eye had nothing to catch on scrolling past.
 *
 * Standardising it is what gives the panel a rhythm. Every heading carries an
 * icon, so sections are told apart by shape before they are read; every count
 * renders the same; every action lands in the same place down the right edge.
 */
export function DrawerSection({
  icon: Icon,
  title,
  meta,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** A count or summary. Rendered as a chip beside the heading. */
  meta?: ReactNode;
  /** The section's own control, pinned right. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-7 items-center gap-2">
        <Icon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <h3 className="text-sm font-medium">{title}</h3>

        {meta ? (
          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}

        {action ? <div className="ml-auto flex items-center">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

/**
 * What a section says when it is empty.
 *
 * Bare muted text under a heading read as an orphaned caption — it was unclear
 * whether "Steps to tick off." described the section above it or the one below.
 * A bounded container settles that.
 *
 * Deliberately one short line. A brand-new task has three empty sections at
 * once, and two-line explanations in all three turned the panel into a page of
 * instructions with a task somewhere behind it. The border is `border-border/60`
 * rather than a full-strength dash so three of them stacked recede instead of
 * striping the panel.
 */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
