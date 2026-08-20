import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import type { Metadata } from "next";

import { FadeIn } from "@/components/common/fade-in";
import { PageHeader } from "@/components/common/page-header";
import { requireSession } from "@/features/auth/server/session";
import { SocialCalendar } from "@/features/social/components/social-calendar";
import { getCalendar } from "@/features/social/server/social.service";
import { WorkspaceOnboarding } from "@/features/tasks/components/workspace-onboarding";
import { getActiveWorkspaceContext } from "@/features/tasks/server/active-workspace";

export const metadata: Metadata = {
  title: "Content",
};

/**
 * Resolves the `?month=` parameter to the first of a real month.
 *
 * Anything unparseable falls back to today rather than erroring: the month is
 * in a URL people edit and share, and a typo in it should show this month, not
 * a crash.
 */
function resolveMonth(raw: string | undefined): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return startOfMonth(new Date());
  }

  const parsed = parseISO(raw);

  return Number.isNaN(parsed.getTime())
    ? startOfMonth(new Date())
    : startOfMonth(parsed);
}

/**
 * The social calendar.
 *
 * Its own world: clients and posts, with no board, list or task anywhere in it.
 * A post is not a card that happens to be about Instagram — it has a client, a
 * format and a designer hand-off, none of which mean anything on a kanban
 * board, and none of the board's columns and positions mean anything here.
 */
export default async function ContentPage({
  searchParams,
}: PageProps<"/content">) {
  const session = await requireSession();
  const { active } = await getActiveWorkspaceContext(session.user.id);

  if (!active) {
    return (
      <WorkspaceOnboarding
        suggestedName={`${session.user.name.trim().split(/\s+/)[0] ?? "My"}'s workspace`}
      />
    );
  }

  const { month } = await searchParams;
  const monthStart = resolveMonth(typeof month === "string" ? month : undefined);

  const { clients, posts } = await getCalendar(active.id, session.user.id, {
    from: format(startOfMonth(monthStart), "yyyy-MM-dd"),
    to: format(endOfMonth(monthStart), "yyyy-MM-dd"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Every client's posting month. Click a day to write a post, and move it to Ready once the designer has made the artwork."
      />

      <FadeIn>
        <SocialCalendar
          workspaceId={active.id}
          month={format(monthStart, "yyyy-MM-dd")}
          clients={clients}
          posts={posts}
          members={active.members}
        />
      </FadeIn>
    </div>
  );
}
