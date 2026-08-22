"use client";

import { CheckIcon, UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UserSummary } from "@/features/auth/types";
import {
  AssigneeAvatar,
  AssigneeStack,
} from "@/features/tasks/components/task-meta";
import { TASK_ASSIGNEE_LIMIT } from "@/features/tasks/constants";
import { cn } from "@/lib/utils";

/**
 * Choosing who a task belongs to, one or several.
 *
 * A popover of toggles rather than a multi-select control: picking a second
 * person should not close the list and make you reopen it, which is what a
 * `Select` does on every choice. Selected people stay at the top of the list so
 * removing somebody never means hunting for them among everyone else.
 *
 * The trigger shows the avatars themselves rather than a count, because "who is
 * on this" is the question the row exists to answer and a number does not
 * answer it.
 */
export function AssigneePicker({
  members,
  selectedIds,
  onChange,
  disabled = false,
  className,
  triggerId,
}: {
  members: UserSummary[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
  triggerId?: string;
}) {
  const selected = new Set(selectedIds);
  const isFull = selectedIds.length >= TASK_ASSIGNEE_LIMIT;

  // Chosen first, then everyone else, each group alphabetical.
  const ordered = [...members].sort((a, b) => {
    const byChosen = Number(selected.has(b.id)) - Number(selected.has(a.id));

    return byChosen !== 0 ? byChosen : a.name.localeCompare(b.name);
  });

  const chosen = ordered.filter((member) => selected.has(member.id));

  function toggle(userId: string) {
    if (selected.has(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
      return;
    }

    if (isFull) {
      return;
    }

    onChange([...selectedIds, userId]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={triggerId}
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn("h-7 justify-start gap-1.5 px-2 font-normal", className)}
        >
          {chosen.length > 0 ? (
            <>
              <AssigneeStack users={chosen} avatarClassName="size-4" />
              <span className="truncate">
                {chosen.length === 1 && chosen[0]
                  ? chosen[0].name
                  : `${chosen.length} people`}
              </span>
            </>
          ) : (
            <>
              <UserPlusIcon
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">Unassigned</span>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-1.5">
        <ScrollArea className="max-h-64">
          <div className="space-y-0.5">
            {ordered.map((member) => {
              const isSelected = selected.has(member.id);

              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle(member.id)}
                  // Blocked only for people not already on the task, so a full
                  // list can always be shortened.
                  disabled={isFull && !isSelected}
                  aria-pressed={isSelected}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                >
                  <AssigneeAvatar user={member} className="size-5" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {member.name}
                  </span>
                  {isSelected ? (
                    <CheckIcon
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}

            {members.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nobody else is in this workspace yet.
              </p>
            ) : null}
          </div>
        </ScrollArea>

        {isFull ? (
          <p className="border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">
            {TASK_ASSIGNEE_LIMIT} is the most for one task.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
