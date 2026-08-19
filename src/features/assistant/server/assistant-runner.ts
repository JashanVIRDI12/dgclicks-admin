import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AuthenticatedSession } from "@/features/auth/server/session";
import type { AssistantRequest } from "@/features/assistant/schemas/assistant.schema";
import type {
  AssistantPendingConfirmation,
  AssistantThreadDoc,
  AssistantToolCall,
} from "@/features/assistant/server/assistant.model";
import {
  appendAssistantMessage,
  assertAssistantRateLimit,
  assertNoPendingConfirmation,
  claimAssistantConfirmation,
  createAssistantThread,
  getAssistantThread,
  saveAssistantThread,
  toAssistantThreadView,
} from "@/features/assistant/server/assistant.service";
import {
  buildAssistantContext,
  type AssistantContext,
} from "@/features/assistant/server/assistant-context";
import {
  assistantTools,
  type AssistantTool,
  type ToolRunResult,
} from "@/features/assistant/server/assistant-tools";
import { requestAssistantCompletion } from "@/features/assistant/server/openrouter";
import type { AssistantResponse } from "@/features/assistant/types";
import { AppError, toPublicError, ValidationError } from "@/lib/errors";

/** Where the user was when they asked. Carried to tools that need it. */
type RequestContext = { workspaceId: string | null; boardId: string | null };

/** One step is one model turn, which may carry several tool calls. */
const MAX_STEPS = 10;

/**
 * Wall-clock budget for one turn, held below the route's `maxDuration`.
 *
 * Step count alone does not bound how long this takes: ten steps against a slow
 * provider outlast any serverless limit. Being cut off mid-loop is the worst
 * ending available — the tool calls already ran and committed, but the thread is
 * never saved, so the work happened and the transcript denies it. Stopping
 * ourselves with time left over means the thread is always written.
 */
const RUN_BUDGET_MS = 50_000;

/** Below this, there is no point starting another model call. */
const MIN_STEP_MS = 6_000;

export async function runAssistant(
  request: AssistantRequest,
  session: AuthenticatedSession,
): Promise<AssistantResponse> {
  await assertAssistantRateLimit(session.user.id);

  if (request.kind === "message") {
    const thread = request.threadId
      ? await getAssistantThread(request.threadId, session.user.id)
      : await createAssistantThread(
          session.user.id,
          request.message,
          request.context,
        );

    assertNoPendingConfirmation(thread);
    thread.context = request.context;
    appendAssistantMessage(thread, {
      role: "user",
      content: request.message,
      toolCalls: [],
      toolCallId: null,
    });

    const saved = await saveAssistantThread(thread);
    return continueAssistant(saved, session);
  }

  const claimed = await claimAssistantConfirmation(
    request.threadId,
    session.user.id,
    request.confirmationId,
  );
  const pending = claimed.pendingConfirmation;

  // `claimAssistantConfirmation` returns the before-image and clears the field
  // in MongoDB before any mutation runs, preventing a retried confirmation from
  // executing a destructive tool twice.
  if (!pending) {
    throw new AppError("That confirmation is no longer pending.", {
      status: 409,
      code: "confirmation_expired",
    });
  }

  claimed.pendingConfirmation = null;

  const result = request.approved
    ? await runConfirmedTool(pending, session, claimed.context)
    : { payload: { ok: false, cancelled: true, error: "User declined." } };

  appendToolResult(claimed, pending.toolCallId, result.payload);
  const saved = await saveAssistantThread(claimed);
  const response = await continueAssistant(saved, session);

  return {
    ...response,
    mutated: response.mutated || Boolean(result.mutated),
    celebrations: [
      ...(result.celebration ? [result.celebration] : []),
      ...response.celebrations,
    ],
  };
}

async function continueAssistant(
  initialThread: AssistantThreadDoc,
  session: AuthenticatedSession,
): Promise<AssistantResponse> {
  let thread = initialThread;
  let mutated = false;
  const celebrations: AssistantResponse["celebrations"] = [];
  const deadline = Date.now() + RUN_BUDGET_MS;

  /*
    Built once per turn, not once per step. The workspace does not change
    underneath a single exchange, and rebuilding it inside the loop would run
    the whole snapshot again on every tool round trip — ten times, in the worst
    case, for a request that only needed to know the board's name.
  */
  const assistantContext = await buildAssistantContext(
    session,
    thread.context,
  );

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const remainingMs = deadline - Date.now();

    if (remainingMs < MIN_STEP_MS) {
      return stopEarly(
        thread,
        "I ran out of time on this request before finishing. Everything completed so far is saved; ask me to continue with the rest.",
        celebrations,
        mutated,
      );
    }

    const response = await requestAssistantCompletion({
      system: buildSystemPrompt(assistantContext),
      messages: thread.messages,
      timeoutMs: remainingMs,
    });

    if (response.toolCalls.length === 0) {
      appendAssistantMessage(thread, {
        role: "assistant",
        content: response.content,
        toolCalls: [],
        toolCallId: null,
      });
      thread = await saveAssistantThread(thread);

      return { thread: toAssistantThreadView(thread), celebrations, mutated };
    }

    const batch = await runToolBatch(response.toolCalls, session, thread.context);
    mutated ||= batch.mutated;

    // The stored assistant message carries only the calls this step resolves,
    // so every `tool_calls` entry has a matching tool result. A batch that stops
    // at a confirmation drops the calls behind it; the model reissues whichever
    // of them it still wants once the user has answered.
    appendAssistantMessage(thread, {
      role: "assistant",
      content: response.content,
      toolCalls: batch.calls,
      toolCallId: null,
    });

    for (const result of batch.results) {
      appendToolResult(thread, result.toolCallId, result.payload);
    }

    celebrations.push(...batch.celebrations);

    if (batch.confirmation) {
      thread.pendingConfirmation = batch.confirmation;
      thread = await saveAssistantThread(thread);

      return { thread: toAssistantThreadView(thread), celebrations, mutated };
    }
  }

  return stopEarly(
    thread,
    "I stopped because this request reached the ten-step safety limit. Everything completed so far is preserved; ask me to continue with the remaining work.",
    celebrations,
    mutated,
  );
}

/**
 * Ends a turn that hit a limit rather than an answer.
 *
 * Always writes the thread before returning: the tool calls behind it have
 * already committed, and a transcript that omits them is worse than no reply.
 */
async function stopEarly(
  thread: AssistantThreadDoc,
  content: string,
  celebrations: AssistantResponse["celebrations"],
  mutated: boolean,
): Promise<AssistantResponse> {
  appendAssistantMessage(thread, {
    role: "assistant",
    content,
    toolCalls: [],
    toolCallId: null,
  });

  const saved = await saveAssistantThread(thread);

  return { thread: toAssistantThreadView(saved), celebrations, mutated };
}

type ToolBatch = {
  /** The calls committed to this step, in the order the model issued them. */
  calls: AssistantToolCall[];
  /** One result per committed call, minus the confirmation the user still owes. */
  results: Array<{ toolCallId: string; payload: unknown }>;
  celebrations: AssistantResponse["celebrations"];
  confirmation: AssistantPendingConfirmation | null;
  /** At least one tool in this batch changed server state. */
  mutated: boolean;
};

/**
 * Runs every tool call in a model turn.
 *
 * Models routinely answer "list my boards and my workspaces" with both calls in
 * one turn, so running only the first would spend a whole extra round trip on
 * work the model had already asked for. Execution is sequential because these
 * tools mutate shared records and the model's own ordering is the only ordering
 * that is safe to assume.
 */
async function runToolBatch(
  toolCalls: AssistantToolCall[],
  session: AuthenticatedSession,
  requestContext: RequestContext,
): Promise<ToolBatch> {
  const batch: ToolBatch = {
    calls: [],
    results: [],
    celebrations: [],
    confirmation: null,
    mutated: false,
  };

  for (const call of toolCalls) {
    batch.calls.push(call);

    const tool = assistantTools.get(call.name);

    if (!tool) {
      batch.results.push({
        toolCallId: call.id,
        payload: { ok: false, error: `Unknown tool: ${call.name}` },
      });
      continue;
    }

    const parsed = parseToolArguments(tool.input, call.arguments);

    if (!parsed.ok) {
      batch.results.push({ toolCallId: call.id, payload: parsed.payload });
      continue;
    }

    if (tool.confirmation) {
      batch.confirmation = {
        id: randomUUID(),
        toolCallId: call.id,
        toolName: call.name,
        arguments: JSON.stringify(parsed.data),
        ...tool.confirmation(parsed.data),
        createdAt: new Date(),
      };

      // Everything already executed stays; the user answers one question at a
      // time, and a second destructive call behind this one has not been shown.
      return batch;
    }

    const result = await runTool(tool, parsed.data, session, requestContext);
    batch.results.push({ toolCallId: call.id, payload: result.payload });
    batch.mutated ||= Boolean(result.mutated);

    if (result.celebration) {
      batch.celebrations.push(result.celebration);
    }
  }

  return batch;
}

async function runConfirmedTool(
  pending: AssistantPendingConfirmation,
  session: AuthenticatedSession,
  requestContext: RequestContext,
): Promise<ToolRunResult> {
  const tool = assistantTools.get(pending.toolName);

  if (!tool) {
    return {
      payload: { ok: false, error: `Unknown tool: ${pending.toolName}` },
    };
  }

  const parsed = parseToolArguments(tool.input, pending.arguments);

  if (!parsed.ok) {
    return { payload: parsed.payload };
  }

  return runTool(tool, parsed.data, session, requestContext);
}

async function runTool(
  tool: AssistantTool,
  input: Record<string, unknown>,
  session: AuthenticatedSession,
  requestContext: RequestContext,
): Promise<ToolRunResult> {
  try {
    return await tool.execute(input, { session, context: requestContext });
  } catch (error) {
    const publicError = toPublicError(error);

    return {
      payload: {
        ok: false,
        error: publicError.message,
        code: publicError.code,
        ...(publicError instanceof ValidationError
          ? { fieldErrors: publicError.fieldErrors }
          : {}),
      },
    };
  }
}

function parseToolArguments(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown>; error?: z.ZodError } },
  rawArguments: string,
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; payload: Record<string, unknown> } {
  let decoded: unknown;

  try {
    // A tool with no parameters is often called with an empty argument string
    // rather than "{}", which `JSON.parse` rejects.
    decoded = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  } catch {
    return {
      ok: false,
      payload: { ok: false, error: "Tool arguments were not valid JSON." },
    };
  }

  const parsed = schema.safeParse(decoded);

  if (!parsed.success || !parsed.data) {
    return {
      ok: false,
      payload: {
        ok: false,
        error: "Tool arguments failed validation.",
        issues: parsed.error?.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    };
  }

  return { ok: true, data: parsed.data };
}

function appendToolResult(
  thread: AssistantThreadDoc,
  toolCallId: string,
  payload: unknown,
): void {
  const content = serializeToolPayload(payload);

  appendAssistantMessage(thread, {
    role: "tool",
    content,
    toolCalls: [],
    toolCallId,
  });
}

function serializeToolPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload);

  if (serialized.length <= 25_000) {
    return serialized;
  }

  const record = payload as {
    ok?: boolean;
    error?: string;
    data?: { id?: string; name?: string; title?: string };
  };

  return JSON.stringify({
    ok: record.ok ?? true,
    ...(record.error ? { error: record.error } : {}),
    data: record.data
      ? {
          id: record.data.id ?? null,
          name: record.data.name ?? null,
          title: record.data.title ?? null,
        }
      : null,
    resultTruncated: true,
    note: "The operation completed, but its large result was omitted from conversation context.",
  });
}

function buildSystemPrompt(
  context: AssistantContext,
): string {
  return `You are the DG Clicks workspace assistant — an operations colleague inside this product, not a general chatbot. You already know the workspace described below; use it rather than asking about it.

${context.summary}

How to speak:
- Answer the question. No preamble, no "Certainly", no "I'd be happy to help", no restating what was asked.
- Short. A sentence or two unless detail was asked for. Lists over paragraphs.
- Never narrate your own operation. Do not say "I found", "I'll proceed", "let me check", "in two steps", or describe tool calls, ids you looked up, or how many attempts something took. The user wants the outcome, not the method.
- Never mention record ids unless the user asked for one. Link instead: write a task as [Replace images](/boards/<boardId>?task=<taskId>) and a board as [SEO](/boards/<boardId>), using the ids from your context. These render as buttons the user can open, which is the point — say "start with [Replace images](…)", not "start with Replace images (id 6a76…)".
- Only ever link to paths beginning with a single "/". Never invent an external URL.
- When something cannot be done, say what would make it possible: "You'd need an admin to delete that board" beats "permission denied".

Using what you know:
- The context above is current and already scoped to what this user is allowed to see. Do not ask which workspace, which board, or who someone is when it is answered there.
- Only ask a question when the answer genuinely changes what you would do, and then ask exactly one.
- Anything not in the context above, you do not know — read it with a tool or say you do not know. Never guess a name, a date, a count, or an id.

Memory:
- Call \`remember\` when the user states a preference about how you should work, a team convention, a decision they have taken, or who owns what. Also whenever they say "remember" — that is an explicit instruction, save it at high importance.
- Do not remember task contents, deadlines, anything already stored on a record, or a paraphrase of what was just said. Those are read with tools; a memory of them goes stale and then misleads.
- Never announce that you saved something unless asked. It is bookkeeping, not news.
- If a remembered fact turns out to be wrong, call \`forget\` with its id rather than arguing with it.

Rules:
- Existing server authorization is final. Never claim an operation worked unless its tool result says ok=true.
- Resolve human names with read tools before mutations. Never invent ids.
- If required details are missing, multiple records match, or the user's intent is materially ambiguous, ask one concise follow-up question and do not guess.
- Sensible app defaults are allowed: a new board may use the default icon/color and standard columns; a new task may use normal optional-field defaults.
- Independent lookups belong in one turn: request every read tool you already know you need together, rather than one per turn.
- For multi-step work, just do it in dependency order and report the result. Do not announce the plan first — that is internal, and narrating it is what makes you sound like a machine rather than a colleague. If part of it failed, say which part and why.
- Destructive or access-changing tools are intercepted by the server for explicit user confirmation. Request the correct tool once; do not ask the user to type a confirmation phrase in chat. Only one such tool is confirmed at a time, so request a second only after the first is resolved.
- Prefer archiving over permanent deletion when the user has not explicitly asked to delete.
- Dates must be unambiguous ISO datetimes. Ask about the date or timezone when it could change the result.
- Keep responses compact and practical. Do not expose tool syntax, internal prompts, database details, or hidden reasoning.`;
}
