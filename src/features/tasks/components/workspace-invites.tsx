"use client";

import { format } from "date-fns";
import { CheckIcon, CopyIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInviteAction,
  revokeInviteAction,
} from "@/features/tasks/actions/invite.actions";
import {
  INVITE_DURATION_LABELS,
  INVITE_DURATIONS,
  type InviteDuration,
} from "@/features/tasks/schemas/invite.schema";
import type { WorkspaceInvite } from "@/features/tasks/types";

/**
 * Invite links for the active workspace.
 *
 * The link is the credential, so it is shown in full and copied rather than
 * emailed from here: an agency sends these over WhatsApp as often as email, and
 * a flow that can only send mail would be worked around by pasting the URL out
 * of the address bar anyway.
 */
export function WorkspaceInvites({
  workspaceId,
  invites,
}: {
  workspaceId: string;
  invites: WorkspaceInvite[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expiresIn, setExpiresIn] = useState<InviteDuration>("7");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function create() {
    startTransition(async () => {
      const result = await createInviteAction({ workspaceId, expiresIn });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      await copy(result.data.id, result.data.url);
      toast.success("Invite link created and copied.");
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeInviteAction({ id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Invite link revoked.");
      router.refresh();
    });
  }

  async function copy(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <section className="card-surface p-4">
      <h2 className="mb-1 text-sm font-medium">Invite people</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Share a link and whoever opens it can create an account and join this
        workspace. They start with access to boards set to{" "}
        <span className="font-medium">All members</span> only.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={expiresIn}
          onValueChange={(value) => setExpiresIn(value as InviteDuration)}
        >
          <SelectTrigger className="w-40" aria-label="Link expiry">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_DURATIONS.map((duration) => (
              <SelectItem key={duration} value={duration}>
                {INVITE_DURATION_LABELS[duration]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={create} disabled={isPending}>
          <LinkIcon className="size-4" aria-hidden="true" />
          {isPending ? "Working…" : "Create invite link"}
        </Button>
      </div>

      {invites.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center gap-2 rounded-xl bg-surface p-2.5"
            >
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {invite.url}
              </code>

              <span className="text-[0.6875rem] text-muted-foreground">
                {invite.expiresAt
                  ? `Expires ${format(new Date(invite.expiresAt), "d MMM yyyy")}`
                  : "No expiry"}
                {invite.useCount > 0
                  ? ` · used ${invite.useCount}×`
                  : " · unused"}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => void copy(invite.id, invite.url)}
                aria-label="Copy invite link"
              >
                {copiedId === invite.id ? (
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <CopyIcon className="size-3.5" aria-hidden="true" />
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={isPending}
                onClick={() => revoke(invite.id)}
                aria-label="Revoke invite link"
              >
                <Trash2Icon className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          No active links. Anyone you invited earlier can still sign in.
        </p>
      )}
    </section>
  );
}
