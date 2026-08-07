import type {
  ActivityAction,
  ActivityEntity,
} from "@/features/activity/constants";
import type { UserSummary } from "@/features/auth/types";

/** A single field that changed, for update entries. */
export type ActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

/**
 * The parent an entry belongs to, such as a comment's task.
 *
 * Lets one query build a per-record timeline that includes things done to the
 * record's children, not just the record itself.
 */
export type ActivityContext = {
  type: ActivityEntity;
  id: string;
  label: string;
};

export type ActivityEntry = {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntity;
  entityId: string;
  /**
   * The record's name as it was at the time.
   *
   * Denormalised on purpose: a reference would dangle once the record is
   * deleted, and "deleted Monthly SEO report" is the entry that matters most.
   */
  entityLabel: string;
  /**
   * The board this happened on, when there is one.
   *
   * Separate from `context` because the board is the only navigable anchor in
   * this app — a task opens as `/boards/{boardId}?task={id}`, so a comment's
   * entry needs the board even though its `context` is the task.
   */
  boardId: string | null;
  actor: UserSummary | null;
  context: ActivityContext | null;
  changes: ActivityChange[];
  createdAt: string;
};
