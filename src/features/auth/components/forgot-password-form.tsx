"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SubmitButton } from "@/components/common/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordResetAction } from "@/features/auth/actions/auth.actions";
import {
  requestPasswordResetSchema,
  type RequestPasswordResetInput,
} from "@/features/auth/schemas/auth.schema";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = ["email"] as const;

export function ForgotPasswordForm({
  emailEnabled,
}: {
  emailEnabled: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: RequestPasswordResetInput) {
    const result = await requestPasswordResetAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);
      if (message) toast.error(message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            If an account exists for that address, a one-hour reset link is on
            its way.
          </AlertDescription>
        </Alert>
        <Link
          href="/sign-in"
          className="block text-center text-sm font-medium underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {!emailEnabled ? (
          <Alert variant="destructive">
            <AlertTitle>Email delivery is not configured</AlertTitle>
            <AlertDescription>
              Add the Resend environment variables before requesting a reset.
            </AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <SubmitButton
          isPending={form.formState.isSubmitting}
          pendingLabel="Sending…"
          disabled={!emailEnabled || form.formState.isSubmitting}
          className="w-full"
        >
          Send reset link
        </SubmitButton>
      </FieldGroup>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
