/**
 * What happened. Kept to a small, closed set so the feed stays readable and
 * every entry renders from a lookup rather than a stored sentence.
 */
export const ACTIVITY_ACTIONS = [
  "created",
  "updated",
  "completed",
  "reopened",
  "moved",
  "archived",
  "restored",
  "deleted",
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** What it happened to. */
export const ACTIVITY_ENTITIES = [
  "workspace",
  "board",
  "list",
  "task",
  "comment",
  "attachment",
] as const;

export type ActivityEntity = (typeof ACTIVITY_ENTITIES)[number];

export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntity, string> = {
  workspace: "workspace",
  board: "board",
  list: "list",
  task: "task",
  comment: "comment",
  attachment: "attachment",
};

export const ACTIVITY_PAGE_SIZE = 30;
