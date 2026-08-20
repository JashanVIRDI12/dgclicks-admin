"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format as formatDate, parseISO } from "date-fns";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { SubmitButton } from "@/components/common/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import type { UserSummary } from "@/features/auth/types";
import {
  createPostAction,
  deletePostAction,
  updatePostAction,
} from "@/features/social/actions/social.actions";
import {
  CONTENT_FORMATS,
  CONTENT_FORMAT_LABELS,
  POST_STAGES,
  POST_STAGE_LABELS,
  SOCIAL_LIMITS,
} from "@/features/social/constants";
import { FormatIcon } from "@/features/social/components/format-icon";
import {
  postFormSchema,
  type PostFormValues,
} from "@/features/social/schemas/social.schema";
import type { SocialClient, SocialPost } from "@/features/social/types";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";

const UNASSIGNED = "__unassigned__";

/** True for something a browser will actually open. Anything else is a note. */
function isLink(reference: string): boolean {
  return /^https?:\/\//i.test(reference);
}

/**
 * Writing or editing one post.
 *
 * The whole post is one form with one save. This is not the task drawer and
 * deliberately does not autosave field by field: a post is composed — heading,
 * caption, format, reference all decided together — and saving a half-written
 * caption on blur would fill the calendar with drafts nobody meant to publish
 * to their colleagues.
 */
export function PostDialog({
  workspaceId,
  clients,
  members,
  post,
  defaultDate,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  clients: SocialClient[];
  members: UserSummary[];
  /** Null opens an empty form for `defaultDate`. */
  post: SocialPost | null;
  defaultDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    // Keyed on the post below, so this runs fresh for every card opened rather
    // than needing an effect to push new values into a living form.
    defaultValues: post
      ? {
          clientId: post.clientId,
          scheduledFor: post.scheduledFor,
          heading: post.heading,
          caption: post.caption,
          format: post.format,
          reference: post.reference ?? "",
          stage: post.stage,
          assigneeId: post.assignee?.id ?? null,
        }
      : {
          clientId: clients[0]?.id ?? "",
          scheduledFor: defaultDate,
          heading: "",
          caption: "",
          format: "post",
          reference: "",
          stage: "planned",
          assigneeId: null,
        },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: PostFormValues) {
    const result = post
      ? await updatePostAction({
          id: post.id,
          ...values,
          reference: values.reference || null,
        })
      : await createPostAction({
          workspaceId,
          ...values,
          reference: values.reference || null,
        });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onOpenChange(false);
    toast.success(post ? "Post updated." : "Post added to the calendar.");
    router.refresh();
  }

  async function remove() {
    if (!post) return;

    const result = await deletePostAction({ id: post.id });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onOpenChange(false);
    toast.success("Post deleted.");
    router.refresh();
  }

  const reference = post?.reference;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            {formatDate(parseISO(defaultDate), "EEEE d MMMM yyyy")}
            {post?.readyAt && post.readyBy
              ? ` · artwork made by ${post.readyBy.name}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="post-heading">Heading</FieldLabel>
              <Input
                id="post-heading"
                autoFocus
                placeholder="Diwali offer — carousel one"
                maxLength={SOCIAL_LIMITS.heading}
                {...form.register("heading")}
              />
              <FieldError errors={[errors.heading]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="post-client">Client</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="post-client" className="w-full">
                        <SelectValue placeholder="Choose a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <span
                              className="size-2 rounded-full"
                              style={{
                                background: `var(--label-${client.color})`,
                              }}
                            />
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[errors.clientId]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="format"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="post-format">Type of content</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="post-format" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_FORMATS.map((value) => (
                          <SelectItem key={value} value={value}>
                            <FormatIcon format={value} />
                            {CONTENT_FORMAT_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="post-caption">Content</FieldLabel>
              <Textarea
                id="post-caption"
                rows={4}
                placeholder="The caption, the copy, anything the designer needs to know."
                {...form.register("caption")}
              />
              <FieldError errors={[errors.caption]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="post-reference">Reference</FieldLabel>
              <Input
                id="post-reference"
                placeholder="A link to imitate, or a note"
                maxLength={SOCIAL_LIMITS.reference}
                {...form.register("reference")}
              />
              <FieldDescription>
                Optional. Paste a link to a post you want this to look like, or
                just describe it.
              </FieldDescription>
              {reference && isLink(reference) ? (
                <a
                  href={reference}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <ExternalLinkIcon className="size-3" aria-hidden="true" />
                  Open the saved reference
                </a>
              ) : null}
              <FieldError errors={[errors.reference]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="scheduledFor"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="post-date">Date</FieldLabel>
                    <Input
                      id="post-date"
                      type="date"
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                    <FieldError errors={[errors.scheduledFor]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="post-designer">Designer</FieldLabel>
                    <Select
                      value={field.value ?? UNASSIGNED}
                      onValueChange={(value) =>
                        field.onChange(value === UNASSIGNED ? null : value)
                      }
                    >
                      <SelectTrigger id="post-designer" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Nobody yet</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <AssigneeAvatar user={member} className="size-5" />
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="stage"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="post-stage">Stage</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="post-stage" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_STAGES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {POST_STAGE_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Move it to Ready to post when the designer has made the
                    artwork. Who did and when is recorded on the post.
                  </FieldDescription>
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="sm:justify-between">
            {post ? (
              <Button
                type="button"
                variant="ghost"
                onClick={remove}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2Icon className="size-3.5" aria-hidden="true" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <SubmitButton isPending={form.formState.isSubmitting}>
                {post ? "Save" : "Add post"}
              </SubmitButton>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
