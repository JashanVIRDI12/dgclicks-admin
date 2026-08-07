"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UserSummary } from "@/features/auth/types";
import { setBoardPermissionsAction } from "@/features/tasks/actions/board.actions";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import type { BoardAccessMode } from "@/features/tasks/constants";
import type { Board } from "@/features/tasks/types";

export function BoardPermissionsDialog({
  board,
  members,
  open,
  onOpenChange,
}: {
  board: Board;
  members: UserSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accessMode, setAccessMode] = useState<BoardAccessMode>(
    board.accessMode,
  );
  const [editorIds, setEditorIds] = useState(board.editorIds);

  function toggleEditor(userId: string) {
    setEditorIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function save() {
    startTransition(async () => {
      const result = await setBoardPermissionsAction({
        id: board.id,
        accessMode,
        editorIds,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onOpenChange(false);
      toast.success("Board permissions updated.");
      router.refresh();
    });
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);

    if (!next) {
      setAccessMode(board.accessMode);
      setEditorIds(board.editorIds);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Board permissions</DialogTitle>
          <DialogDescription>
            Choose who can see this board and who can change it. Administrators
            always keep both.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={accessMode}
          onValueChange={(value) => setAccessMode(value as BoardAccessMode)}
          className="gap-3"
        >
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <RadioGroupItem value="workspace" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">All members</span>
              <span className="block text-xs text-muted-foreground">
                Every workspace member can see and edit this board.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <RadioGroupItem value="restricted" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Selected editors</span>
              <span className="block text-xs text-muted-foreground">
                Everyone can see it; only the people you pick can change it.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
            <RadioGroupItem value="private" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Private</span>
              <span className="block text-xs text-muted-foreground">
                Only the people you pick can see it at all, and they can edit
                it. It stays hidden everywhere else in the app.
              </span>
            </span>
          </label>
        </RadioGroup>

        {accessMode !== "workspace" ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {accessMode === "private" ? "Board members" : "Board editors"}
            </p>
            <div className="scrollbar-subtle max-h-56 space-y-1 overflow-y-auto rounded-xl bg-surface p-1.5">
              {members.map((member) => {
                const checked = editorIds.includes(member.id);

                return (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleEditor(member.id)}
                    />
                    <AssigneeAvatar user={member} className="size-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{member.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {member.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {/*
          Saving a private board with nobody on it is legal — administrators
          always retain access, so it cannot be orphaned — but it is almost
          never what the reader meant, and the board disappearing from their own
          sidebar is a confusing way to find out.
        */}
        {accessMode === "private" && editorIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nobody is selected, so only administrators will see this board.
          </p>
        ) : null}

        <DialogFooter>
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
