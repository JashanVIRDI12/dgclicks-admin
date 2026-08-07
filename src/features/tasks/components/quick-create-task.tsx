"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTaskAction } from "@/features/tasks/actions/task.actions";
import type { Board } from "@/features/tasks/types";

/**
 * Capture a task without leaving the dashboard.
 *
 * One field and a board picker: anything more is a form, and a form is the
 * reason people write things on paper instead. It lands in the board's first
 * column, where everything else that has not been triaged lives.
 */
export function QuickCreateTask({ boards }: { boards: Board[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");

  function submit() {
    const trimmed = title.trim();

    if (!trimmed || !boardId) {
      return;
    }

    startTransition(async () => {
      const result = await createTaskAction({ boardId, title: trimmed });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setTitle("");
      toast.success("Task added.");
      router.refresh();
    });
  }

  if (boards.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-soft sm:flex-row">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Add a task…"
        aria-label="New task title"
        className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />

      <div className="flex gap-2">
        <Select value={boardId} onValueChange={setBoardId}>
          <SelectTrigger className="flex-1 sm:w-44" aria-label="Board">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {boards.map((board) => (
              <SelectItem key={board.id} value={board.id}>
                {board.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={submit} disabled={isPending || !title.trim()}>
          <PlusIcon className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </div>
  );
}
