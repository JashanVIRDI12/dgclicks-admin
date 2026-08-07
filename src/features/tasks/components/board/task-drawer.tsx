"use client";

import {
  ArchiveIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { AttachmentSection } from "@/features/tasks/components/drawer/attachment-section";
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
          "min-h-0 px-0 py-0 text-lg leading-snug font-semibold",
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
        className={cn(bare, "mt-1 min-h-0 px-0 py-0 text-sm")}
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
  const setComplete = useSetTaskComplete(boardId);
  const deleteTask = useDeleteTask(boardId);

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

  function remove() {
    if (!taskId) {
      return;
    }

    deleteTask.mutate(taskId, {
      onSuccess: () => {
        onClose();
        toast.success("Task deleted.");
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

                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onSelect={archive}
                    disabled={isArchivePending || deleteTask.isPending}
                  >
                    <ArchiveIcon className="size-4" aria-hidden="true" />
                    Archive
                  </DropdownMenuItem>

                  {isAdmin ? (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={remove}
                      disabled={isArchivePending || deleteTask.isPending}
                    >
                      <Trash2Icon className="size-4" aria-hidden="true" />
                      Delete
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
              <div className="space-y-4">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-44 w-full" />
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

                <ChecklistSection
                  taskId={task.id}
                  boardId={boardId}
                  items={task.checklist}
                />

                <SubtaskSection
                  parentId={task.id}
                  boardId={boardId}
                  subtasks={task.subtasks}
                  // A subtask is a real task, so it opens in this same drawer.
                  // It has no card on the board, but the drawer loads by id and
                  // does not need one.
                  onOpenTask={onOpenTask}
                />

                <TimeSection
                  task={task}
                  boardId={boardId}
                  currentUser={currentUser}
                />

                <AttachmentSection
                  taskId={task.id}
                  boardId={boardId}
                  attachments={data.attachments}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                />

                <Separator />

                <CommentSection
                  taskId={task.id}
                  boardId={boardId}
                  comments={data.comments}
                  currentUser={currentUser}
                  isAdmin={isAdmin}
                />

                <ActivitySection entries={data.activity} now={openedAt} />
                </fieldset>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
