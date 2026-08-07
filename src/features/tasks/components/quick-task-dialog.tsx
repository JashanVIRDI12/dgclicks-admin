"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
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
 * Create a task from anywhere, via the command palette.
 *
 * Title and board only. Everything else is set in the drawer it opens into, so
 * capturing a thought never costs more than a sentence and a Return.
 */
export function QuickTaskDialog({
  open,
  onOpenChange,
  boards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: Board[];
}) {
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
      onOpenChange(false);
      // Land in the card that was just created, ready to fill in the rest.
      router.push(`/boards/${boardId}?task=${result.data.id}` as Route);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            It lands in the board&apos;s first column. Everything else can be
            filled in afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="quick-task-title">Title</FieldLabel>
            <Input
              id="quick-task-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Write the monthly SEO report"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="quick-task-board">Board</FieldLabel>
            <Select value={boardId} onValueChange={setBoardId}>
              <SelectTrigger id="quick-task-board" className="w-full">
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
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={isPending || !title.trim()}>
            {isPending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
