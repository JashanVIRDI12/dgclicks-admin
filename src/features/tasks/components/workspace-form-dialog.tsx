"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SubmitButton } from "@/components/common/submit-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createWorkspaceAction,
  updateWorkspaceAction,
} from "@/features/tasks/actions/workspace.actions";
import {
  workspaceFormSchema,
  type WorkspaceFormValues,
} from "@/features/tasks/schemas/workspace.schema";
import type { Workspace } from "@/features/tasks/types";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = ["name"] as const;

/**
 * Controlled from outside so the switcher's dropdown can close before this
 * opens — nesting a dialog inside an open menu leaves two focus traps fighting.
 */
export function WorkspaceFormDialog({
  open,
  onOpenChange,
  workspace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when renaming; absent creates a new workspace. */
  workspace?: Workspace;
}) {
  const router = useRouter();
  const isEditing = Boolean(workspace);

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { name: workspace?.name ?? "" },
  });

  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: WorkspaceFormValues) {
    const result = workspace
      ? await updateWorkspaceAction({ ...values, id: workspace.id })
      : await createWorkspaceAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);

      if (message) {
        toast.error(message);
      }

      return;
    }

    onOpenChange(false);
    form.reset({ name: isEditing ? result.data.name : "" });
    toast.success(isEditing ? "Workspace renamed." : `${result.data.name} created.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Rename workspace" : "New workspace"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Everyone in this workspace will see the new name."
              : "A workspace holds a set of boards and the people who work on them."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
              <Input
                id="workspace-name"
                autoFocus
                placeholder="DG Clicks"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            <SubmitButton
              isPending={isSubmitting}
              pendingLabel={isEditing ? "Saving…" : "Creating…"}
            >
              {isEditing ? "Save changes" : "Create workspace"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
