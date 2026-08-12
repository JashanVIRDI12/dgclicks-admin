"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BotIcon,
  CopyIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AiLoader } from "@/components/ui/ai-loader";
import { Button } from "@/components/ui/button";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "@/features/assistant/components/message-content";
import { ASSISTANT_STARTERS } from "@/features/assistant/prompts";
import type {
  AssistantMessageView,
  AssistantResponse,
  AssistantThreadView,
} from "@/features/assistant/types";
import { celebrateTaskCompletion } from "@/features/tasks/components/task-celebration";
import { useUiStore } from "@/stores/ui-store";
import type { ApiResult } from "@/types";
import { cn } from "@/lib/utils";

const assistantKey = ["assistant", "latest"] as const;
const COMPOSER_MAX_HEIGHT = 160;

async function readLatestThread(): Promise<AssistantThreadView | null> {
  const response = await fetch("/api/assistant", { cache: "no-store" });
  const payload = (await response.json()) as ApiResult<AssistantThreadView | null>;

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

async function postAssistant(input: unknown): Promise<AssistantResponse> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as ApiResult<AssistantResponse>;

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export function AssistantPanel({
  enabled,
  activeWorkspaceId,
}: {
  enabled: boolean;
  activeWorkspaceId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOpen = useUiStore((state) => state.isAssistantOpen);
  const setOpen = useUiStore((state) => state.setAssistantOpen);
  const askedPrompt = useUiStore((state) => state.assistantPrompt);

  const [draft, setDraft] = useState("");
  /**
   * Suppresses the stored thread so the next message opens a fresh one.
   *
   * "New chat" cannot simply refetch: the endpoint returns the most recently
   * updated thread, which is the one being abandoned. Holding the intent locally
   * until a message is actually sent means no empty thread is ever written.
   */
  const [isStartingOver, setStartingOver] = useState(false);
  /**
   * The message being sent, echoed until the server's copy replaces it.
   *
   * A turn is not streamed: the thread comes back only once the whole run has
   * finished, tool calls included, which can be many seconds. Clearing the
   * composer without this leaves the reader watching a spinner with no record of
   * what they asked. The timestamp is captured on send rather than read during
   * render, which would be an impure render the compiler rejects.
   */
  const [sending, setSending] = useState<{
    text: string;
    createdAt: string;
  } | null>(null);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const boardId = pathname.match(/^\/boards\/([a-f\d]{24})(?:\/|$)/i)?.[1] ?? null;

  /**
   * Take the prompt from whichever "Ask AI" button opened the panel.
   *
   * Applied during render rather than in an effect: React commits it with the
   * open, so the composer is never briefly empty, and the React Compiler
   * rejects the `setState` an effect would need. The id is the marker, so
   * picking the same action twice refills a composer that was cleared.
   */
  const [handledPromptId, setHandledPromptId] = useState(askedPrompt?.id ?? 0);

  if (askedPrompt && askedPrompt.id !== handledPromptId) {
    setHandledPromptId(askedPrompt.id);
    setDraft(askedPrompt.text);
  }

  const threadQuery = useQuery({
    queryKey: assistantKey,
    queryFn: readLatestThread,
    enabled: enabled && isOpen,
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: postAssistant,
    onSuccess: (response) => {
      setStartingOver(false);
      queryClient.setQueryData(assistantKey, response.thread);

      /**
       * Pull the rest of the app back in line with what the assistant just did.
       *
       * A turn that creates a board or moves a task writes through a route
       * handler, which is outside everything Next refreshes on its own — so
       * without this the board behind the panel keeps rendering the state it had
       * before the conversation started. The query cache covers the client
       * views, `router.refresh()` the server-rendered ones. The thread itself is
       * excluded: it was just set from this response, and refetching it would
       * only race with that.
       */
      if (response.mutated) {
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] !== "assistant",
        });
        router.refresh();
      }

      if (response.celebrations.includes("task_completed")) {
        celebrateTaskCompletion();
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const thread = isStartingOver ? null : (threadQuery.data ?? null);
  const messages = thread?.messages ?? [];
  const confirmation = thread?.pendingConfirmation ?? null;
  const isBusy = mutation.isPending;
  const isLocked = isBusy || confirmation !== null;

  /** Grow the composer with its content, up to the point it starts scrolling. */
  useEffect(() => {
    const node = composerRef.current;

    if (!node) {
      return;
    }

    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [draft]);

  /**
   * Keep the newest turn in view.
   *
   * A reply arrives whole rather than streamed, so without this the panel stays
   * where it was and a long answer looks like nothing happened. Instant rather
   * than smooth: `prefers-reduced-motion` is honoured globally, and a scroll
   * animation here would be the one place that ignored it.
   */
  const lastMessageId = messages.at(-1)?.id ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId, sending, isBusy, confirmation?.id]);

  function sendMessage() {
    const message = draft.trim();

    if (!message || isLocked) {
      return;
    }

    setDraft("");
    setSending({ text: message, createdAt: new Date().toISOString() });
    mutation.mutate(
      {
        kind: "message",
        threadId: thread?.id ?? null,
        message,
        context: { workspaceId: activeWorkspaceId, boardId, pathname },
      },
      {
        // The thread that lands in the cache already carries this message, so
        // the echo is dropped in the same commit that renders the real one.
        onSuccess: () => setSending(null),
        onError: () => {
          setSending(null);
          setDraft(message);
        },
        onSettled: () => composerRef.current?.focus(),
      },
    );
  }

  function answerConfirmation(approved: boolean) {
    if (!thread || !confirmation || isBusy) {
      return;
    }

    mutation.mutate({
      kind: "confirmation",
      threadId: thread.id,
      confirmationId: confirmation.id,
      approved,
    });
  }

  function startOver() {
    setStartingOver(true);
    setDraft("");
    composerRef.current?.focus();
  }

  const status = isBusy
    ? "Working on it…"
    : confirmation
      ? "Waiting for your confirmation"
      : "Plans work, asks for missing details, and acts with your permissions.";

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="flex-row items-start gap-3 border-b px-4 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isBusy ? (
              <AiLoader label="Assistant is working" className="size-5" />
            ) : (
              <SparklesIcon className="size-4" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm">Workspace assistant</SheetTitle>
            <SheetDescription
              aria-live="polite"
              className="line-clamp-1 text-xs"
            >
              {status}
            </SheetDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isLocked || messages.length === 0}
            onClick={startOver}
            title="New chat"
            aria-label="Start a new chat"
          >
            <SquarePenIcon className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
          >
            <XIcon className="size-4" />
          </Button>
        </SheetHeader>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {threadQuery.isPending && !isStartingOver ? (
            <div className="flex h-full items-center justify-center">
              <AiLoader label="Loading assistant conversation" />
            </div>
          ) : threadQuery.isError && !isStartingOver ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                The conversation could not be loaded.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void threadQuery.refetch()}
              >
                <RefreshCwIcon className="size-3.5" aria-hidden="true" />
                Try again
              </Button>
            </div>
          ) : messages.length === 0 && !sending ? (
            <StarterList
              onPick={(prompt) => {
                setDraft(prompt);
                composerRef.current?.focus();
              }}
            />
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {sending ? (
                <MessageBubble
                  isSending
                  message={{
                    id: "sending",
                    role: "user",
                    content: sending.text,
                    createdAt: sending.createdAt,
                  }}
                />
              ) : null}

              {isBusy ? (
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <AiLoader label="Assistant is working" className="size-7" />
                  Planning and working…
                </div>
              ) : null}
            </div>
          )}

          <div ref={endRef} aria-hidden="true" />
        </div>

        {/*
          Pinned rather than left in the transcript. A confirmation is the one
          message the reader must act on, and inline it scrolls out of view the
          moment the assistant says anything after it.
        */}
        {confirmation ? (
          <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-3.5">
            <div className="flex gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <ShieldAlertIcon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{confirmation.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {confirmation.description}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <HoldToConfirm
                disabled={isBusy}
                onConfirm={() => answerConfirmation(true)}
                className="flex-1"
              >
                {confirmation.confirmLabel}
              </HoldToConfirm>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => answerConfirmation(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <form
          className="border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <div className="flex items-end gap-2 rounded-xl border bg-background p-2 shadow-xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              disabled={!enabled || isLocked}
              rows={1}
              placeholder={
                confirmation
                  ? "Confirm or cancel the pending action"
                  : "Ask the assistant to plan or manage work…"
              }
              aria-label="Message the workspace assistant"
              className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-1.5 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || isLocked}
              aria-label="Send message"
            >
              <SendIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <p className="mt-1.5 px-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
            <kbd className="font-sans font-medium">Enter</kbd> to send,{" "}
            <kbd className="font-sans font-medium">Shift+Enter</kbd> for a new
            line. Permanent deletion and access changes always ask first.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The empty panel.
 *
 * Each starter shows the sentence it will put in the composer, not just its
 * label: two of them create records, and reading the instruction before it is
 * sent is the whole reason these fill the composer rather than firing.
 */
function StarterList({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="mb-5 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BotIcon className="size-5" aria-hidden="true" />
        </div>
        <h3 className="font-heading text-base font-medium">
          What should we work on?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a starting point, or ask in your own words.
        </p>
      </div>

      <div className="space-y-2">
        {ASSISTANT_STARTERS.map((starter) => (
          <button
            key={starter.label}
            type="button"
            onClick={() => onPick(starter.prompt)}
            className="group flex w-full items-start gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <SparklesIcon
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{starter.label}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                {starter.prompt}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isSending = false,
}: {
  message: AssistantMessageView;
  /** Echoed locally and not yet acknowledged by the server. */
  isSending?: boolean;
}) {
  const isAssistant = message.role === "assistant";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy that message.");
    }
  }

  return (
    <article
      className={cn(
        "group flex flex-col gap-1 transition-opacity",
        !isAssistant && "items-end",
        isSending && "opacity-60",
      )}
    >
      <div className={cn("flex gap-2.5", !isAssistant && "flex-row-reverse")}>
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
            isAssistant
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isAssistant ? (
            <BotIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <SparklesIcon className="size-3.5" aria-hidden="true" />
          )}
        </div>

        {/*
          `whitespace-pre-wrap` is gone: MessageContent owns the line breaks now,
          and keeping both meant every blank line in the model's output was
          rendered twice — once as a real gap, once as the paragraph spacing.
        */}
        <div
          className={cn(
            "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isAssistant
              ? "rounded-tl-md bg-muted/70 text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground",
          )}
        >
          <MessageContent content={message.content} />
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 px-9 text-[0.6875rem] text-muted-foreground",
          !isAssistant && "flex-row-reverse",
        )}
      >
        <time dateTime={message.createdAt}>
          {format(new Date(message.createdAt), "HH:mm")}
        </time>

        {isAssistant ? (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copy message"
            className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <CopyIcon className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
