"use client";

import { useEffect, useRef } from "react";

import { Confetti, type ConfettiRef } from "@/components/ui/confetti";

const TASK_COMPLETED_EVENT = "dgclicks:task-completed";

export function celebrateTaskCompletion(): void {
  window.dispatchEvent(new Event(TASK_COMPLETED_EVENT));
}

export function TaskCelebration() {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    const celebrate = () => confettiRef.current?.fire();
    window.addEventListener(TASK_COMPLETED_EVENT, celebrate);
    return () => window.removeEventListener(TASK_COMPLETED_EVENT, celebrate);
  }, []);

  return (
    <Confetti
      ref={confettiRef}
      className="fixed inset-0 z-[100] size-full"
    />
  );
}
