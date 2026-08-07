"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createInviteAction } from "@/features/tasks/actions/invite.actions";

/**
 * One-click invite, for the places that are not Settings.
 *
 * Copies the workspace's newest live link when there is one and only mints a
 * link when there is not, so pressing it three times hands out one link rather
 * than three. Settings remains the place to see every link, set a different
 * expiry, or revoke one — this is the shortcut, not a second manager.
 */
export function InviteLinkButton({
  workspaceId,
  existingUrl,
  variant = "outline",
  size = "sm",
  className,
}: {
  workspaceId: string;
  existingUrl: string | null;
  variant?: "default" | "outline";
  size?: "sm" | "default";
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [copiedUrl, setCopiedUrl] = useState(existingUrl);

  function share() {
    startTransition(async () => {
      let url = copiedUrl;

      if (!url) {
        const result = await createInviteAction({
          workspaceId,
          expiresIn: "7",
        });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        url = result.data.url;
        setCopiedUrl(url);
      }

      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied. Send it to whoever should join.");
      } catch {
        toast.error("Could not copy. Open Settings to copy the link manually.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={share}
      disabled={isPending}
      className={className}
    >
      <UserPlusIcon className="size-4" aria-hidden="true" />
      {isPending ? "Working…" : "Invite people"}
    </Button>
  );
}
