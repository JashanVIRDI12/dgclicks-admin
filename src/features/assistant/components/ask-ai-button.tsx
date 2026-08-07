"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAssistantEnabled } from "@/features/assistant/components/assistant-provider";
import type { AssistantAction } from "@/features/assistant/prompts";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/**
 * Hands a prepared prompt to the assistant panel.
 *
 * The prompt lands in the composer rather than being sent: these actions
 * create tasks and rewrite descriptions, and the cheapest place to correct one
 * is before it runs, not after. The panel is where the conversation and its
 * confirmations already live, so every button ends in the same place.
 *
 * Renders nothing when OpenRouter is unconfigured. A disabled control on every
 * board and every task would be a dozen reminders of a setting most readers
 * cannot change, and the topbar's single disabled trigger already says it.
 */
export function AskAiButton({
  actions,
  className,
}: {
  actions: AssistantAction[];
  className?: string;
}) {
  const enabled = useAssistantEnabled();
  const ask = useUiStore((state) => state.askAssistant);

  if (!enabled) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("btn-ai", className)}>
          <SparklesIcon className="size-3.5" aria-hidden="true" />
          Ask AI
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={() => ask(action.prompt)}
          >
            <SparklesIcon
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
