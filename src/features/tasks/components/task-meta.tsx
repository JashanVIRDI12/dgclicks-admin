import {
  CalendarClockIcon,
  CircleDashedIcon,
  CircleDotIcon,
  ClapperboardIcon,
  GalleryHorizontalEndIcon,
  ImageIcon,
  PaletteIcon,
  Repeat2Icon,
  SignalHighIcon,
  SignalIcon,
  SignalLowIcon,
  SignalMediumIcon,
  TypeIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserSummary } from "@/features/auth/types";
import type { MediaType, TaskPriority } from "@/features/tasks/constants";
import { cn } from "@/lib/utils";

/**
 * Priority as a signal-strength ramp rather than four unrelated glyphs.
 *
 * The shape carries the ordering on its own, so the colour is reinforcement
 * rather than the only channel — which is what keeps it readable for someone
 * who cannot distinguish amber from red.
 */
const PRIORITY_ICONS: Record<TaskPriority, LucideIcon> = {
  none: SignalIcon,
  low: SignalLowIcon,
  medium: SignalMediumIcon,
  high: SignalHighIcon,
  urgent: SignalHighIcon,
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const Icon = PRIORITY_ICONS[priority];

  if (priority === "none") {
    return (
      <Icon
        className={cn("size-3.5 text-muted-foreground/50", className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <Icon
      className={cn("size-3.5", className)}
      style={
        { color: `var(--priority-${priority})` } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

/**
 * The kind of content a card represents.
 *
 * Deliberately a glyph and never a bare colour: on a calendar packed with a
 * month of posts, the shape is what lets someone find every reel at a glance,
 * and the label is still there in the drawer and in the tooltip.
 */
const MEDIA_TYPE_ICONS: Record<MediaType, LucideIcon> = {
  none: CircleDashedIcon,
  photo: ImageIcon,
  video: VideoIcon,
  reel: ClapperboardIcon,
  story: CircleDotIcon,
  carousel: GalleryHorizontalEndIcon,
  gif: Repeat2Icon,
  graphic: PaletteIcon,
  copy: TypeIcon,
};

export function MediaTypeIcon({
  mediaType,
  className,
}: {
  mediaType: MediaType;
  className?: string;
}) {
  const Icon = MEDIA_TYPE_ICONS[mediaType];

  return (
    <Icon
      className={cn(
        "size-3.5",
        mediaType === "none" && "text-muted-foreground/50",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

export function AssigneeAvatar({
  user,
  className,
}: {
  user: UserSummary | null;
  className?: string;
}) {
  if (!user) {
    return null;
  }

  return (
    <Avatar className={cn("size-5", className)} title={user.name}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className="text-[0.5625rem]">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-to-midnight difference, so "tomorrow" does not depend on the hour. */
export function daysUntil(iso: string, now = new Date()): number {
  const due = new Date(iso);
  const dueMidnight = Date.UTC(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  );
  const nowMidnight = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return Math.round((dueMidnight - nowMidnight) / DAY_MS);
}

/**
 * A due date said the way someone would say it.
 *
 * "Tomorrow" is more useful than a date on a card you are scanning, and the
 * absolute date is still one hover away in the `title`.
 */
function formatDueDate(iso: string, now = new Date()): string {
  const days = daysUntil(iso, now);

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "Tomorrow";
  }

  if (days === -1) {
    return "Yesterday";
  }

  if (days > 1 && days < 7) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "long" });
  }

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(days > 300 || days < -300 ? { year: "numeric" } : {}),
  });
}

export function DueDateBadge({
  dueDate,
  isComplete,
  className,
}: {
  dueDate: string;
  isComplete: boolean;
  className?: string;
}) {
  const days = daysUntil(dueDate);
  // A finished task's deadline is history, not a warning — colouring it red for
  // ever would leave a Done column permanently on fire.
  const tone = isComplete
    ? "muted"
    : days < 0
      ? "overdue"
      : days === 0
        ? "today"
        : "upcoming";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] leading-4 font-medium",
        tone === "overdue" && "chip-tinted",
        tone === "today" && "chip-tinted",
        (tone === "muted" || tone === "upcoming") && "text-muted-foreground",
        className,
      )}
      style={
        tone === "overdue"
          ? ({ "--chip-color": "var(--priority-urgent)" } as CSSProperties)
          : tone === "today"
            ? ({ "--chip-color": "var(--priority-medium)" } as CSSProperties)
            : undefined
      }
      title={new Date(dueDate).toLocaleDateString(undefined, {
        dateStyle: "full",
      })}
    >
      <CalendarClockIcon className="size-3" aria-hidden="true" />
      {formatDueDate(dueDate)}
    </span>
  );
}

/** Minutes as the shortest thing a person would read: `2h 15m`, `45m`, `3h`. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
