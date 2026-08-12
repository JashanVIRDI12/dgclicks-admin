import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Building blocks for the guide.
 *
 * Kept apart from the page so the page stays a table of contents rather than a
 * thousand lines of markup, and so the shortcut and callout styling is defined
 * once instead of per section.
 */

export function Section({
  id,
  icon: Icon,
  title,
  lede,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>

        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">
            {lede}
          </p>
        </div>
      </div>

      <div className="space-y-3 pl-11">{children}</div>
    </section>
  );
}

/** A single keystroke. Several in a row read as a sequence, not a chord. */
export function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-card px-1.5 font-sans text-[0.6875rem] font-medium text-foreground shadow-soft">
      {children}
    </kbd>
  );
}

export function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <span key={key} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-[0.6875rem] text-muted-foreground">
                then
              </span>
            ) : null}
            <Key>{key}</Key>
          </span>
        ))}
      </span>
      <span className="text-sm text-pretty text-muted-foreground">
        {description}
      </span>
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card-surface p-4", className)}>
      {children}
    </div>
  );
}

/**
 * The distinctions people get wrong, stated where they will be read.
 *
 * Every one of these exists because the app makes a choice that is defensible
 * but not guessable — checklist versus subtask, what Done means, where a repeat
 * goes. A guide that only lists features would leave all of them to be
 * discovered by being surprised.
 */
export function Note({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="chip-tinted rounded-xl px-3.5 py-3"
      style={{ "--chip-color": "var(--brand)" } as React.CSSProperties}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-pretty opacity-90">{children}</p>
    </div>
  );
}

export function Steps({ items }: { items: readonly string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-sm text-pretty">
          <span
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-medium tabular-nums text-muted-foreground"
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ol>
  );
}
