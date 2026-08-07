"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export function HoldToConfirm({
  children,
  onConfirm,
  disabled = false,
  duration = 1_600,
  className,
}: {
  children: React.ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  duration?: number;
  className?: string;
}) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const completed = useRef(false);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }

      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    },
    [],
  );

  function stop() {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    startedAt.current = null;

    if (!completed.current) {
      setProgress(0);
    }
  }

  function tick(now: number) {
    if (startedAt.current === null || completed.current) {
      return;
    }

    const next = Math.min((now - startedAt.current) / duration, 1);
    setProgress(next);

    if (next >= 1) {
      completed.current = true;
      frame.current = null;
      onConfirm();
      resetTimer.current = window.setTimeout(() => {
        completed.current = false;
        setProgress(0);
        resetTimer.current = null;
      }, 250);
      return;
    }

    frame.current = requestAnimationFrame(tick);
  }

  function start() {
    if (disabled || startedAt.current !== null || completed.current) {
      return;
    }

    startedAt.current = performance.now();
    frame.current = requestAnimationFrame(tick);
  }

  function resetAfterRelease() {
    stop();

    if (completed.current) {
      completed.current = false;
      setProgress(0);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start();
      }}
      onPointerUp={resetAfterRelease}
      onPointerCancel={resetAfterRelease}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          resetAfterRelease();
        }
      }}
      aria-label={`${typeof children === "string" ? children : "Confirm action"}. Hold for ${duration / 1_000} seconds.`}
      className={cn(
        "relative inline-flex h-9 select-none items-center justify-center overflow-hidden rounded-md bg-destructive px-4 text-sm font-medium text-white shadow-xs outline-none transition-[transform,box-shadow] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 dark:bg-destructive/80",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-black/20"
        style={{ transform: `scaleX(${progress})` }}
      />
      <span className="relative z-10 inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}
