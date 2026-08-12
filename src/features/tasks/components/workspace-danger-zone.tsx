"use client";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { Input } from "@/components/ui/input";
import { deleteWorkspaceAction } from "@/features/tasks/actions/workspace.actions";

export function WorkspaceDangerZone({
  workspace,
}: {
  workspace: { id: string; name: string };
}) {
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteWorkspaceAction({
        id: workspace.id,
        confirmation,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(`${workspace.name} deleted.`);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <section className="card-surface border-destructive/25 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Delete workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently remove this workspace and everything inside it.
          </p>
        </div>

        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setConfirmation("");
            setOpen(true);
          }}
        >
          <Trash2Icon className="size-4" aria-hidden="true" />
          Delete workspace
        </Button>
      </div>

      <AlertDialog
        open={isOpen}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            setConfirmation("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {workspace.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every board, task, comment, file, checklist, and time
              entry in the workspace. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type{" "}
              <span className="font-medium text-foreground">
                {workspace.name}
              </span>{" "}
              to confirm.
            </p>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-label={`Type ${workspace.name} to confirm deletion`}
              autoComplete="off"
              autoFocus
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <HoldToConfirm
              disabled={isPending || confirmation.trim() !== workspace.name}
              onConfirm={remove}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              {isPending ? "Deleting…" : "Hold to delete workspace"}
            </HoldToConfirm>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
