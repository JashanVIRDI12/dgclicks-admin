"use client";

/**
 * A timestamp in the reader's timezone.
 *
 * `toLocaleString()` formats using the timezone of whatever machine runs it. In
 * a server component that is the server — UTC on Vercel — so an action taken at
 * 9:33pm in Delhi rendered as 4:03pm, and every date in the activity feed was
 * quietly wrong for everyone outside the deployment region.
 *
 * A client component fixes it, at the cost of a hydration mismatch: the server
 * pass still formats in UTC, then the browser re-formats locally.
 * `suppressHydrationWarning` is the sanctioned answer for exactly this — it is
 * what `next-themes` uses for the same class of problem — and it only silences
 * the text of this one element, not its children or its attributes.
 *
 * The machine-readable value in `dateTime` stays the raw ISO string, so
 * assistive technology and anything scraping the page get the unambiguous
 * instant rather than a localised rendering of it.
 */
export function LocalTime({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  );
}
