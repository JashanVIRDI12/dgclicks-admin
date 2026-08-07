import { TriangleAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : null;
  const hasError = typeof query.error === "string";
  const isValidLink = Boolean(token && !hasError);

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle>
            {isValidLink ? "Choose a new password" : "Reset link unavailable"}
          </CardTitle>
          <CardDescription>
            {isValidLink
              ? "Your new password will replace the old one immediately."
              : "This password reset link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isValidLink && token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-5">
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Request a new link</AlertTitle>
                <AlertDescription>
                  Reset links expire after one hour and can only be used once.
                </AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/forgot-password">Request another link</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
