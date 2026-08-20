import type { UserSummary } from "@/features/auth/types";
import type { LabelColor } from "@/features/tasks/constants";
import type { ContentFormat, PostStage } from "@/features/social/constants";

/**
 * Plain shapes handed to client components, same contract as everywhere else:
 * ids are strings, dates are ISO strings, nothing carries a Mongoose prototype.
 */

/** A company whose social media this workspace runs. */
export type SocialClient = {
  id: string;
  workspaceId: string;
  name: string;
  /** The @handle, without the @. Null when nobody has filled it in. */
  handle: string | null;
  color: LabelColor;
  archivedAt: string | null;
  createdAt: string;
};

export type SocialPost = {
  id: string;
  workspaceId: string;
  clientId: string;
  /**
   * The day this goes out, as `yyyy-MM-dd`.
   *
   * A plain date string, not a `Date`. A post belongs to a day on a calendar,
   * and storing an instant would mean the same post showed on the 4th in Mumbai
   * and the 3rd on a laptop set to UTC — which is exactly the bug that made the
   * activity feed report the wrong day.
   */
  scheduledFor: string;
  heading: string;
  /** The caption or copy. Empty string when nothing is written yet. */
  caption: string;
  format: ContentFormat;
  /** A link or a note pointing at what this should look like. */
  reference: string | null;
  stage: PostStage;
  /** The designer this is with. Null when nobody has picked it up. */
  assignee: UserSummary | null;
  /** Set when the stage first reached `ready`, with who moved it there. */
  readyAt: string | null;
  readyBy: UserSummary | null;
  createdBy: UserSummary | null;
  createdAt: string;
  updatedAt: string;
};

/** One month of one workspace's posting, plus the clients to file it under. */
export type SocialCalendar = {
  clients: SocialClient[];
  posts: SocialPost[];
};
