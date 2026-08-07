import { cn } from "@/lib/utils";

/**
 * The assistant's "thinking" indicator.
 *
 * Two counter-rotating arcs around a pulsing core: the arcs read as processing,
 * and the core keeps the shape legible at the 16px size the composer status row
 * uses, where a single thin ring reads as a smudge. Every animation is a
 * Tailwind class rather than an inline style, so the global
 * `prefers-reduced-motion` rule in `globals.css` still switches it off.
 */
export function AiLoader({
  label = "Thinking",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("relative grid size-10 shrink-0 place-items-center", className)}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary [animation-duration:1.4s]"
      />
      <span
        aria-hidden="true"
        className="absolute inset-[26%] animate-spin rounded-full border-2 border-primary/10 border-b-primary/70 [animation-direction:reverse] [animation-duration:2s]"
      />
      <span
        aria-hidden="true"
        className="size-1 animate-pulse rounded-full bg-primary [animation-duration:1.6s]"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
