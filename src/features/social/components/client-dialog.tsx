"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { SubmitButton } from "@/components/common/submit-button";
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClientAction } from "@/features/social/actions/social.actions";
import { SOCIAL_LIMITS } from "@/features/social/constants";
import { LABEL_COLORS, type LabelColor } from "@/features/tasks/constants";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the client a name.")
    .max(SOCIAL_LIMITS.clientName),
  handle: z.string().trim().max(SOCIAL_LIMITS.clientHandle),
  color: z.enum(LABEL_COLORS),
});

type FormValues = z.output<typeof formSchema>;

/**
 * Adding a company whose social media this workspace runs.
 *
 * The colour is the point of this dialog as much as the name: on a month where
 * four clients share a Tuesday, colour is what separates them at a glance, and
 * choosing it once here beats picking it on every post.
 */
export function ClientDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", handle: "", color: "blue" },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: FormValues) {
    const result = await createClientAction({
      workspaceId,
      name: values.name,
      handle: values.handle || null,
      color: values.color,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    form.reset();
    onOpenChange(false);
    toast.success(`${values.name} added.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a client</DialogTitle>
          <DialogDescription>
            A company whose social media you run. Every post on this calendar
            belongs to one.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="client-name">Name</FieldLabel>
              <Input
                id="client-name"
                autoFocus
                placeholder="Acme Coffee"
                maxLength={SOCIAL_LIMITS.clientName}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="client-handle">Handle</FieldLabel>
              <Input
                id="client-handle"
                placeholder="acmecoffee"
                maxLength={SOCIAL_LIMITS.clientHandle}
                {...form.register("handle")}
              />
              <FieldDescription>
                Optional. The @ is added for you.
              </FieldDescription>
              <FieldError errors={[errors.handle]} />
            </Field>

            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="client-color">Colour</FieldLabel>
                  <div
                    id="client-color"
                    role="radiogroup"
                    aria-label="Client colour"
                    className="flex flex-wrap gap-1.5"
                  >
                    {LABEL_COLORS.map((color: LabelColor) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={field.value === color}
                        aria-label={color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "size-7 rounded-full transition-transform hover:scale-110",
                          field.value === color &&
                            "ring-2 ring-ring ring-offset-2 ring-offset-background",
                        )}
                        style={{ background: `var(--label-${color})` }}
                      />
                    ))}
                  </div>
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isPending={form.formState.isSubmitting}>
              Add client
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
