import { cn } from "@/lib/utils";

/** Minimal primary-colour spinner adapted from the linked 21st.dev loader. */
export function ModifiedClassicLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "size-10 animate-spin rounded-full border-y-2 border-primary ease-linear",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
