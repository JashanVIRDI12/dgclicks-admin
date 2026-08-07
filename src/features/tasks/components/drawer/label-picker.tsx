"use client";

import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LabelChip, LabelDot, chipStyle } from "@/features/tasks/components/label-chip";
import {
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
  type LabelColor,
} from "@/features/tasks/constants";
import {
  useCreateLabel,
  useDeleteLabel,
  useUpdateLabel,
} from "@/features/tasks/hooks/use-board";
import type { Label } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Picks labels, and creates them when the board has none yet.
 *
 * Creation lives here rather than in a separate settings screen because a new
 * board starts with an empty palette — sending someone elsewhere to define a
 * label before they can apply one is the friction this replaces.
 */
export function LabelPicker({
  boardId,
  labels,
  selectedIds,
  onChange,
}: {
  boardId: string;
  labels: Label[];
  selectedIds: string[];
  onChange: (labelIds: string[]) => void;
}) {
  const createLabel = useCreateLabel(boardId);
  const updateLabel = useUpdateLabel(boardId);
  const deleteLabel = useDeleteLabel(boardId);
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<LabelColor>(DEFAULT_LABEL_COLOR);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editColor, setEditColor] = useState<LabelColor>(DEFAULT_LABEL_COLOR);
  const isPending =
    createLabel.isPending || updateLabel.isPending || deleteLabel.isPending;

  const selected = labels.filter((label) => selectedIds.includes(label.id));

  function toggle(labelId: string) {
    onChange(
      selectedIds.includes(labelId)
        ? selectedIds.filter((id) => id !== labelId)
        : [...selectedIds, labelId],
    );
  }

  function saveEdit(labelId: string) {
    const name = editDraft.trim();

    if (!name) {
      return;
    }

    updateLabel.mutate(
      {
        id: labelId,
        name,
        color: editColor,
      },
      { onSuccess: () => setEditingId(null) },
    );
  }

  /**
   * Deleting pulls the label off every task that carried it, board-wide — not
   * just this one. Said out loud, because the picker is opened from a single
   * card and the scope is otherwise easy to misread.
   */
  function remove(label: Label) {
    deleteLabel.mutate(label.id, {
      onSuccess: () => {
        setEditingId(null);
        onChange(selectedIds.filter((id) => id !== label.id));
        toast.success(`"${label.name}" removed from every task on this board.`);
      },
    });
  }

  function create() {
    const name = draft.trim();

    if (!name) {
      return;
    }

    createLabel.mutate(
      { name, color },
      {
        onSuccess: (label) => {
          setDraft("");
          onChange([...selectedIds, label.id]);
        },
      },
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto min-h-7 w-full justify-start gap-1 py-1 text-left font-normal"
        >
          {selected.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {selected.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <TagIcon className="size-3.5" aria-hidden="true" />
              Add labels
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2">
        {labels.length > 0 ? (
          <ul className="mb-2 max-h-48 space-y-0.5 overflow-y-auto">
            {labels.map((label) => {
              const isSelected = selectedIds.includes(label.id);
              const isEditing = editingId === label.id;

              if (isEditing) {
                return (
                  <li key={label.id} className="space-y-1.5 rounded-md bg-accent/50 p-1.5">
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveEdit(label.id);
                        }

                        if (event.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      aria-label={`Rename ${label.name}`}
                      className="h-7 text-sm"
                    />

                    <div className="flex items-center gap-1.5">
                      <div
                        className="flex flex-1 flex-wrap gap-1"
                        role="radiogroup"
                        aria-label="Label colour"
                      >
                        {LABEL_COLORS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={editColor === option}
                            aria-label={option}
                            onClick={() => setEditColor(option)}
                            style={chipStyle(option)}
                            className={cn(
                              "chip-dot size-4 rounded-full transition-transform hover:scale-110",
                              editColor === option &&
                                "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                            )}
                          />
                        ))}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={isPending || !editDraft.trim()}
                        onClick={() => saveEdit(label.id)}
                      >
                        Save
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0 text-muted-foreground"
                        aria-label={`Delete ${label.name}`}
                        disabled={isPending}
                        onClick={() => remove(label)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={label.id} className="group/label flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggle(label.id)}
                    aria-pressed={isSelected}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <LabelDot color={label.color} />
                    <span className="flex-1 truncate">{label.name}</span>
                    {isSelected ? (
                      <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${label.name}`}
                    onClick={() => {
                      setEditingId(label.id);
                      setEditDraft(label.name);
                      setEditColor(label.color);
                    }}
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/label:opacity-100 focus-visible:opacity-100"
                  >
                    <PencilIcon className="size-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="space-y-2 border-t pt-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                create();
              }
            }}
            placeholder="New label name"
            aria-label="New label name"
            className="h-8 text-sm"
          />

          <div className="flex items-center gap-1.5">
            <div
              className="flex flex-1 flex-wrap gap-1"
              role="radiogroup"
              aria-label="Label colour"
            >
              {LABEL_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={color === option}
                  aria-label={option}
                  onClick={() => setColor(option)}
                  style={chipStyle(option)}
                  className={cn(
                    "chip-dot size-4 rounded-full transition-transform hover:scale-110",
                    color === option &&
                      "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                  )}
                />
              ))}
            </div>

            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="size-7 shrink-0"
              aria-label="Create label"
              disabled={!draft.trim() || isPending}
              onClick={create}
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
