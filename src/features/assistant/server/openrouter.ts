import "server-only";

import { z } from "zod";

import type {
  AssistantStoredMessage,
  AssistantToolCall,
} from "@/features/assistant/server/assistant.model";
import { openRouterTools } from "@/features/assistant/server/assistant-tools";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1_500];

/**
 * OpenRouter reports an upstream failure as `{ error: { message, code } }`, and
 * does so under a 4xx/5xx status *and* occasionally under a 200 when the
 * provider fails mid-generation. Both paths are checked.
 */
const errorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.union([z.number(), z.string()]).optional(),
  }),
});

const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                type: z.literal("function"),
                function: z.object({
                  name: z.string().min(1),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
});

type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; content: string; tool_call_id: string };

export type OpenRouterAssistantMessage = {
  content: string | null;
  toolCalls: AssistantToolCall[];
};

export async function requestAssistantCompletion(options: {
  system: string;
  messages: AssistantStoredMessage[];
  /**
   * How long this call may take. The runner passes what is left of the
   * function's own budget, so a slow provider aborts here — leaving time to
   * save the thread — rather than being cut off with the whole request.
   */
  timeoutMs?: number;
}): Promise<OpenRouterAssistantMessage> {
  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) {
    throw new AppError("The AI assistant has not been configured yet.", {
      status: 503,
      code: "assistant_not_configured",
    });
  }

  const body = JSON.stringify({
    model: env.OPENROUTER_MODEL,
    messages: [
      { role: "system", content: options.system },
      ...options.messages.map(toOpenRouterMessage),
    ],
    tools: openRouterTools,
    tool_choice: "auto",
    /**
     * `require_parameters` drops any provider that does not support every
     * parameter sent, which is what guarantees the chosen endpoint can actually
     * call tools. The trap is that it applies to *all* of them: OpenRouter's
     * endpoint metadata for the Claude 5 family lists neither
     * `parallel_tool_calls` nor `temperature` — Anthropic removed sampling
     * parameters in that generation — so sending either filtered every provider
     * out and returned a 404 that this module reported as a 502. Only send
     * parameters the whole catalogue supports; the runner already commits to one
     * batch of tool calls per step, so it needs no help from the provider.
     */
    provider: { require_parameters: true },
    max_tokens: 2_000,
  });

  const payload = await postWithRetry(
    body,
    Math.min(options.timeoutMs ?? REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS),
  );
  const parsed = responseSchema.safeParse(payload);

  if (!parsed.success) {
    console.error(
      "[assistant] unexpected OpenRouter payload",
      JSON.stringify(payload).slice(0, 1_000),
    );

    throw new AppError("The AI provider returned an invalid response.", {
      status: 502,
      code: "assistant_invalid_response",
    });
  }

  const message = parsed.data.choices[0]!.message;

  return {
    content: message.content ?? null,
    toolCalls: (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    })),
  };
}

/**
 * Posts the completion request, retrying only failures that a second attempt
 * can plausibly fix. A timeout is not one of them: the caller has already waited
 * the full budget, and retrying would triple it.
 */
async function postWithRetry(
  body: string,
  timeoutMs: number,
): Promise<unknown> {
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.BETTER_AUTH_URL,
          "X-Title": "DG Clicks Company OS",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new AppError(
          "The AI provider took too long to respond. Please try again.",
          { status: 504, code: "assistant_timeout" },
        );
      }

      console.error("[assistant] OpenRouter request failed", error);
      lastError = new AppError(
        "The AI provider could not be reached. Please try again.",
        { status: 502, code: "assistant_unavailable" },
      );
      await delayBeforeRetry(attempt);
      continue;
    }

    const payload: unknown = await response.json().catch(() => null);
    const failure = errorSchema.safeParse(payload);

    if (response.ok && !failure.success) {
      return payload;
    }

    const detail = failure.success
      ? (failure.data.error.message ?? "no message")
      : "no error body";

    console.error(
      `[assistant] OpenRouter ${response.status} for model ${env.OPENROUTER_MODEL}: ${detail}`,
    );

    const appError = toProviderError(response.status, detail);

    if (!isRetryable(response.status)) {
      throw appError;
    }

    lastError = appError;
    await delayBeforeRetry(attempt);
  }

  throw (
    lastError ??
    new AppError("The AI provider could not be reached. Please try again.", {
      status: 502,
      code: "assistant_unavailable",
    })
  );
}

/**
 * Separates "someone has to change a setting" from "try again later". The first
 * class is worth naming precisely: the failure that motivated this mapping was a
 * 404 from provider routing, which the previous single message reported as a
 * generic upstream error and left undiagnosable from the client.
 */
function toProviderError(status: number, detail: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      "The AI provider rejected the configured API key. Check OPENROUTER_API_KEY.",
      { status: 503, code: "assistant_provider_auth" },
    );
  }

  if (status === 402) {
    return new AppError(
      "The AI provider account is out of credits. Top it up to keep using the assistant.",
      { status: 503, code: "assistant_provider_credits" },
    );
  }

  if (status === 404) {
    return new AppError(
      `No AI provider can serve "${env.OPENROUTER_MODEL}" with tool calling. Check OPENROUTER_MODEL supports tools: ${detail}`,
      { status: 503, code: "assistant_model_unavailable" },
    );
  }

  if (status === 429) {
    return new AppError(
      "The AI provider is rate limited. Please try again shortly.",
      { status: 429, code: "assistant_rate_limited" },
    );
  }

  if (status >= 500) {
    return new AppError(
      "The AI provider is having trouble. Please try again shortly.",
      { status: 502, code: "assistant_provider_error" },
    );
  }

  return new AppError(
    "The AI provider rejected the request. Check its model and key configuration.",
    { status: 502, code: "assistant_provider_error" },
  );
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function delayBeforeRetry(attempt: number): Promise<void> {
  const delay = RETRY_DELAYS_MS[attempt];

  if (delay === undefined) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delay));
}

function toOpenRouterMessage(message: AssistantStoredMessage): OpenRouterMessage {
  if (message.role === "user") {
    return { role: "user", content: message.content ?? "" };
  }

  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content ?? "{}",
      tool_call_id: message.toolCallId ?? "missing-tool-call-id",
    };
  }

  return {
    role: "assistant",
    content: message.content,
    ...(message.toolCalls.length > 0
      ? {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }
      : {}),
  };
}
