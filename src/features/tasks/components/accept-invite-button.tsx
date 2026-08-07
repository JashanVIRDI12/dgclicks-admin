"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/features/tasks/actions/invite.actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptInviteAction({ token });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`You joined ${result.data.workspaceName}.`);
      // A push rather than a replace: the invite page has nothing to return to,
      // and the workspace this lands in is the one just joined.
      router.push("/dashboard" satisfies Route);
    });
  }

  return (
    <Button onClick={accept} disabled={isPending} className="w-full">
      {isPending ? "Joining…" : "Join workspace"}
    </Button>
  );
}
