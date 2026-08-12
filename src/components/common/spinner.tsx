import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The one spinner.
 *
 * Every in-flight control in the app shows this, at the size of the icon it
 * replaces, so "something is happening" always looks the same wherever it
 * happens. Sized `size-3.5` to match the icons in the drawer's section headers;
 * pass a class for the few places that need a different one.
 *
 * Decorative by default — it is always accompanied by a label or by a control
 * that is visibly disabled, and a second announcement of "loading" is noise to
 * a screen reader. Callers that show it alone should set `aria-label` on the
 * region and `aria-busy` on the control.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2Icon
      className={cn("size-3.5 shrink-0 animate-spin", className)}
      aria-hidden="true"
    />
  );
}
