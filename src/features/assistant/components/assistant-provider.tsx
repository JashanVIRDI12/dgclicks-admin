"use client";

import { createContext, use, type ReactNode } from "react";

/**
 * Whether OpenRouter is configured.
 *
 * The value is read from the environment once, in the guarded layout, and
 * carried down here rather than as a prop: the "Ask AI" buttons sit inside the
 * board toolbar and the task drawer, and reaching them by prop would thread a
 * boolean through half a dozen components with no other interest in it.
 */
const AssistantEnabledContext = createContext(false);

export function AssistantProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <AssistantEnabledContext value={enabled}>{children}</AssistantEnabledContext>
  );
}

export function useAssistantEnabled(): boolean {
  return use(AssistantEnabledContext);
}
