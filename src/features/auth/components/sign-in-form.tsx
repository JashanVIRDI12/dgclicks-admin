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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DEFAULT_CALLBACK_URL } from "@/features/auth/callback-url";
import { signInAction } from "@/features/auth/actions/auth.actions";
import {
  signInSchema,
  type SignInInput,
} from "@/features/auth/schemas/auth.schema";
import { applyActionErrors } from "@/lib/forms";

const FIELDS = ["email", "password"] as const;

export function SignInForm({ callbackUrl }: { callbackUrl: Route }) {
  const router = useRouter();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: SignInInput) {
    const result = await signInAction(values);

    if (!result.ok) {
      const message = applyActionErrors(result, form.setError, FIELDS);

      if (message) {
        toast.error(message);
      }

      return;
    }

    // The action set the session cookie; `refresh` discards the router cache
    // holding the signed-out version of the destination.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[form.formState.errors.email]} />
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          <FieldError errors={[form.formState.errors.password]} />
        </Field>

        <SubmitButton
          isPending={isSubmitting}
          pendingLabel="Signing in…"
          className="w-full"
        >
          Sign in
        </SubmitButton>
      </FieldGroup>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        {/*
          Carries the callback across.
          Someone opening an invite link without an account arrives here, and a
          bare `/sign-up` would drop the invite: they would create the account,
          land on the dashboard, and never join the workspace they were sent to.
        */}
        <Link
          href={
            callbackUrl === DEFAULT_CALLBACK_URL
              ? "/sign-up"
              : `/sign-up?callbackUrl=${encodeURIComponent(callbackUrl)}`
          }
          className="font-medium text-foreground underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
