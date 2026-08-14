import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sanitizeCallbackUrl } from "@/features/auth/callback-url";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { STALE_SESSION_PARAM } from "@/features/auth/server/session";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  // `searchParams` is a promise in Next 16.
  const query = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(query.callbackUrl);
  const passwordWasReset = query.reset === "success";
  // Set by `requireSession()` when a cookie was present but the session behind
  // it could not be validated. Saying so beats bouncing someone back to a blank
  // form with no explanation for why they were signed out.
  const sessionExpired = query[STALE_SESSION_PARAM] !== undefined;

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access your workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {passwordWasReset ? (
            <Alert>
              <AlertDescription>
                Your password has been reset. Sign in with the new one.
              </AlertDescription>
            </Alert>
          ) : null}

          {sessionExpired && !passwordWasReset ? (
            <Alert>
              <AlertDescription>
                Your session has ended. Please sign in again.
              </AlertDescription>
            </Alert>
          ) : null}
          <SignInForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
