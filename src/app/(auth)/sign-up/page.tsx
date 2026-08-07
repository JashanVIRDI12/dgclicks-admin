import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sanitizeCallbackUrl } from "@/features/auth/callback-url";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignUpPage({
  searchParams,
}: PageProps<"/sign-up">) {
  const callbackUrl = sanitizeCallbackUrl((await searchParams).callbackUrl);

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Get set up with access to your team&apos;s workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <SignUpForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
