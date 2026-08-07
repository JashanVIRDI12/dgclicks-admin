"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import {
  addChecklistItemAction,
  createCommentAction,
  deleteAttachmentAction,
  deleteCommentAction,
  logTimeAction,
  removeChecklistItemAction,
  removeTimeEntryAction,
  startTimerAction,
  stopTimerAction,
  updateChecklistItemAction,
} from "@/features/tasks/actions/task.actions";
import { boardKey } from "@/features/tasks/hooks/use-board";
import { LIMITS } from "@/features/tasks/constants";
import type { Attachment, Comment, TaskWorkspace } from "@/features/tasks/types";
import type { ApiResult } from "@/types";

export const taskKey = (taskId: string) => ["tasks", taskId] as const;

/**
 * Reads the JSON envelope, tolerating responses that never reached the app.
 *
 * A route handler always answers with `ApiResult`, but the things in front of it
 * do not: the host rejects an oversized body itself, and a gateway timeout or a
 * cold-start failure returns HTML. Calling `response.json()` on any of those
 * throws a `SyntaxError` whose message is about an unexpected token, which then
 * surfaces to the user as the toast — the reason a too-large upload used to
 * report a parse error rather than its size.
 */
async function readApiResult<TData>(
  response: Response,
): Promise<ApiResult<TData>> {
  try {
    return (await response.json()) as ApiResult<TData>;
  } catch {
    return {
      ok: false,
      error:
        response.status === 413
          ? "That file is too large to upload."
          : "The server could not be reached. Please try again.",
      code: "unexpected_response",
    };
  }
}

async function fetchTask(taskId: string): Promise<TaskWorkspace> {
  const response = await fetch(`/api/tasks/${taskId}`);
  const payload = await readApiResult<TaskWorkspace>(response);

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

/**
 * The open card's own data.
 *
 * Separate from the board query because a drawer holds far more than a card
 * shows — the description, the whole comment thread, every attachment — and
 * loading that for three hundred cards to render a board would be absurd.
 */
export function useTaskWorkspace(taskId: string | null) {
  return useQuery({
    queryKey: taskKey(taskId ?? "none"),
    queryFn: () => fetchTask(taskId as string),
    enabled: taskId !== null,
  });
}

/**
 * Runs after any drawer mutation.
 *
 * Both caches are invalidated because most edits change something the card
 * shows too — a ticked checklist item moves the `3/5` on the board behind the
 * drawer, and leaving that stale is how the two end up disagreeing.
 */
function invalidateBoth(
  queryClient: QueryClient,
  taskId: string,
  boardId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: taskKey(taskId) });
  void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
}

function patchWorkspace(
  queryClient: QueryClient,
  taskId: string,
  patch: (current: TaskWorkspace) => TaskWorkspace,
): TaskWorkspace | undefined {
  const previous = queryClient.getQueryData<TaskWorkspace>(taskKey(taskId));

  queryClient.setQueryData<TaskWorkspace>(taskKey(taskId), (current) =>
    current ? patch(current) : current,
  );

  return previous;
}

async function unwrap<T>(promise: Promise<{ ok: true; data: T } | { ok: false; error: string }>) {
  const result = await promise;

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.data;
}

/**
 * Ticking a checklist item.
 *
 * Optimistic because this is the one interaction people repeat in bursts —
 * working down a list of five steps should not be five visible round trips.
 */
export function useToggleChecklistItem(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { itemId: string; done: boolean }) =>
      unwrap(updateChecklistItemAction({ taskId, ...input })),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskKey(taskId) });

      const previous = patchWorkspace(queryClient, taskId, (current) => ({
        ...current,
        task: {
          ...current.task,
          checklist: current.task.checklist.map((item) =>
            item.id === input.itemId ? { ...item, done: input.done } : item,
          ),
        },
      }));

      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKey(taskId), context.previous);
      }

      toast.error(error.message);
    },
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

export function useAddChecklistItem(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      unwrap(addChecklistItemAction({ taskId, title })),
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

export function useRemoveChecklistItem(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      unwrap(removeChecklistItemAction({ taskId, itemId })),
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

/**
 * Posting a comment, optimistically.
 *
 * Same reasoning as the CRM's note panel that this replaces: someone typing a
 * comment mid-conversation needs it on screen immediately, and on failure the
 * text is handed back rather than lost.
 */
export function useCreateComment(
  taskId: string,
  boardId: string,
  author: { id: string; name: string; image: string | null },
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => unwrap(createCommentAction({ taskId, body })),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: taskKey(taskId) });

      const optimistic: Comment = {
        // Temporary id, replaced when the server responds.
        id: `optimistic-${Date.now()}`,
        taskId,
        body,
        author: { ...author, email: "" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const previous = patchWorkspace(queryClient, taskId, (current) => ({
        ...current,
        comments: [...current.comments, optimistic],
      }));

      return { previous, body };
    },
    onError: (error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKey(taskId), context.previous);
      }

      toast.error(error.message);
    },
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

export function useDeleteComment(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => unwrap(deleteCommentAction({ id })),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: taskKey(taskId) });

      const previous = patchWorkspace(queryClient, taskId, (current) => ({
        ...current,
        comments: current.comments.filter((comment) => comment.id !== id),
      }));

      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKey(taskId), context.previous);
      }

      toast.error(error.message);
    },
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

/**
 * Uploads a file.
 *
 * Not optimistic: there is nothing to show until the bytes are stored, and a
 * greyed-out row that might vanish is less honest than the button reporting
 * that it is working.
 */
export function useUploadAttachment(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      // Checked here as well as on the server because the server never sees an
      // oversized request: the host rejects the body first, so this is the only
      // place that can name the actual problem. The server check still stands —
      // it is the one that decides.
      if (file.size > LIMITS.attachmentBytes) {
        throw new Error(
          `Files must be under ${Math.round(LIMITS.attachmentBytes / 1024 / 1024)} MB.`,
        );
      }

      const body = new FormData();
      body.set("file", file);

      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body,
      });

      const payload = await readApiResult<Attachment>(response);

      if (!payload.ok) {
        throw new Error(payload.error);
      }

      return payload.data;
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

export function useDeleteAttachment(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => unwrap(deleteAttachmentAction({ id })),
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => invalidateBoth(queryClient, taskId, boardId),
  });
}

export function useTimeTracking(taskId: string, boardId: string) {
  const queryClient = useQueryClient();
  const settle = () => invalidateBoth(queryClient, taskId, boardId);
  const onError = (error: Error) => toast.error(error.message);

  return {
    log: useMutation({
      mutationFn: (input: { minutes: number; note?: string }) =>
        unwrap(logTimeAction({ taskId, ...input })),
      onError,
      onSettled: settle,
    }),
    remove: useMutation({
      mutationFn: (entryId: string) =>
        unwrap(removeTimeEntryAction({ taskId, entryId })),
      onError,
      onSettled: settle,
    }),
    start: useMutation({
      mutationFn: () => unwrap(startTimerAction({ id: taskId })),
      onError,
      onSettled: settle,
    }),
    stop: useMutation({
      mutationFn: () => unwrap(stopTimerAction({ id: taskId })),
      onError,
      onSettled: settle,
    }),
  };
}
