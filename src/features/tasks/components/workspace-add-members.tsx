"use client";

import { SearchIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { UserSummary } from "@/features/auth/types";
import {
  addWorkspaceMembersAction,
  listWorkspaceCandidatesAction,
} from "@/features/tasks/actions/workspace.actions";
import { AssigneeAvatar } from "@/features/tasks/components/task-meta";
import type { Workspace } from "@/features/tasks/types";

/**
 * Adds people who already have an account.
 *
 * An invite link is for someone who has never signed in. Everyone else already
 * exists, and sending them a URL so the app can tell them they are already
 * registered is the long way round — this brings them straight in.
 *
 * The candidates load when the button is pressed rather than in an effect, so
 * there is one request per opening instead of one per render, and the dialog is
 * already open while it is in flight.
 */
export function WorkspaceAddMembers({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isOpen, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<UserSummary[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [term, setTerm] = useState("");

  function open() {
    setOpen(true);
    setCandidates(null);
    setSelected([]);
    setTerm("");

    startLoading(async () => {
      const result = await listWorkspaceCandidatesAction({ id: workspace.id });

      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }

      setCandidates(result.data);
    });
  }

  function toggle(userId: string) {
    setSelected((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function save() {
    startSaving(async () => {
      const result = await addWorkspaceMembersAction({
        id: workspace.id,
        memberIds: selected,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOpen(false);
      toast.success(
        selected.length === 1
          ? "Added them to the workspace."
          : `Added ${selected.length} people to the workspace.`,
      );
      router.refresh();
    });
  }

  // Filtered here rather than on the server: the whole list arrives in one
  // request, and matching locally is what makes typing a name feel instant.
  const query = term.trim().toLowerCase();
  const matches = (candidates ?? []).filter(
    (user) =>
      query === "" ||
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query),
  );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-muted-foreground"
        onClick={open}
      >
        <UserPlusIcon className="size-3.5" aria-hidden="true" />
        Add people
      </Button>

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add people to {workspace.name}</DialogTitle>
            <DialogDescription>
              Anyone who has already signed in can be added straight away. For
              someone without an account yet, share an invite link instead.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search people"
              className="pl-8"
            />
          </div>

          <div className="scrollbar-subtle max-h-72 space-y-1 overflow-y-auto rounded-xl bg-surface p-1.5">
            {isLoading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Loading people…
              </p>
            ) : matches.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {candidates?.length === 0
                  ? "Everyone with an account is already in this workspace."
                  : "Nobody matches that."}
              </p>
            ) : (
              matches.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60"
                >
                  <Checkbox
                    checked={selected.includes(user.id)}
                    onCheckedChange={() => toggle(user.id)}
                  />
                  <AssigneeAvatar user={user} className="size-6" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={isSaving || selected.length === 0}
            >
              {selected.length === 0
                ? "Add"
                : selected.length === 1
                  ? "Add 1 person"
                  : `Add ${selected.length} people`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
