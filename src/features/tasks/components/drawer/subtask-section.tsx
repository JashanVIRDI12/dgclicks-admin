"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  createTaskAction,
  setTaskCompleteAction,
} from "@/features/tasks/actions/task.actions";
import { boardKey } from "@/features/tasks/hooks/use-board";
import { taskKey } from "@/features/tasks/hooks/use-task-workspace";
import {
  AssigneeAvatar,
  DueDateBadge,
} from "@/features/tasks/components/task-meta";
import { celebrateTaskCompletion } from "@/features/tasks/components/task-celebration";
import type { Task } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Subtasks: real tasks with a parent, not checklist items.
 *
 * The distinction is what the drawer has both for — a checklist item is a
 * string and a tick, while a subtask carries its own assignee and due date and
 * can be handed to someone else. Subtasks never appear as board cards; the
 * board query filters them out by parent.
 */
export function SubtaskSection({
  parentId,
  boardId,
  subtasks,
  onOpenTask,
}: {
  parentId: string;
  boardId: string;
  subtasks: Task[];
  onOpenTask: (taskId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [isAdding, setAdding] = useState(false);

  function settle() {
    void queryClient.invalidateQueries({ queryKey: taskKey(parentId) });
    void queryClient.invalidateQueries({ queryKey: boardKey(boardId) });
  }

  const create = useMutation({
    mutationFn: async (title: string) => {
      const result = await createTaskAction({ boardId, parentId, title });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onError: (error) => toast.error(error.message),
    onSettled: settle,
  });

  const toggle = useMutation({
    mutationFn: async (input: { id: string; isComplete: boolean }) => {
      const result = await setTaskCompleteAction(input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (_task, input) => {
      const wasComplete = subtasks.find(
        (task) => task.id === input.id,
      )?.completedAt;

      if (input.isComplete && !wasComplete) {
        celebrateTaskCompletion();
      }
    },
    onError: (error) => toast.error(error.message),
    onSettled: settle,
  });

  const done = subtasks.filter((task) => task.completedAt !== null).length;

  function submit() {
    const trimmed = draft.trim();

    if (!trimmed) {
      setAdding(false);
      return;
    }

    create.mutate(trimmed);
    setDraft("");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Subtasks</h3>
        {subtasks.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {done}/{subtasks.length}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          Add
        </Button>
      </div>

      {subtasks.length > 0 ? (
        <ul className="space-y-0.5">
          {subtasks.map((subtask) => {
            const isComplete = subtask.completedAt !== null;

            return (
              <li
                key={subtask.id}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={isComplete}
                  onCheckedChange={(checked) =>
                    toggle.mutate({
                      id: subtask.id,
                      isComplete: checked === true,
                    })
                  }
                  aria-label={`Mark ${subtask.title} ${isComplete ? "incomplete" : "complete"}`}
                />

                <button
                  type="button"
                  onClick={() => onOpenTask(subtask.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm hover:underline",
                    isComplete && "text-muted-foreground line-through",
                  )}
                >
                  {subtask.title}
                </button>

                {subtask.dueDate ? (
                  <DueDateBadge
                    dueDate={subtask.dueDate}
                    isComplete={isComplete}
                    className="shrink-0"
                  />
                ) : null}

                <AssigneeAvatar user={subtask.assignee} />
              </li>
            );
          })}
        </ul>
      ) : null}

      {isAdding ? (
        <Input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={submit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }

            if (event.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Add a subtask and press Enter"
          aria-label="New subtask"
          className="h-8 text-sm"
        />
      ) : null}

      {subtasks.length === 0 && !isAdding ? (
        <p className="text-xs text-muted-foreground">
          Work with its own owner or deadline.
        </p>
      ) : null}
    </section>
  );
}
