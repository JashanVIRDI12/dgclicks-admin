import { HistoryIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { LocalTime } from "@/components/common/local-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ACTIVITY_ENTITY_LABELS,
  type ActivityAction,
} from "@/features/activity/constants";
import type { ActivityEntry } from "@/features/activity/types";

/** Past-tense verb per action, so entries read as a sentence. */
const ACTION_VERBS: Record<ActivityAction, string> = {
  created: "added",
  updated: "updated",
  completed: "completed",
  reopened: "reopened",
  moved: "moved",
  archived: "archived",
  restored: "restored",
  deleted: "deleted",
};

/** Field names as they appear in the UI, not as stored. */
const FIELD_LABELS: Record<string, string> = {
  name: "name",
  title: "title",
  description: "description",
  icon: "icon",
  color: "colour",
  priority: "priority",
  assignee: "assignee",
  dueDate: "due date",
  startDate: "start date",
  estimateMinutes: "estimate",
  members: "members",
  recurrence: "repeat",
};

function initials(name: string): string {
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

/**
 * Links to the record an entry is about.
 *
 * Deleted records get plain text — a link to something that no longer exists is
 * worse than no link, and `entityLabel` is denormalised precisely for this case.
 *
 * Everything below a board resolves to the board, because that is the only page
 * in the app: a task is a `?task=` query on its board, which opens the drawer
 * over whichever view the reader prefers rather than forcing a layout on them.
 */
function entityHref(entry: ActivityEntry): Route | null {
  if (entry.action === "deleted") {
    return null;
  }

  switch (entry.entityType) {
    case "workspace":
      return "/settings";
    case "board":
      return `/boards/${entry.entityId}` as Route;
    case "task":
      return entry.boardId
        ? (`/boards/${entry.boardId}?task=${entry.entityId}` as Route)
        : null;
    case "comment":
    case "attachment":
      // These hang off a task, so the useful destination is that task's drawer.
      return entry.boardId && entry.context?.type === "task"
        ? (`/boards/${entry.boardId}?task=${entry.context.id}` as Route)
        : null;
    case "list":
      return entry.boardId ? (`/boards/${entry.boardId}` as Route) : null;
    default:
      return null;
  }
}

function contextHref(entry: ActivityEntry): Route | null {
  if (!entry.context) {
    return null;
  }

  if (entry.context.type === "board") {
    return `/boards/${entry.context.id}` as Route;
  }

  if (entry.context.type === "task" && entry.boardId) {
    return `/boards/${entry.boardId}?task=${entry.context.id}` as Route;
  }

  return null;
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const href = entityHref(entry);
  const parentHref = contextHref(entry);
  const actorName = entry.actor?.name ?? "Someone";

  const label = (
    <span className="font-medium">
      {entry.entityLabel || ACTIVITY_ENTITY_LABELS[entry.entityType]}
    </span>
  );

  return (
    <li className="flex gap-3 py-3">
      <Avatar className="mt-0.5 size-7 shrink-0">
        {entry.actor?.image ? (
          <AvatarImage src={entry.actor.image} alt="" />
        ) : null}
        <AvatarFallback className="text-xs">
          {initials(actorName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-pretty">
          <span className="font-medium">{actorName}</span>{" "}
          {ACTION_VERBS[entry.action]}{" "}
          {ACTIVITY_ENTITY_LABELS[entry.entityType]}{" "}
          {href ? (
            <Link
              href={href}
              className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
            >
              {label}
            </Link>
          ) : (
            label
          )}
          {entry.context ? (
            <>
              {" on "}
              {parentHref ? (
                <Link
                  href={parentHref}
                  className="underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
                >
                  {entry.context.label}
                </Link>
              ) : (
                <span className="font-medium">{entry.context.label}</span>
              )}
            </>
          ) : null}
        </p>

        {entry.changes.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {entry.changes.map((change) => (
              <li key={change.field}>
                {FIELD_LABELS[change.field] ?? change.field}:{" "}
                <span className="line-through">{change.from || "empty"}</span> →{" "}
                <span>{change.to || "empty"}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <LocalTime
          iso={entry.createdAt}
          className="block text-xs text-muted-foreground"
        />
      </div>
    </li>
  );
}

export function ActivityFeed({
  entries,
  emptyDescription,
}: {
  entries: ActivityEntry[];
  emptyDescription: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="Nothing yet"
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <ActivityItem key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}
