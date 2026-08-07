"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { SubmitButton } from "@/components/common/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createBoardAction,
  updateBoardAction,
} from "@/features/tasks/actions/board.actions";
import { BOARD_ICON_COMPONENTS } from "@/features/tasks/components/board-icon";
import { chipStyle } from "@/features/tasks/components/label-chip";
import {
  BOARD_ICONS,
  DEFAULT_BOARD_ICON,
  DEFAULT_LABEL_COLOR,
  LABEL_COLORS,
} from "@/features/tasks/constants";
import {
  boardFormSchema,
  type BoardFormValues,
} from "@/features/tasks/schemas/board.schema";
import type { Board } from "@/features/tasks/types";
import { applyActionErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";

const FIELDS = ["name", "description", "icon", "color"] as const;

/**
 * Creates or edits a board.
 *
 * One component for both because the fields are identical — the only difference
 * is which action it calls and what the button says, and two near-copies would
 * drift the moment a field is added.
 */
export function BoardFormDialog({
  workspaceId,
  board,
  trigger,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  /** Present when editing; absent creates a new board. */
  board?: Board;
  /** Omit when driving the dialog from outside with `open`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isEditing = Boolean(board);

  // Controlled when a parent passes `open` — the command palette opens this
  // without a trigger to click. Uncontrolled everywhere else, so the common
  // case stays a one-prop component.
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: {
      name: board?.name ?? "",
      description: board?.description ?? undefined,
      icon: board?.icon ?? DEFAULT_BOARD_ICON,
      color: board?.color ?? DEFAULT_LABEL_COLOR,
    },
  });

  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: BoardFormValues) {
    const result = board
      ? await updateBoardAction({ ...values, id: board.id })
      : await createBoardAction({ ...values, workspaceId });

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);

      if (message) {
        toast.error(message);
      }

      return;
    }

    setOpen(false);
    toast.success(isEditing ? "Board updated." : `${result.data.name} created.`);

    if (!isEditing) {
      router.push(`/boards/${result.data.id}`);
    }

    router.refresh();
  }

  function handleOpenChange(open: boolean) {
    setOpen(open);

    // Reset on close so a cancelled edit does not reopen holding the old draft.
    if (!open) {
      form.reset({
        name: board?.name ?? "",
        description: board?.description ?? undefined,
        icon: board?.icon ?? DEFAULT_BOARD_ICON,
        color: board?.color ?? DEFAULT_LABEL_COLOR,
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Board settings" : "New board"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Rename this board or change how it looks."
              : "A board is one team or workflow. It starts with five columns you can rename."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="board-name">Name</FieldLabel>
              <Input
                id="board-name"
                autoFocus
                placeholder="SEO"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="board-description">Description</FieldLabel>
              <Textarea
                id="board-description"
                rows={2}
                placeholder="What this board is for."
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            {/*
              `Controller` rather than `watch()`: reading a watched value makes
              the React Compiler bail out of memoising this whole component, and
              these two pickers re-render on every keystroke in the name field.
            */}
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Colour</FieldLabel>
                  <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Board colour"
                  >
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={field.value === color}
                        aria-label={color}
                        onClick={() => field.onChange(color)}
                        style={chipStyle(color)}
                        className={cn(
                          "chip-dot size-6 rounded-full transition-transform",
                          "hover:scale-110",
                          field.value === color &&
                            "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                        )}
                      />
                    ))}
                  </div>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Icon</FieldLabel>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="radiogroup"
                    aria-label="Board icon"
                  >
                    {BOARD_ICONS.map((icon) => {
                      const Icon = BOARD_ICON_COMPONENTS[icon];
                      const isSelected = field.value === icon;

                      return (
                        <button
                          key={icon}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={icon}
                          onClick={() => field.onChange(icon)}
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-accent text-foreground ring-2 ring-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                  <FieldDescription>
                    Shown in the sidebar and on the board index.
                  </FieldDescription>
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <SubmitButton
              isPending={isSubmitting}
              pendingLabel={isEditing ? "Saving…" : "Creating…"}
            >
              {isEditing ? "Save changes" : "Create board"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
