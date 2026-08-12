"use client";

import { ListChecksIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Spinner } from "@/components/common/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DrawerSection,
  SectionEmpty,
} from "@/features/tasks/components/drawer/section";
import {
  useAddChecklistItem,
  useRemoveChecklistItem,
  useToggleChecklistItem,
} from "@/features/tasks/hooks/use-task-workspace";
import type { ChecklistItem } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

export function ChecklistSection({
  taskId,
  boardId,
  items,
}: {
  taskId: string;
  boardId: string;
  items: ChecklistItem[];
}) {
  const toggle = useToggleChecklistItem(taskId, boardId);
  const add = useAddChecklistItem(taskId, boardId);
  const remove = useRemoveChecklistItem(taskId, boardId);

  const [draft, setDraft] = useState("");
  const [isAdding, setAdding] = useState(false);

  const done = items.filter((item) => item.done).length;
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  function submit() {
    const trimmed = draft.trim();

    if (!trimmed) {
      setAdding(false);
      return;
    }

    add.mutate(trimmed);
    setDraft("");
  }

  return (
    <DrawerSection
      icon={ListChecksIcon}
      title="Checklist"
      meta={items.length > 0 ? `${done}/${items.length}` : undefined}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground"
          aria-busy={add.isPending}
          onClick={() => setAdding(true)}
        >
          {add.isPending ? (
            <Spinner />
          ) : (
            <PlusIcon className="size-3.5" aria-hidden="true" />
          )}
          Add
        </Button>
      }
    >
      {items.length > 0 ? (
        <Progress
          value={percent}
          aria-label={`${percent}% of the checklist done`}
          className="h-1"
        />
      ) : null}

      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} className="group/item flex items-center gap-2.5">
            <Checkbox
              id={`checklist-${item.id}`}
              checked={item.done}
              onCheckedChange={(checked) =>
                toggle.mutate({ itemId: item.id, done: checked === true })
              }
            />
            <label
              htmlFor={`checklist-${item.id}`}
              className={cn(
                "flex-1 cursor-pointer py-1 text-sm text-pretty",
                item.done && "text-muted-foreground line-through",
              )}
            >
              {item.title}
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${item.title}`}
              onClick={() => remove.mutate(item.id)}
              className="size-6 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
            >
              <XIcon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>

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
          placeholder="Add a step and press Enter"
          aria-label="New checklist item"
          className="h-8 text-sm"
        />
      ) : null}

      {items.length === 0 && !isAdding ? (
        <SectionEmpty>
          Steps to tick off as you work.
        </SectionEmpty>
      ) : null}
    </DrawerSection>
  );
}
