"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PasswordInput } from "@/components/common/password-input";
import { SubmitButton } from "@/components/common/submit-button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { changePasswordAction } from "@/features/auth/actions/auth.actions";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/features/auth/schemas/auth.schema";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = [
  "currentPassword",
  "newPassword",
  "confirmPassword",
] as const;

const DEFAULTS: ChangePasswordInput = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: DEFAULTS,
  });

  async function onSubmit(values: ChangePasswordInput) {
    const result = await changePasswordAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);
      if (message) toast.error(message);
      return;
    }

    form.reset(DEFAULTS);
    toast.success("Password changed. Other sessions were signed out.");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.currentPassword)}>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            autoFocus
            aria-invalid={Boolean(form.formState.errors.currentPassword)}
            {...form.register("currentPassword")}
          />
          <FieldError errors={[form.formState.errors.currentPassword]} />
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.newPassword)}>
          <FieldLabel htmlFor="security-new-password">New password</FieldLabel>
          <PasswordInput
            id="security-new-password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.newPassword)}
            {...form.register("newPassword")}
          />
          <FieldDescription>Use at least 8 characters.</FieldDescription>
          <FieldError errors={[form.formState.errors.newPassword]} />
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.confirmPassword)}>
          <FieldLabel htmlFor="security-confirm-password">
            Confirm new password
          </FieldLabel>
          <PasswordInput
            id="security-confirm-password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            {...form.register("confirmPassword")}
          />
          <FieldError errors={[form.formState.errors.confirmPassword]} />
        </Field>

        <SubmitButton
          isPending={form.formState.isSubmitting}
          pendingLabel="Changing…"
          className="w-fit"
        >
          Change password
        </SubmitButton>
      </FieldGroup>
    </form>
  );
}
