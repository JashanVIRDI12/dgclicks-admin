"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarIcon,
  Clock3Icon,
  ListChecksIcon,
  MessageSquareIcon,
  RepeatIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { SubmitButton } from "@/components/common/submit-button";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { UserSummary } from "@/features/auth/types";
import { LabelPicker } from "@/features/tasks/components/drawer/label-picker";
import {
  AssigneeAvatar,
  MediaTypeIcon,
  PriorityIcon,
} from "@/features/tasks/components/task-meta";
import {
  LIMITS,
  MEDIA_TYPES,
  MEDIA_TYPE_LABELS,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
} from "@/features/tasks/constants";
import { useCreateTask } from "@/features/tasks/hooks/use-board";
import {
  createTaskFormSchema,
  type CreateTaskFormValues,
} from "@/features/tasks/schemas/task.schema";
import type { Label } from "@/features/tasks/types";

const UNASSIGNED = "__unassigned__";
const DOES_NOT_REPEAT = "__none__";
const CREATE_RECURRENCE_FREQUENCIES = RECURRENCE_FREQUENCIES.filter(
  (frequency) => frequency !== "custom",
);

const DEFAULT_VALUES: CreateTaskFormValues = {
  title: "",
  description: "",
  priority: "none",
  mediaType: "none",
  assigneeId: null,
  startDate: null,
  dueDate: null,
  labelIds: [],
  recurrenceFrequency: null,
  subtasks: [],
  checklist: [],
  comment: "",
  estimateHours: null,
};

/**
 * A list of titles, staged until the task they belong to exists.
 *
 * Shared by subtasks and the checklist because the interaction is identical —
 * type, Enter, repeat — even though what happens on the server is not. Subtasks
 * become real task documents with a parent id; checklist steps are embedded on
 * the task itself. Neither has anything to attach to until the create succeeds,
 * so both are collected here and sent along with it.
 *
 * The draft commits on blur as well as on Enter, so clicking straight through to
 * Create does not silently discard the line still being typed.
 */
function StagedList({
  value,
  onChange,
  limit,
  placeholder,
  itemLabel,
  fullMessage,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  limit: number;
  placeholder: string;
  /** Accessible name for the input, e.g. "New subtask". */
  itemLabel: string;
  fullMessage: string;
}) {
  const [draft, setDraft] = useState("");
  const isFull = value.length >= limit;

  function add() {
    const trimmed = draft.trim();

    if (!trimmed || isFull) return;

    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="space-y-1">
          {value.map((title, index) => (
            <li
              key={`${index}-${title}`}
              className="group/subtask flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${title}`}
                onClick={() =>
                  onChange(value.filter((_, position) => position !== index))
                }
                className="size-6 text-muted-foreground opacity-0 transition-opacity group-hover/subtask:opacity-100 focus-visible:opacity-100"
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {isFull ? (
        <p className="text-sm text-muted-foreground">{fullMessage}</p>
      ) : (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={add}
            onKeyDown={(event) => {
              // Enter belongs to this list, not the form — submitting the task
              // would lose the line being typed.
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            aria-label={itemLabel}
          />
          {/*
            Mobile only. A touch keyboard's return key is not a reliable "add
            another" — and there is nothing to click instead — so the button
            earns its space there. On a real keyboard Enter already does it, and
            the draft commits on blur either way, so the button was only ever a
            second control for the same keystroke.
          */}
          <Button
            type="button"
            variant="outline"
            onClick={add}
            disabled={draft.trim().length === 0}
            className="sm:hidden"
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

function localDate(value: string | null): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

export function CreateTaskSheet({
  open,
  onOpenChange,
  boardId,
  listId,
  listName,
  labels,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  listId: string | null;
  listName: string | null;
  labels: Label[];
  members: UserSummary[];
}) {
  const createTask = useCreateTask(boardId);
  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { errors, isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);

    if (!next && !isSubmitting) {
      form.reset(DEFAULT_VALUES);
    }
  }

  async function onSubmit(values: CreateTaskFormValues) {
    if (!listId) return;

    try {
      const dueDate = localDate(values.dueDate);
      const recurrenceAnchor = dueDate ?? new Date();
      await createTask.mutateAsync({
        listId,
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        mediaType: values.mediaType,
        assigneeId: values.assigneeId,
        startDate: localDate(values.startDate),
        dueDate,
        labelIds: values.labelIds,
        subtasks: values.subtasks,
        checklist: values.checklist,
        comment: values.comment || undefined,
        estimateMinutes:
          values.estimateHours === null
            ? null
            : Math.round(values.estimateHours * 60),
        recurrence: values.recurrenceFrequency
          ? {
              frequency: values.recurrenceFrequency,
              interval: 1,
              weekdays: [recurrenceAnchor.getDay()],
              dayOfMonth: recurrenceAnchor.getDate(),
              endsAt: null,
            }
          : undefined,
      });

      form.reset(DEFAULT_VALUES);
      // Nothing opens behind it: the sheet already collected everything the
      // drawer would have shown, so following a create with a second panel just
      // leaves the reader another thing to close before they can see the board.
      onOpenChange(false);
      toast.success("Task created.");
    } catch {
      // The mutation owns the public error toast and cache rollback.
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 duration-100 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>New task</SheetTitle>
          <SheetDescription>
            Add it to {listName ?? "this column"}. Only the title is required;
            every other detail is optional.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <FieldGroup>
              <Field data-invalid={Boolean(errors.title)}>
                <FieldLabel htmlFor="new-task-title">Task title</FieldLabel>
                <Input
                  id="new-task-title"
                  autoFocus
                  placeholder="e.g. Publish the monthly performance report"
                  aria-invalid={Boolean(errors.title)}
                  {...form.register("title")}
                />
                <FieldError errors={[errors.title]} />
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="new-task-description">
                  Description <span className="text-muted-foreground">Optional</span>
                </FieldLabel>
                <Textarea
                  id="new-task-description"
                  rows={4}
                  placeholder="Add context, expected outcome, or useful links."
                  aria-invalid={Boolean(errors.description)}
                  {...form.register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="new-task-priority">Priority</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="new-task-priority" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              <PriorityIcon priority={priority} />
                              {TASK_PRIORITY_LABELS[priority]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />


                <Controller
                  control={form.control}
                  name="mediaType"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="new-task-media">Media type</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="new-task-media" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDIA_TYPES.map((mediaType) => (
                            <SelectItem key={mediaType} value={mediaType}>
                              <MediaTypeIcon mediaType={mediaType} />
                              {MEDIA_TYPE_LABELS[mediaType]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                <Controller
                  control={form.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="new-task-assignee">Assignee</FieldLabel>
                      <Select
                        value={field.value ?? UNASSIGNED}
                        onValueChange={(value) =>
                          field.onChange(value === UNASSIGNED ? null : value)
                        }
                      >
                        <SelectTrigger id="new-task-assignee" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>
                            <UserIcon className="size-3.5 text-muted-foreground" />
                            Unassigned
                          </SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              <AssigneeAvatar user={member} className="size-4" />
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <Field data-invalid={Boolean(errors.startDate)}>
                      <FieldLabel htmlFor="new-task-start-date">
                        <CalendarIcon className="size-3.5" />
                        Start date
                      </FieldLabel>
                      <Input
                        id="new-task-start-date"
                        type="date"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                        aria-invalid={Boolean(errors.startDate)}
                      />
                      <FieldError errors={[errors.startDate]} />
                    </Field>
                  )}
                />

                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <Field data-invalid={Boolean(errors.dueDate)}>
                      <FieldLabel htmlFor="new-task-due-date">
                        <CalendarIcon className="size-3.5" />
                        Due date
                      </FieldLabel>
                      <Input
                        id="new-task-due-date"
                        type="date"
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(event.target.value || null)
                        }
                        aria-invalid={Boolean(errors.dueDate)}
                      />
                      <FieldError errors={[errors.dueDate]} />
                    </Field>
                  )}
                />
              </div>

              <Controller
                control={form.control}
                name="estimateHours"
                render={({ field }) => (
                  <Field data-invalid={Boolean(errors.estimateHours)}>
                    <FieldLabel htmlFor="new-task-estimate">
                      <Clock3Icon className="size-3.5" />
                      Estimated hours
                    </FieldLabel>
                    <Input
                      id="new-task-estimate"
                      type="number"
                      min={0.25}
                      max={24 * 365}
                      step={0.25}
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                      placeholder="e.g. 2.5"
                      aria-invalid={Boolean(errors.estimateHours)}
                    />
                    <FieldDescription>
                      Leave empty when the work has not been estimated yet.
                    </FieldDescription>
                    <FieldError errors={[errors.estimateHours]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="labelIds"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Labels</FieldLabel>
                    <LabelPicker
                      boardId={boardId}
                      labels={labels}
                      selectedIds={field.value}
                      onChange={field.onChange}
                    />
                    <FieldDescription>
                      Select existing labels or create one here.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="checklist"
                render={({ field }) => (
                  <Field data-invalid={Boolean(errors.checklist)}>
                    <FieldLabel>
                      <ListChecksIcon className="size-3.5" />
                      Checklist
                    </FieldLabel>
                    <StagedList
                      value={field.value}
                      onChange={field.onChange}
                      limit={LIMITS.checklistItems}
                      placeholder="e.g. Export the raw data"
                      itemLabel="New checklist step"
                      fullMessage={`That is the maximum of ${LIMITS.checklistItems} steps.`}
                    />
                    <FieldDescription>
                      Steps to tick off inside this task. Add more later from the
                      task itself.
                    </FieldDescription>
                    <FieldError errors={[errors.checklist]} />
                  </Field>
                )}
              />

              {/*
                No subtasks here. Two ways to break a task into pieces, side by
                side in the same form, made people pick between them before they
                had a reason to care about the difference — and for most tasks
                the checklist above is the one they wanted. Subtasks remain in
                the task panel, where the difference is visible: a subtask you
                can hand to somebody else, with its own owner and deadline.
              */}

              <Field data-invalid={Boolean(errors.comment)}>
                <FieldLabel htmlFor="new-task-comment">
                  <MessageSquareIcon className="size-3.5" />
                  Comment <span className="text-muted-foreground">Optional</span>
                </FieldLabel>
                <Textarea
                  id="new-task-comment"
                  rows={2}
                  placeholder="Anything the assignee should know before they start."
                  aria-invalid={Boolean(errors.comment)}
                  {...form.register("comment")}
                />
                <FieldDescription>
                  Posted as you, as the first comment on the task.
                </FieldDescription>
                <FieldError errors={[errors.comment]} />
              </Field>

              <Controller
                control={form.control}
                name="recurrenceFrequency"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="new-task-recurrence">
                      <RepeatIcon className="size-3.5" />
                      Repeat
                    </FieldLabel>
                    <Select
                      value={field.value ?? DOES_NOT_REPEAT}
                      onValueChange={(value) =>
                        field.onChange(
                          value === DOES_NOT_REPEAT ? null : value,
                        )
                      }
                    >
                      <SelectTrigger id="new-task-recurrence" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DOES_NOT_REPEAT}>
                          Does not repeat
                        </SelectItem>
                        {CREATE_RECURRENCE_FREQUENCIES.map((frequency) => (
                          <SelectItem key={frequency} value={frequency}>
                            {RECURRENCE_FREQUENCY_LABELS[frequency]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Uses the due date as its schedule. Advanced repeat options
                      remain available in task details.
                    </FieldDescription>
                  </Field>
                )}
              />
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isPending={isSubmitting} pendingLabel="Creating…">
              Create task
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
