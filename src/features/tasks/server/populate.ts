import "server-only";

import type { PopulateOptions } from "mongoose";

import { USER_SUMMARY_SELECT } from "@/features/auth/server/serialize";

/**
 * Shared `populate` configurations.
 *
 * Kept in their own module rather than next to either service that uses them:
 * boards need them to render cards and tasks need them to render a drawer, and
 * having one import the other would close a cycle.
 *
 * Every reference a serializer reads must appear here. `toTask` drops a label it
 * finds as a bare id, so a missing entry shows up as silently absent chips
 * rather than an error.
 *
 * Typed as mutable arrays on purpose — Mongoose's `populate()` overloads reject
 * a `readonly` array, so `as const` here would be a compile error at every call.
 */
export const TASK_POPULATE: PopulateOptions[] = [
  { path: "assignee", select: USER_SUMMARY_SELECT },
  { path: "labels", select: "board name color" },
  { path: "runningTimer.user", select: USER_SUMMARY_SELECT },
];

/** `TASK_POPULATE` plus the time log, which only the drawer reads. */
export const TASK_DETAIL_POPULATE: PopulateOptions[] = [
  ...TASK_POPULATE,
  { path: "timeEntries.user", select: USER_SUMMARY_SELECT },
];

export const COMMENT_POPULATE: PopulateOptions = {
  path: "author",
  select: USER_SUMMARY_SELECT,
};

export const ATTACHMENT_POPULATE: PopulateOptions = {
  path: "uploadedBy",
  select: USER_SUMMARY_SELECT,
};
