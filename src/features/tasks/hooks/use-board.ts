"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/features/tasks/actions/board.actions";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  setTaskCompleteAction,
  setTaskRecurrenceAction,
  updateTaskAction,
} from "@/features/tasks/actions/task.actions";
import type {
  LabelColor,
  TaskPriority,
} from "@/features/tasks/constants";
import { celebrateTaskCompletion } from "@/features/tasks/components/task-celebration";
import { positionBetween } from "@/features/tasks/position";
import type { RecurrenceInput } from "@/features/tasks/recurrence";
import type {
  BoardSnapshot,
  Task,
  TaskWorkspace,
} from "@/features/tasks/types";
import type { ApiResult } from "@/types";

export const boardKey = (boardId: string) => ["boards", boardId] as const;

const taskWorkspaceKey = (taskId: string) => ["tasks", taskId] as const;

/**
 * A patch for one task.
 *
 * Written out rather than inferred from the Zod schema: `z.coerce.date()` has
 * an input type of `unknown`, which would erase the one distinction that
 * matters here — `null` clears a field, absent leaves it alone.
 */
export type TaskPatchInput = {
  id: string;
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  labelIds?: string[];
  estimateMinutes?: number | null;
};

async function fetchBoard(boardId: string): Promise<BoardSnapshot> {
  const response = await fetch(`/api/boards/${boardId}`);
  const payload = (await response.json()) as ApiResult<BoardSnapshot>;

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

/**
 * The board's data.
 *
 * Seeded from the server render so the first paint is complete, then owned by
 * TanStack Query. Every view reads this one snapshot, which is what lets the
 * view switcher change layout without a refetch — and what lets a drag update
 * the calendar and timeline at the same time.
 */
export function useBoard(boardId: string, initialData: BoardSnapshot) {
  const queryClient = useQueryClient();

  /**
   * Adopt the server's snapshot whenever it sends a new one.
   *
   * `initialData` seeds a query key exactly once — every later render passing a
   * fresher snapshot is ignored, because the cache entry already exists. That
   * made `router.refresh()` a no-op for the board body: renaming a column,
   * reordering columns and archiving a board all re-rendered the server page and
   * handed down correct data that nothing ever read, so the old value stayed on
   * screen until a full reload. Columns are not owned by a mutation hook the way
   * tasks are, so there was no cache write to fall back on.
   *
   * The dependency is the snapshot's identity, so this writes only when the
   * server actually re-rendered — not on every commit.
   */
  useEffect(() => {
    queryClient.setQueryData(boardKey(boardId), initialData);
  }, [queryClient, boardId, initialData]);

  return useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => fetchBoard(boardId),
    initialData,
    /**
     * Short enough that a colleague's card shows up on its own, long enough
     * that it is not refetching under your hands while you drag.
     */
    staleTime: 4_000,
    /**
     * The board is the one screen several people work on at the same time, so
     * it polls, and it polls faster than anything else in the app.
     *
     * Five seconds rather than two on purpose. A person needs roughly a second
     * just to register that a card appeared, so the felt difference between the
     * two is close to nothing — while two seconds is two and a half times the
     * requests, and each one is a full board read. Five keeps "someone added a
     * task" resolving itself well before anybody reaches for reload.
     *
     * Optimistic writes are unaffected — they land instantly and this only
     * confirms them.
     */
    refetchInterval: 5_000,
    /**
     * Left at the default: a background tab stops polling entirely. A board
     * left open overnight should cost nothing, and the focus refetch already
     * catches it up the moment anyone looks.
     */
    refetchIntervalInBackground: false,
  });
}

/** Replaces one task in the cached snapshot, leaving everything else identical. */
function patchTask(
  queryClient: QueryClient,
  boardId: string,
  taskId: string,
  patch: (task: Task) => Task,
): BoardSnapshot | undefined {
  const previous = queryClient.getQueryData<BoardSnapshot>(boardKey(boardId));

  queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
    current
      ? {
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId ? patch(task) : task,
          ),
        }
      : current,
  );

  return previous;
}

function restore(
  queryClient: QueryClient,
  boardId: string,
  snapshot: BoardSnapshot | undefined,
): void {
  if (snapshot) {
    queryClient.setQueryData(boardKey(boardId), snapshot);
  }
}

/** Keeps the card and an already-open drawer on the same task value. */
function syncTaskCaches(
  queryClient: QueryClient,
  boardId: string,
  task: Task,
): void {
  queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
    current
      ? {
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === task.id ? task : item,
          ),
        }
      : current,
  );

  queryClient.setQueryData<TaskWorkspace>(
    taskWorkspaceKey(task.id),
    (current) =>
      current
        ? { ...current, task: { ...current.task, ...task } }
        : current,
  );
}

/**
 * A drop.
 *
 * The new position is computed on the client with the same midpoint rule the
 * server uses, so the card settles exactly where it was released rather than
 * jumping when the response lands. If the write fails the whole snapshot is put
 * back — a half-applied move is worse than none.
 */
export function useMoveTask(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      listId: string;
      beforeId: string | null;
      afterId: string | null;
    }) => {
      const result = await moveTaskAction(input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: (input) => {
      // Abort an in-flight refresh without reverting its state, then patch the
      // cache synchronously so the drag preview can hand off without a frame
      // of the card appearing back in its previous column.
      void queryClient.cancelQueries(
        { queryKey: boardKey(boardId) },
        { revert: false },
      );

      const current = queryClient.getQueryData<BoardSnapshot>(boardKey(boardId));
      const byId = new Map(current?.tasks.map((task) => [task.id, task]));
      const before = input.beforeId ? byId.get(input.beforeId) : undefined;
      const after = input.afterId ? byId.get(input.afterId) : undefined;
      const isTerminal = current?.lists.find(
        (list) => list.id === input.listId,
      )?.isTerminal;

      const previous = patchTask(queryClient, boardId, input.id, (task) => ({
        ...task,
        listId: input.listId,
        position: positionBetween(
          before?.position ?? null,
          after?.position ?? null,
        ),
        completedAt: isTerminal
          ? (task.completedAt ?? new Date().toISOString())
          : null,
      }));

      return { previous };
    },
    onError: (error, _input, context) => {
      restore(queryClient, boardId, context?.previous);
      toast.error(error.message);
    },
    onSuccess: (task, _input, context) => {
      const wasComplete = context?.previous?.tasks.find(
        (item) => item.id === task.id,
      )?.completedAt;

      if (!wasComplete && task.completedAt) {
        celebrateTaskCompletion();
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}

/**
 * Autosave for a single field.
 *
 * Takes a patch rather than the whole task so two people editing different
 * fields of the same card do not overwrite each other with values neither of
 * them touched.
 */
export function useUpdateTask(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TaskPatchInput) => {
      const result = await updateTaskAction(input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardKey(boardId) });

      const previous = patchTask(queryClient, boardId, input.id, (task) => ({
        ...task,
        // Only the scalar fields are echoed locally; assignee and labels come
        // back resolved from the server, and guessing at them here would show a
        // name that might not be the one that was saved.
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate?.toISOString() ?? null }
          : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate?.toISOString() ?? null }
          : {}),
      }));

      return { previous };
    },
    onError: (error, _input, context) => {
      restore(queryClient, boardId, context?.previous);
      toast.error(error.message);
    },
    onSuccess: (task) => syncTaskCaches(queryClient, boardId, task),
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
      void queryClient.invalidateQueries({
        queryKey: taskWorkspaceKey(input.id),
      });
    },
  });
}

export function useSetTaskComplete(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; isComplete: boolean }) => {
      const result = await setTaskCompleteAction(input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: boardKey(boardId) });

      const current = queryClient.getQueryData<BoardSnapshot>(boardKey(boardId));
      // Ticking the box moves the card to Done, exactly as dragging it there
      // would — the two are the same fact and must not disagree on screen.
      const destination = input.isComplete
        ? current?.lists.find((list) => list.isTerminal)
        : current?.lists.find((list) => !list.isTerminal);

      const previous = patchTask(queryClient, boardId, input.id, (task) => ({
        ...task,
        completedAt: input.isComplete ? new Date().toISOString() : null,
        listId: destination?.id ?? task.listId,
      }));

      return { previous };
    },
    onError: (error, _input, context) => {
      restore(queryClient, boardId, context?.previous);
      toast.error(error.message);
    },
    onSuccess: (task, input, context) => {
      syncTaskCaches(queryClient, boardId, task);
      const wasComplete = context?.previous?.tasks.find(
        (item) => item.id === task.id,
      )?.completedAt;

      if (input.isComplete && !wasComplete) {
        celebrateTaskCompletion();
      }
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
      void queryClient.invalidateQueries({
        queryKey: taskWorkspaceKey(input.id),
      });
    },
  });
}

export function useSetTaskRecurrence(taskId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recurrence: RecurrenceInput | null) => {
      const result = await setTaskRecurrenceAction({
        id: taskId,
        recurrence: recurrence
          ? {
              ...recurrence,
              endsAt: recurrence.endsAt ? new Date(recurrence.endsAt) : null,
            }
          : null,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (task) => syncTaskCaches(queryClient, boardId, task),
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
      void queryClient.invalidateQueries({ queryKey: taskWorkspaceKey(taskId) });
    },
  });
}

export function useDeleteTask(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTaskAction({ id: taskId });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return taskId;
    },
    onSuccess: (taskId) => {
      queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.filter((task) => task.id !== taskId),
            }
          : current,
      );
      queryClient.removeQueries({ queryKey: taskWorkspaceKey(taskId) });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color: LabelColor }) => {
      const result = await createLabelAction({ boardId, ...input });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (label) => {
      queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
        current
          ? { ...current, labels: [...current.labels, label] }
          : current,
      );
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}

export function useUpdateLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      color: LabelColor;
    }) => {
      const result = await updateLabelAction(input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (label) => {
      queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
        current
          ? {
              ...current,
              labels: current.labels.map((item) =>
                item.id === label.id ? label : item,
              ),
              tasks: current.tasks.map((task) => ({
                ...task,
                labels: task.labels.map((item) =>
                  item.id === label.id ? label : item,
                ),
              })),
            }
          : current,
      );
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}

export function useDeleteLabel(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelId: string) => {
      const result = await deleteLabelAction({ id: labelId });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return labelId;
    },
    onSuccess: (labelId) => {
      queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) =>
        current
          ? {
              ...current,
              labels: current.labels.filter((label) => label.id !== labelId),
              tasks: current.tasks.map((task) => ({
                ...task,
                labels: task.labels.filter((label) => label.id !== labelId),
              })),
            }
          : current,
      );
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}

/**
 * Quick-create from a column footer.
 *
 * Not optimistic: a card needs a server-assigned id before it can be dragged or
 * opened, and a placeholder that cannot be interacted with for a moment reads
 * as broken rather than fast.
 */
export function useCreateTask(boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      listId?: string;
      description?: string | null;
      priority?: TaskPriority;
      assigneeId?: string | null;
      startDate?: Date | null;
      dueDate?: Date | null;
      labelIds?: string[];
      estimateMinutes?: number | null;
      recurrence?: RecurrenceInput;
      subtasks?: string[];
      checklist?: string[];
      comment?: string;
    }) => {
      const result = await createTaskAction({ ...input, boardId });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (task) => {
      queryClient.setQueryData<BoardSnapshot>(boardKey(boardId), (current) => {
        if (!current) {
          return current;
        }

        /*
          Append only if it is not already here.

          `createTaskAction` revalidates, so the server action ships back a
          re-rendered board whose snapshot already contains this task — and
          `useBoard` writes that snapshot into this same cache entry. Appending
          unconditionally raced with it and drew the card twice, until the
          refetch in `onSettled` replaced the lot a moment later. Two cards
          appearing and one vanishing is a worse first impression than the
          slightly slower path this guards.
        */
        if (current.tasks.some((existing) => existing.id === task.id)) {
          return current;
        }

        return { ...current, tasks: [...current.tasks, task] };
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
    },
  });
}
