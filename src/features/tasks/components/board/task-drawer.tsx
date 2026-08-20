"use client";

import { useIsMutating } from "@tanstack/react-query";
import {
  ArchiveIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/common/spinner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AskAiButton } from "@/features/assistant/components/ask-ai-button";
import { taskAssistantActions } from "@/features/assistant/prompts";
import type { UserSummary } from "@/features/auth/types";
import { setTaskArchivedAction } from "@/features/tasks/actions/task.actions";
import { ActivitySection } from "@/features/tasks/components/drawer/activity-section";
import { ChecklistSection } from "@/features/tasks/components/drawer/checklist-section";
import { CommentSection } from "@/features/tasks/components/drawer/comment-section";
import { SubtaskSection } from "@/features/tasks/components/drawer/subtask-section";
import { TaskProperties } from "@/features/tasks/components/drawer/task-properties";
import { TimeSection } from "@/features/tasks/components/drawer/time-section";
import {
  useDeleteTask,
  useSetTaskComplete,
  useUpdateTask,
} from "@/features/tasks/hooks/use-board";
import { useTaskWorkspace } from "@/features/tasks/hooks/use-task-workspace";
import type { Label, TaskDetail } from "@/features/tasks/types";
import { cn } from "@/lib/utils";

/**
 * Title and description, saved on blur.
 *
 * A drawer that closes when you click outside it cannot have a Save button, so
 * every edit commits the moment focus leaves the field. The draft is keyed on
 * the task so switching cards never carries text between them.
 *
 * `dark:bg-transparent` is not redundant: `Textarea` carries `dark:bg-input/30`,
 * and a plain `bg-transparent` loses to it in dark mode — which is what turned
 * these two into filled boxes rather than plain text.
 */
function TitleAndDescription({
  task,
  boardId,
}: {
  task: TaskDetail;
  boardId: string;
}) {
  const update = useUpdateTask(boardId);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  const bare =
    "resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent";

  return (
    <div>
      <Textarea
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          const trimmed = title.trim();

          if (!trimmed) {
            setTitle(task.title);
            return;
          }

          if (trimmed !== task.title) {
            update.mutate({ id: task.id, title: trimmed });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        rows={1}
        aria-label="Task title"
        className={cn(
          bare,
          // The panel's one piece of large type. At `text-lg` it sat at almost
          // the same weight as the section headings below it, so nothing
          // announced what the card actually was.
          "min-h-0 px-0 py-0 text-xl leading-tight font-semibold tracking-tight",
          task.completedAt && "text-muted-foreground line-through",
        )}
      />

      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={() => {
          const trimmed = description.trim();

          if (trimmed !== (task.description ?? "")) {
            update.mutate({ id: task.id, description: trimmed || null });
          }
        }}
        rows={2}
        placeholder="Add a description…"
        aria-label="Description"
        className={cn(
          bare,
          "mt-1.5 min-h-0 px-0 py-0 text-sm leading-relaxed text-muted-foreground focus-visible:text-foreground",
        )}
      />
    </div>
  );
}

/**
 * The card, opened.
 *
 * A right-hand drawer rather than its own route: the board stays visible
 * behind it, closing loses nothing, and the URL still carries `?task=` so a
 * card can be linked to from the activity feed or the command palette.
 */
export function TaskDrawer({
  taskId,
  boardId,
  labels,
  members,
  currentUser,
  isAdmin,
  canEdit,
  onClose,
  onOpenTask,
}: {
  taskId: string | null;
  boardId: string;
  labels: Label[];
  members: UserSummary[];
  currentUser: UserSummary;
  isAdmin: boolean;
  canEdit: boolean;
  onClose: () => void;
  /** Swaps the drawer to another task, used by the subtask list. */
  onOpenTask: (taskId: string) => void;
}) {
  const router = useRouter();
  const [isArchivePending, startTransition] = useTransition();
  const { data, isPending: isLoading, isError } = useTaskWorkspace(taskId);
  const isSaving = useIsMutating() > 0;
  const setComplete = useSetTaskComplete(boardId);
  const deleteTask = useDeleteTask(boardId);
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);

  // Read once, through a lazy initialiser: relative timestamps need the current
  // time, and calling `new Date()` in the component body is the impurity the
  // React Compiler rejects.
  const [openedAt] = useState(() => new Date());

  function archive() {
    if (!taskId) {
      return;
    }

    startTransition(async () => {
      const result = await setTaskArchivedAction({ id: taskId });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onClose();
      toast.success("Task archived.");
      router.refresh();
    });
  }

  /**
   * Permanent deletion, from the card itself.
   *
   * Behind a confirmation rather than a bare menu click. It sits two rows below
   * Archive, which is completely reversible, and the dialog is what keeps the
   * two apart — a destructive item that fires on one click next to a safe one
   * is how people lose work they meant to file away.
   */
  function remove() {
    if (!taskId) {
      return;
    }

    deleteTask.mutate(taskId, {
      onSuccess: () => {
        setConfirmingDelete(false);
        onClose();
        toast.success("Task deleted permanently.");
        router.refresh();
      },
    });
  }

  const task = data?.task;
  const isComplete = task?.completedAt != null;

  return (
    <Sheet open={taskId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        /*
         * The built-in close button is absolutely positioned at top-right,
         * which put it directly on top of the options menu — two controls in
         * one place, and clicks landing on whichever won the stacking order.
         * The header renders both itself, in a row, instead.
         */
        showCloseButton={false}
        className="w-full gap-0 p-0 duration-100 sm:max-w-xl"
        aria-describedby={undefined}
      >
        <SheetHeader className="flex-row items-center gap-3 border-b px-5 py-3">
          {task ? (
            <>
              {canEdit ? (
                <Checkbox
                  checked={isComplete}
                  onCheckedChange={(checked) =>
                    setComplete.mutate({
                      id: task.id,
                      isComplete: checked === true,
                    })
                  }
                  aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
                />
              ) : null}
              <SheetTitle className="sr-only">{task.title}</SheetTitle>
              <span
                className={cn(
                  "text-xs font-medium",
                  isComplete ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {isComplete ? "Complete" : "Open"}
              </span>
            </>
          ) : (
            <SheetTitle className="text-sm font-medium">Task</SheetTitle>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            {/*
              The panel has no Save button, so a write that takes a moment would
              otherwise be completely silent — you would change a field, see
              nothing, and wonder. `useIsMutating` covers every section at once:
              properties, checklist, subtasks, comments, files and time all
              report here without any of them knowing about this indicator.
            */}
            {isSaving ? (
              <span className="mr-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                Saving…
              </span>
            ) : null}

            {/*
              Every action behind this writes to the task, so it follows the
              same permission as the checkbox above rather than appearing for
              readers who could not apply what it suggests.
            */}
            {task && canEdit ? (
              <AskAiButton
                actions={taskAssistantActions(task.title)}
                className="mr-1"
              />
            ) : null}

            {task && canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Task options"
                    className="size-8 text-muted-foreground"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>

                {/*
                  Archive first, delete second — and delete is admin-only.

                  These sat side by side once with no confirmation on either,
                  which put an irreversible action one click from a reversible
                  one on a card somebody was already looking at. Both are still
                  here because clearing a card and destroying it are different
                  intentions, but the destructive one now asks first and names
                  the task in the question.
                */}
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={archive}
                    disabled={isArchivePending}
                  >
                    <ArchiveIcon className="size-4" aria-hidden="true" />
                    Archive
                  </DropdownMenuItem>

                  {/* Admin only, and it asks. Archive is the everyday way to
                      clear a card; this is for work that should never have
                      existed. */}
                  {isAdmin ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setConfirmingDelete(true)}
                      disabled={isArchivePending || deleteTask.isPending}
                    >
                      <Trash2Icon className="size-4" aria-hidden="true" />
                      Delete permanently
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
              className="size-8 text-muted-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-5 py-5">
            {isLoading ? (
              /*
                Shaped like the panel it stands in for — title, description, the
                eight property rows, then two sections — so the content lands in
                place instead of shoving a generic block out of the way. The
                whole thing is one `aria-busy` region with a single label, since
                announcing a dozen placeholders individually tells a screen
                reader nothing.
              */
              <div
                className="space-y-6"
                role="status"
                aria-busy="true"
                aria-label="Loading task"
              >
                <div className="space-y-2">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>

                <div className="space-y-2">
                  {["status", "priority", "media", "assignee", "due", "start", "labels", "estimate", "repeat"].map(
                    (row, index) => (
                      <div
                        key={row}
                        className="grid grid-cols-[5.5rem_1fr] items-center gap-2"
                      >
                        <Skeleton className="h-3 w-14" />
                        <Skeleton
                          className="h-6"
                          // Varied widths so it reads as content rather than a
                          // stack of identical bars.
                          style={{ width: `${[45, 38, 52, 42, 40, 60, 34, 48][index]}%` }}
                        />
                      </div>
                    ),
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-5/6" />
                </div>

                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-full" />
                </div>

                <span className="sr-only">Loading task</span>
              </div>
            ) : isError || !task || !data ? (
              <SheetDescription className="text-destructive">
                Could not load this task. Close the panel and try again.
              </SheetDescription>
            ) : (
              <div className="space-y-6">
                {!canEdit ? (
                  <p className="rounded-lg bg-accent px-3 py-2 text-xs text-muted-foreground">
                    You have view-only access. A board administrator can add you
                    as an editor.
                  </p>
                ) : null}

                {/*
                  Three groups, not nine stacked sections: what the task *is*,
                  what the work *is made of*, and what people have *said about
                  it*. Separators fall between the groups only — one after every
                  section turned the panel into a striped list where nothing was
                  more related to anything else.
                */}
                <fieldset disabled={!canEdit} className="contents">
                  <TitleAndDescription
                    // Remount on task change so the drafts reset with the card.
                    key={task.id}
                    task={task}
                    boardId={boardId}
                  />

                  <TaskProperties
                    task={task}
                    boardId={boardId}
                    labels={labels}
                    members={members}
                  />

                  <Separator />

                  <div className="space-y-6">
                    <ChecklistSection
                      taskId={task.id}
                      boardId={boardId}
                      items={task.checklist}
                    />

                    <SubtaskSection
                      parentId={task.id}
                      boardId={boardId}
                      subtasks={task.subtasks}
                      // A subtask is a real task, so it opens in this same
                      // drawer. It has no card on the board, but the drawer
                      // loads by id and does not need one.
                      onOpenTask={onOpenTask}
                    />

                    <TimeSection
                      task={task}
                      boardId={boardId}
                      currentUser={currentUser}
                    />

                  </div>

                  <Separator />

                  <div className="space-y-6">
                    <CommentSection
                      taskId={task.id}
                      boardId={boardId}
                      comments={data.comments}
                      currentUser={currentUser}
                      isAdmin={isAdmin}
                    />

                    <ActivitySection entries={data.activity} now={openedAt} />
                  </div>
                </fieldset>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      <AlertDialog open={isConfirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {task?.title ?? "this task"} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task and its subtasks, comments and time entries.
              It cannot be undone. If you only want it off the board, archive it
              instead — that is reversible and still counts towards your totals.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTask.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteTask.isPending}
              onClick={remove}
            >
              {deleteTask.isPending ? <Spinner /> : null}
              Delete permanently
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
