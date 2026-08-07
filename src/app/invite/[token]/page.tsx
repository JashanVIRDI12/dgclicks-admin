import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FadeIn } from "@/components/common/fade-in";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/features/auth/server/session";
import { AcceptInviteButton } from "@/features/tasks/components/accept-invite-button";
import { previewInvite } from "@/features/tasks/server/invite.service";

export const metadata: Metadata = {
  title: "Join workspace",
};

/**
 * Where an invite link lands.
 *
 * Outside the `(app)` group deliberately: the reader may not be a member of any
 * workspace yet, and rendering the sidebar and board list around a page whose
 * whole purpose is to grant that membership shows them an empty shell of an app
 * they cannot use. `src/proxy.ts` still guards the route — a signed-out visitor
 * is redirected to sign-in carrying `?callbackUrl=/invite/<token>`, and returns
 * here once they have an account.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const session = await requireSession();
  const { token } = await params;
  const invite = await previewInvite(token, session.user.id);

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <FadeIn className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UsersIcon className="size-5" aria-hidden="true" />
            </div>

            {!invite ? (
              <>
                <CardTitle>This link doesn&apos;t work</CardTitle>
                <CardDescription>
                  It may have expired or been revoked. Ask whoever sent it for a
                  new one.
                </CardDescription>
              </>
            ) : invite.isAlreadyMember ? (
              <>
                <CardTitle>You&apos;re already in</CardTitle>
                <CardDescription>
                  Your account is already a member of {invite.workspaceName}.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>Join {invite.workspaceName}</CardTitle>
                <CardDescription>
                  You&apos;ll get access to this workspace and its shared
                  boards. You can be added to private boards separately.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {invite && !invite.isAlreadyMember ? (
              <AcceptInviteButton token={token} />
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </main>
  );
}
