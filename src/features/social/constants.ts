/**
 * The social calendar's own vocabulary.
 *
 * Deliberately not shared with `features/tasks`. A post always has a format —
 * there is no "no media" post — so the task board's `MEDIA_TYPES`, which needs
 * a `none` for work that is not content, is the wrong list here. Two short
 * enums that happen to overlap are cheaper than one enum that has to apologise
 * for a member on every screen that uses it.
 */
export const CONTENT_FORMATS = [
  "post",
  "reel",
  "story",
  "carousel",
  "video",
  "gif",
  "photo",
  "graphic",
  "copy",
] as const;

export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  carousel: "Carousel",
  video: "Video",
  gif: "GIF",
  photo: "Photo",
  graphic: "Graphic",
  copy: "Copy only",
};

/**
 * Where a post has got to.
 *
 * One ordered line rather than two independent flags, because in this world a
 * post really does move through a queue: someone writes it, a designer makes
 * it, it goes out. The stage the whole tool exists to make visible is `ready` —
 * the designer's hand-off back to the person who scheduled it.
 */
export const POST_STAGES = [
  "planned",
  "designing",
  "ready",
  "posted",
] as const;

export type PostStage = (typeof POST_STAGES)[number];

export const POST_STAGE_LABELS: Record<PostStage, string> = {
  planned: "Planned",
  designing: "With designer",
  ready: "Ready to post",
  posted: "Posted",
};

export const SOCIAL_LIMITS = {
  clientName: 60,
  clientHandle: 40,
  heading: 200,
  caption: 5_000,
  reference: 500,
} as const;

/**
 * How many posts one month view will load.
 *
 * A month of one agency's posting is tens of rows, not thousands. The cap is
 * here so a query can never turn into an unbounded scan, not because the number
 * is expected to be reached.
 */
export const POST_PAGE_LIMIT = 500;
