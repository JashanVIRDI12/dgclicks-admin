"use client";

import { MessageSquareIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Spinner } from "@/components/common/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { UserSummary } from "@/features/auth/types";
import { DrawerSection } from "@/features/tasks/components/drawer/section";
import { initials } from "@/features/tasks/components/task-meta";
import {
  useCreateComment,
  useDeleteComment,
} from "@/features/tasks/hooks/use-task-workspace";
import type { Comment } from "@/features/tasks/types";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CommentSection({
  taskId,
  boardId,
  comments,
  currentUser,
  isAdmin,
}: {
  taskId: string;
  boardId: string;
  comments: Comment[];
  currentUser: UserSummary;
  isAdmin: boolean;
}) {
  const create = useCreateComment(taskId, boardId, {
    id: currentUser.id,
    name: currentUser.name,
    image: currentUser.image,
  });
  const remove = useDeleteComment(taskId, boardId);

  const [body, setBody] = useState("");

  function submit() {
    const trimmed = body.trim();

    if (!trimmed) {
      return;
    }

    setBody("");
    create.mutate(trimmed, {
      // Hand the text back rather than making them retype it.
      onError: () => setBody(trimmed),
    });
  }

  return (
    <DrawerSection
      icon={MessageSquareIcon}
      title="Comments"
      meta={comments.length > 0 ? comments.length : undefined}
    >
      {comments.length > 0 ? (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const isOptimistic = comment.id.startsWith("optimistic-");
            const canDelete =
              !isOptimistic &&
              (isAdmin || comment.author?.id === currentUser.id);

            return (
              <li
                key={comment.id}
                className="group/comment flex gap-2.5"
                data-pending={isOptimistic || undefined}
              >
                <Avatar className="mt-0.5 size-6 shrink-0">
                  {comment.author?.image ? (
                    <AvatarImage src={comment.author.image} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[0.625rem]">
                    {initials(comment.author?.name ?? "?")}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">
                      {comment.author?.name ?? "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {isOptimistic
                        ? "Saving…"
                        : formatTimestamp(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-pretty">
                    {comment.body}
                  </p>
                </div>

                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete comment"
                    onClick={() => remove.mutate(comment.id)}
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/comment:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Cmd/Ctrl+Enter submits — the expected shortcut in a box that
            // otherwise accepts newlines.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Leave a comment…"
          aria-label="New comment"
          className="resize-none text-sm"
        />

        {body.trim() ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              aria-busy={create.isPending}
              disabled={create.isPending}
              onClick={submit}
            >
              {create.isPending ? <Spinner /> : null}
              Comment
            </Button>
          </div>
        ) : null}
      </div>
    </DrawerSection>
  );
}
