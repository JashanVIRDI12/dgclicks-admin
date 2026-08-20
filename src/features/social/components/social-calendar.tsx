"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  UserPlusIcon,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSummary } from "@/features/auth/types";
import { ClientDialog } from "@/features/social/components/client-dialog";
import { FormatIcon } from "@/features/social/components/format-icon";
import { PostDialog } from "@/features/social/components/post-dialog";
import {
  CONTENT_FORMAT_LABELS,
  POST_STAGES,
  POST_STAGE_LABELS,
} from "@/features/social/constants";
import type { SocialClient, SocialPost } from "@/features/social/types";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL = "__all__";

/** `yyyy-MM-dd`, the same shape `scheduledFor` is stored in. */
function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * How a stage reads on a chip.
 *
 * Ready and Posted are the two that change what somebody does next, so they get
 * the weight. Planned and Designing stay quiet — most of the month is one of
 * those, and colouring them too would leave nothing standing out.
 */
const STAGE_CLASS: Record<string, string> = {
  planned: "text-muted-foreground",
  designing: "text-muted-foreground",
  ready: "text-foreground font-medium",
  posted: "text-muted-foreground line-through",
};

function PostChip({
  post,
  client,
  onOpen,
}: {
  post: SocialPost;
  client: SocialClient | undefined;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${client?.name ?? "Unknown client"} · ${CONTENT_FORMAT_LABELS[post.format]} · ${POST_STAGE_LABELS[post.stage]}`}
      className="flex w-full items-center gap-1 rounded-md bg-card px-1.5 py-1 text-left text-[0.6875rem] leading-tight shadow-soft transition-shadow hover:shadow-lift"
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{
          background: client
            ? `var(--label-${client.color})`
            : "var(--muted-foreground)",
        }}
        aria-hidden="true"
      />
      <FormatIcon format={post.format} className="size-3 shrink-0" />
      <span className={cn("flex-1 truncate", STAGE_CLASS[post.stage])}>
        {post.heading}
      </span>
      <span className="sr-only">
        {client?.name}, {CONTENT_FORMAT_LABELS[post.format]},{" "}
        {POST_STAGE_LABELS[post.stage]}
      </span>
      {post.stage === "ready" ? (
        <span
          className="shrink-0 rounded bg-accent px-1 text-[0.5625rem] font-medium"
          aria-hidden="true"
        >
          Ready
        </span>
      ) : null}
    </button>
  );
}

/**
 * A month of posting, and the way new posts get written.
 *
 * Clicking a day is the create gesture — the date is the one field somebody has
 * already decided by the time they reach for it, so asking for it again in the
 * dialog would be asking a question they just answered by pointing.
 *
 * The month lives in the address bar rather than in state, so a link to
 * September opens on September, and so moving between months is a real
 * navigation the back button understands.
 */
export function SocialCalendar({
  workspaceId,
  month,
  clients,
  posts,
  members,
}: {
  workspaceId: string;
  /** First of the displayed month, as `yyyy-MM-dd`. */
  month: string;
  clients: SocialClient[];
  posts: SocialPost[];
  members: UserSummary[];
}) {
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();
  const [clientFilter, setClientFilter] = useState<string>(ALL);
  const [stageFilter, setStageFilter] = useState<string>(ALL);
  const [isClientOpen, setClientOpen] = useState(false);

  // Null means closed. A string opens an empty form on that day; a post opens
  // that post. One piece of state, so the dialog can never be open on both.
  const [editing, setEditing] = useState<
    { mode: "new"; date: string } | { mode: "edit"; post: SocialPost } | null
  >(null);

  const monthStart = parseISO(month);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  function goToMonth(next: Date) {
    startNavigating(() => {
      router.push(`/content?month=${format(next, "yyyy-MM-01")}` as Route);
    });
  }

  const clientsById = new Map(clients.map((client) => [client.id, client]));

  const visible = posts.filter((post) => {
    if (clientFilter !== ALL && post.clientId !== clientFilter) return false;
    if (stageFilter !== ALL && post.stage !== stageFilter) return false;
    return true;
  });

  const byDay = new Map<string, SocialPost[]>();

  for (const post of visible) {
    const existing = byDay.get(post.scheduledFor);

    if (existing) {
      existing.push(post);
    } else {
      byDay.set(post.scheduledFor, [post]);
    }
  }

  const awaitingArt = visible.filter(
    (post) => post.stage === "planned" || post.stage === "designing",
  );

  const hasClients = clients.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            disabled={isNavigating}
            onClick={() => goToMonth(addMonths(monthStart, -1))}
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {format(monthStart, "MMMM yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            disabled={isNavigating}
            onClick={() => goToMonth(addMonths(monthStart, 1))}
          >
            <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            disabled={isNavigating}
            onClick={() => goToMonth(new Date())}
          >
            Today
          </Button>
        </div>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger size="sm" className="w-44" aria-label="Client">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <span
                  className="size-2 rounded-full"
                  style={{ background: `var(--label-${client.color})` }}
                />
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger size="sm" className="w-40" aria-label="Stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stages</SelectItem>
            {POST_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {POST_STAGE_LABELS[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {visible.length} {visible.length === 1 ? "post" : "posts"}
            {awaitingArt.length > 0
              ? ` · ${awaitingArt.length} not made yet`
              : ""}
          </p>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={() => setClientOpen(true)}
          >
            <UserPlusIcon className="size-3.5" aria-hidden="true" />
            Add client
          </Button>

          <Button
            size="sm"
            className="h-7"
            disabled={!hasClients}
            onClick={() =>
              setEditing({ mode: "new", date: dayKey(new Date()) })
            }
          >
            <PlusIcon className="size-3.5" aria-hidden="true" />
            New post
          </Button>
        </div>
      </div>

      {hasClients ? null : (
        <p className="rounded-xl bg-surface p-4 text-sm text-pretty text-muted-foreground">
          Add a client first — every post belongs to one, so the calendar has
          nowhere to file anything until there is at least one company on it.
        </p>
      )}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-[0.6875rem] font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {days.map((date) => {
          const key = dayKey(date);
          const dayPosts = byDay.get(key) ?? [];
          const isOutside = date.getMonth() !== monthStart.getMonth();

          return (
            <div
              key={key}
              className={cn(
                "group/day scrollbar-subtle flex min-h-28 flex-col gap-1 rounded-lg p-1.5 transition-colors",
                isOutside ? "bg-transparent" : "bg-surface",
              )}
            >
              <div className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded px-1 text-[0.6875rem] tabular-nums",
                    isOutside && "text-muted-foreground/40",
                    isToday(date) &&
                      "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {format(date, "d")}
                </span>

                <button
                  type="button"
                  disabled={!hasClients}
                  onClick={() => setEditing({ mode: "new", date: key })}
                  aria-label={`Add a post on ${format(date, "d MMMM yyyy")}`}
                  className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/day:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 disabled:hidden"
                >
                  <PlusIcon className="size-3" aria-hidden="true" />
                </button>
              </div>

              {dayPosts.map((post) => (
                <PostChip
                  key={post.id}
                  post={post}
                  client={clientsById.get(post.clientId)}
                  onOpen={() => setEditing({ mode: "edit", post })}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/*
        Keyed so every opening builds a fresh form. React Hook Form reads its
        defaults once, so reusing one instance across two different posts would
        show the previous post's caption until something forced a reset.
      */}
      {editing ? (
        <PostDialog
          key={editing.mode === "edit" ? editing.post.id : editing.date}
          workspaceId={workspaceId}
          clients={clients}
          members={members}
          post={editing.mode === "edit" ? editing.post : null}
          defaultDate={
            editing.mode === "edit" ? editing.post.scheduledFor : editing.date
          }
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        />
      ) : null}

      <ClientDialog
        workspaceId={workspaceId}
        open={isClientOpen}
        onOpenChange={setClientOpen}
      />
    </div>
  );
}
