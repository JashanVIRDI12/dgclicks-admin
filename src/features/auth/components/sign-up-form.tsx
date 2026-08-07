"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { DEFAULT_CALLBACK_URL } from "@/features/auth/callback-url";
import { signUpAction } from "@/features/auth/actions/auth.actions";
import {
  signUpSchema,
  type SignUpInput,
} from "@/features/auth/schemas/auth.schema";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = ["name", "email", "password"] as const;

export function SignUpForm({ callbackUrl }: { callbackUrl: Route }) {
  const router = useRouter();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SignUpInput) {
    const result = await signUpAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);

      if (message) {
        toast.error(message);
      }

      return;
    }

    // `autoSignIn` is on, so a successful sign-up already carries a session.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            placeholder="Jane Cooper"
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register("password")}
          />
          {errors.password ? (
            <FieldError errors={[errors.password]} />
          ) : (
            <FieldDescription>At least 8 characters.</FieldDescription>
          )}
        </Field>

        <SubmitButton
          isPending={isSubmitting}
          pendingLabel="Creating account…"
          className="w-full"
        >
          Create account
        </SubmitButton>
      </FieldGroup>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        {/* Preserved for the same reason as the link back the other way. */}
        <Link
          href={
            callbackUrl === DEFAULT_CALLBACK_URL
              ? "/sign-in"
              : `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
          }
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
