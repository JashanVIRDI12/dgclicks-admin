"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAssistantEnabled } from "@/features/assistant/components/assistant-provider";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * The always-available way in, next to the theme toggle.
 *
 * Carries its label on anything wider than a phone: an unlabelled sparkle is
 * the one control in the topbar whose meaning nobody guesses, and this is the
 * only entry point on pages that have no board or task to ask about.
 */
export function AssistantTrigger() {
  const enabled = useAssistantEnabled();
  const setOpen = useUiStore((state) => state.setAssistantOpen);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!enabled}
      title={
        enabled
          ? "Ask the workspace assistant"
          : "Configure OpenRouter to enable the assistant"
      }
      aria-label="Ask the workspace assistant"
      onClick={() => setOpen(true)}
      className={cn(enabled && "btn-ai")}
    >
      <SparklesIcon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">Ask AI</span>
    </Button>
  );
}
