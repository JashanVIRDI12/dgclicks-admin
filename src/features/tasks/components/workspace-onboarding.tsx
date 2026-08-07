"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LayersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FadeIn } from "@/components/common/fade-in";
import { SubmitButton } from "@/components/common/submit-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createWorkspaceAction } from "@/features/tasks/actions/workspace.actions";
import {
  workspaceFormSchema,
  type WorkspaceFormValues,
} from "@/features/tasks/schemas/workspace.schema";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = ["name"] as const;

/**
 * First run: nothing exists yet, so the only useful screen is the one that
 * creates the first thing.
 *
 * An inline form rather than a button that opens a dialog — on a page with
 * nothing else on it, a dialog is a click that buys nothing.
 */
export function WorkspaceOnboarding({ suggestedName }: { suggestedName: string }) {
  const router = useRouter();

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { name: suggestedName },
  });

  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: WorkspaceFormValues) {
    const result = await createWorkspaceAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);

      if (message) {
        toast.error(message);
      }

      return;
    }

    toast.success(`${result.data.name} is ready.`);
    router.refresh();
  }

  return (
    <FadeIn className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <div
        className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift"
        aria-hidden="true"
      >
        <LayersIcon className="size-5" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Create your workspace
      </h1>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        A workspace holds your boards and the people you work with. You can add
        more later — one per company or client is a good starting point.
      </p>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="mt-8 w-full space-y-4 text-left"
      >
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="onboarding-workspace">Workspace name</FieldLabel>
          <Input
            id="onboarding-workspace"
            autoFocus
            placeholder="DG Clicks"
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <SubmitButton
          isPending={isSubmitting}
          pendingLabel="Creating…"
          className="w-full"
        >
          Create workspace
        </SubmitButton>
      </form>
    </FadeIn>
  );
}
