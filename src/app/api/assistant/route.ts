import { assistantRequestSchema } from "@/features/assistant/schemas/assistant.schema";
import { runAssistant } from "@/features/assistant/server/assistant-runner";
import {
  getLatestAssistantThread,
  toAssistantThreadView,
} from "@/features/assistant/server/assistant.service";
import { withRoute } from "@/lib/api/handler";

/**
 * A turn is many round trips, not one.
 *
 * `runAssistant` loops up to ten steps, each a fresh OpenRouter call, and a
 * request that creates a board and five tasks genuinely uses several of them.
 * Serverless platforms cut a function off at their own default long before
 * that — on Vercel the request dies mid-run and the client sees a network
 * error, while the writes already committed stay committed.
 *
 * 60s is the Hobby ceiling. Raise it on a paid plan if long multi-step requests
 * are getting truncated; the ten-step limit in the runner is the real bound.
 */
export const maxDuration = 60;

export const GET = withRoute({
  auth: true,
  handler: async ({ session }) => {
    const thread = await getLatestAssistantThread(session.user.id);
    return thread ? toAssistantThreadView(thread) : null;
  },
});

export const POST = withRoute({
  auth: true,
  input: assistantRequestSchema,
  handler: ({ input, session }) => runAssistant(input, session),
});
