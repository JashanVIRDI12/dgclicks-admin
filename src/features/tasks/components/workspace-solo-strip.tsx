import { UsersIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { InviteLinkButton } from "@/features/tasks/components/invite-link-button";

/**
 * Shown while a workspace has exactly one member.
 *
 * A one-person workspace looks identical to a team workspace nobody has posted
 * in yet, and the invite control lives two screens away in Settings — so the
 * state that most needs a prompt is the one that gives none. It disappears the
 * moment a second person joins, which is why it is a strip rather than a card:
 * it is temporary furniture, not part of the page.
 */
export function WorkspaceSoloStrip({
  workspaceName,
  workspaceId,
  existingInviteUrl,
  canInvite,
}: {
  workspaceName: string;
  workspaceId: string;
  existingInviteUrl: string | null;
  canInvite: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5">
      <UsersIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />

      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        You&apos;re the only one in {workspaceName}.{" "}
        {canInvite
          ? "Share an invite link to bring your team in."
          : "An administrator can invite the rest of your team."}
      </p>

      {canInvite ? (
        <div className="flex items-center gap-2">
          <InviteLinkButton
            workspaceId={workspaceId}
            existingUrl={existingInviteUrl}
          />
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">Manage</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
