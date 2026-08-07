"use client";

import confetti, { type Options } from "canvas-confetti";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import { cn } from "@/lib/utils";

export type ConfettiRef = {
  fire: (options?: Options) => void;
};

export const Confetti = forwardRef<
  ConfettiRef,
  {
    active?: boolean;
    className?: string;
  }
>(function Confetti({ active = false, className }, forwardedRef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fireRef = useRef<ReturnType<typeof confetti.create> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const fire = confetti.create(canvas, { resize: true, useWorker: true });
    fireRef.current = fire;

    return () => {
      fire.reset();
      fireRef.current = null;
    };
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      fire: (options = {}) => {
        void fireRef.current?.({
          particleCount: 80,
          spread: 70,
          startVelocity: 38,
          origin: { y: 0.72 },
          disableForReducedMotion: true,
          ...options,
        });
      },
    }),
    [],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    const fire = () => {
      void fireRef.current?.({
        particleCount: 5,
        spread: 55,
        startVelocity: 16,
        ticks: 80,
        scalar: 0.7,
        origin: { x: 0.5, y: 0.85 },
        colors: ["#60a5fa", "#a78bfa", "#2dd4bf", "#fbbf24"],
        disableForReducedMotion: true,
      });
    };

    fire();
    const interval = window.setInterval(fire, 450);
    return () => window.clearInterval(interval);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
    />
  );
});
