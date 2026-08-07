"use client";

import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import type { UserSummary } from "@/features/auth/types";
import { LIMITS } from "@/features/tasks/constants";
import {
  useDeleteAttachment,
  useUploadAttachment,
} from "@/features/tasks/hooks/use-task-workspace";
import type { Attachment } from "@/features/tasks/types";

function iconFor(contentType: string): LucideIcon {
  if (contentType.startsWith("image/")) {
    return ImageIcon;
  }

  if (contentType === "application/pdf" || contentType.startsWith("text/")) {
    return FileTextIcon;
  }

  return FileIcon;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentSection({
  taskId,
  boardId,
  attachments,
  currentUser,
  isAdmin,
}: {
  taskId: string;
  boardId: string;
  attachments: Attachment[];
  currentUser: UserSummary;
  isAdmin: boolean;
}) {
  const upload = useUploadAttachment(taskId, boardId);
  const remove = useDeleteAttachment(taskId, boardId);
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = attachments.length >= LIMITS.attachmentsPerTask;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">Attachments</h3>
        {attachments.length > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {attachments.length}
          </span>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          disabled={upload.isPending || isFull}
          onClick={() => inputRef.current?.click()}
          className="ml-auto h-7 text-muted-foreground"
        >
          {upload.isPending ? (
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <PaperclipIcon className="size-3.5" aria-hidden="true" />
          )}
          {upload.isPending ? "Uploading…" : "Attach"}
        </Button>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Attach a file"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              upload.mutate(file);
            }

            // Reset so choosing the same file twice in a row still fires.
            event.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 ? (
        <ul className="space-y-1">
          {attachments.map((attachment) => {
            const Icon = iconFor(attachment.contentType);
            const canDelete =
              isAdmin || attachment.uploadedBy?.id === currentUser.id;

            return (
              <li
                key={attachment.id}
                className="group/file flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
              >
                <Icon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />

                <a
                  href={`/api/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {attachment.filename}
                </a>

                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatBytes(attachment.size)}
                </span>

                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${attachment.filename}`}
                    onClick={() => remove.mutate(attachment.id)}
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Private to this workspace. Up to{" "}
          {Math.round(LIMITS.attachmentBytes / 1024 / 1024)} MB each.
        </p>
      )}
    </section>
  );
}
