import { HistoryIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ACTIVITY_ENTITY_LABELS,
  type ActivityAction,
} from "@/features/activity/constants";
import type { ActivityEntry } from "@/features/activity/types";
import { DrawerSection } from "@/features/tasks/components/drawer/section";
import { initials } from "@/features/tasks/components/task-meta";

/**
 * This task's history, inside the panel.
 *
 * A compact variant of the workspace feed rather than a reuse of it: nothing
 * here needs to link anywhere, because everything it describes is the card
 * already on screen. Stripping the links is most of the difference.
 */
const ACTION_VERBS: Record<ActivityAction, string> = {
  created: "created this",
  updated: "updated",
  completed: "completed this",
  reopened: "reopened this",
  moved: "moved this",
  archived: "archived this",
  restored: "restored this",
  deleted: "deleted",
};

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  priority: "priority",
  assignees: "assignees",
  dueDate: "due date",
  startDate: "start date",
  estimateMinutes: "estimate",
  recurrence: "repeat",
};

function relativeTime(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function describe(entry: ActivityEntry): string {
  if (entry.entityType === "comment" || entry.entityType === "attachment") {
    return `${ACTION_VERBS[entry.action]} ${ACTIVITY_ENTITY_LABELS[entry.entityType]}`;
  }

  if (entry.action === "updated" && entry.changes.length > 0) {
    return `changed ${entry.changes
      .map((change) => FIELD_LABELS[change.field] ?? change.field)
      .join(", ")}`;
  }

  return ACTION_VERBS[entry.action];
}

export function ActivitySection({
  entries,
  now,
}: {
  entries: ActivityEntry[];
  /**
   * Passed in rather than read here: `Date.now()` during render is impure, and
   * the React Compiler rejects it outright.
   */
  now: Date;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <DrawerSection icon={HistoryIcon} title="History">
      <ul className="space-y-2.5">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-baseline gap-2.5 text-xs">
            <Avatar className="size-5 shrink-0 self-start">
              {entry.actor?.image ? (
                <AvatarImage src={entry.actor.image} alt="" />
              ) : null}
              <AvatarFallback className="text-[0.5rem]">
                {initials(entry.actor?.name ?? "?")}
              </AvatarFallback>
            </Avatar>

            <p className="min-w-0 flex-1 text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">
                {entry.actor?.name ?? "Someone"}
              </span>{" "}
              {describe(entry)}
            </p>

            <span className="shrink-0 text-muted-foreground/70">
              {relativeTime(entry.createdAt, now)}
            </span>
          </li>
        ))}
      </ul>
    </DrawerSection>
  );
}
