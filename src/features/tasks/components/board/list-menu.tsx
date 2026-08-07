"use client";

import { CheckIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  deleteListAction,
  updateListAction,
} from "@/features/tasks/actions/board.actions";
import type { List } from "@/features/tasks/types";

/**
 * Column settings.
 *
 * Renaming and the "counts as done" switch live together because they are the
 * only two things a column has — and the switch is the one that decides whether
 * dropping a card here completes it.
 */
export function ListMenu({
  list,
  canDelete,
}: {
  list: List;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setEditOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(list.name);
  const [isTerminal, setTerminal] = useState(list.isTerminal);

  function save() {
    const trimmed = name.trim();

    if (!trimmed) {
      toast.error("Give the column a name.");
      return;
    }

    startTransition(async () => {
      const result = await updateListAction({
        id: list.id,
        name: trimmed,
        isTerminal,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setEditOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteListAction({ id: list.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setDeleteOpen(false);
      toast.success(`${list.name} deleted.`);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${list.name} options`}
            className="size-6 text-muted-foreground"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setName(list.name);
              setTerminal(list.isTerminal);
              setEditOpen(true);
            }}
          >
            <PencilIcon className="size-4" aria-hidden="true" />
            Rename
          </DropdownMenuItem>

          {canDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Delete column
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Column settings</DialogTitle>
            <DialogDescription>
              Rename the column, or make it the one that means finished.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <Field>
              <FieldLabel htmlFor="list-name">Name</FieldLabel>
              <Input
                id="list-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    save();
                  }
                }}
              />
            </Field>

            <Field orientation="horizontal">
              <Switch
                id="list-terminal"
                checked={isTerminal}
                onCheckedChange={setTerminal}
              />
              <div className="space-y-0.5">
                <FieldLabel htmlFor="list-terminal">Counts as done</FieldLabel>
                <FieldDescription>
                  Dropping a card here completes it and creates the next
                  occurrence of anything that repeats.
                </FieldDescription>
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {list.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The column has to be empty first. Any cards still in it need
              moving somewhere else — nothing is deleted with the column.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={isPending}>
              <CheckIcon className="size-4" aria-hidden="true" />
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
