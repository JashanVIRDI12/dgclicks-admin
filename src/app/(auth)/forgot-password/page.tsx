import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a secure reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm emailEnabled={env.isEmailEnabled} />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
