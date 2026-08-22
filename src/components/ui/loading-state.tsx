"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A pixel-grid loader for work that takes long enough to worry about.
 *
 * Three variants over the same 3×3 grid:
 *   Drive  — square cells, a chevron wavefront driving right. The 650ms cycle
 *            is shorter than the sweep, so two fronts are always in flight.
 *   Dots   — the same wavefront, circular cells.
 *   Orbit  — a single comet lapping the perimeter.
 *
 * The elapsed timer is the point of it. An assistant turn runs tool calls
 * before it answers and can take many seconds, and a spinner with no clock
 * looks identical whether it has been three seconds or thirty — which is when
 * people start reloading a page that was working fine.
 *
 * Animation lives in `globals.css`, not in inline styles, so the global
 * `prefers-reduced-motion` rule can switch it off. Under reduced motion the
 * grid settles to its dim state and the label goes solid; the timer keeps
 * ticking, because knowing how long you have waited is information, not
 * decoration.
 */

/** Chevron delays: distance from the left edge, bent around the middle row. */
const CHEVRON = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  const column = index % 3;

  return (column + Math.abs(row - 1)) * 90;
});

/** Perimeter walk, clockwise from the top-left. The centre cell never lights. */
const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const ORBIT = Array.from({ length: 9 }, (_, index) => {
  const step = ORBIT_ORDER.indexOf(index);

  return step === -1 ? null : step * 110;
});

const PATTERNS = {
  Drive: { delays: CHEVRON, duration: 650, round: false },
  Dots: { delays: CHEVRON, duration: 650, round: true },
  Orbit: { delays: ORBIT, duration: 950, round: false },
} as const;

export type LoadingVariant = keyof typeof PATTERNS;

/**
 * Tenths of a second since mount, formatted.
 *
 * The interval is the only writer — nothing is set during the effect body,
 * which the React Compiler rejects — so the first frame reads 0.0s and the
 * clock starts from there.
 */
function useElapsed(): string {
  const [tenths, setTenths] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTenths((value) => value + 1), 100);

    return () => clearInterval(timer);
  }, []);

  const total = tenths / 10;

  if (total < 60) {
    return `${total.toFixed(1)}s`;
  }

  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function LoadingState({
  label = "Working",
  variant = "Drive",
  className,
}: {
  label?: string;
  variant?: LoadingVariant;
  className?: string;
}) {
  const elapsed = useElapsed();
  const { delays, duration, round } = PATTERNS[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex w-fit items-center gap-2.5", className)}
    >
      <span aria-hidden="true" className="grid grid-cols-[repeat(3,4px)] gap-[1.5px]">
        {delays.map((delay, index) => (
          <span
            key={index}
            className={cn(
              "size-[4px] bg-foreground",
              round ? "rounded-full" : "rounded-[1px]",
              delay === null ? "opacity-[0.07]" : "pixel-cell opacity-[0.15]",
            )}
            style={
              delay === null
                ? undefined
                : {
                    // Only the offsets are inline. The animation itself is a
                    // class, so the reduced-motion rule can still stop it.
                    animationDelay: `${delay}ms`,
                    animationDuration: `${duration}ms`,
                  }
            }
          />
        ))}
      </span>

      <span className="shimmer-label text-[13px] font-medium">{label}</span>

      <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {elapsed}
      </span>

      <span className="sr-only">
        {label}, {elapsed} elapsed
      </span>
    </div>
  );
}

export default LoadingState;
