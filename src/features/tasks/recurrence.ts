import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  getDate,
  getDaysInMonth,
  setDate,
} from "date-fns";

import {
  RECURRENCE_FREQUENCY_LABELS,
  type RecurrenceFrequency,
} from "@/features/tasks/constants";

/**
 * Recurrence arithmetic.
 *
 * Pure and shared: the editor previews the next few dates as you change the
 * rule, and the server computes the same ones when it spawns. Two
 * implementations of "what does every third Tuesday mean" would eventually
 * disagree, and the one people would notice is the wrong one.
 */

export type RecurrenceInput = {
  frequency: RecurrenceFrequency;
  interval: number;
  /** 0 = Sunday … 6 = Saturday. Only used by `custom`. */
  weekdays: number[];
  dayOfMonth: number | null;
  endsAt: Date | string | null;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Pins a date to a day of the month without rolling into the next one.
 *
 * The 31st of a 30-day month is the 30th, not the 1st — which is what naive
 * date arithmetic produces and what makes a monthly report land in the wrong
 * month twice a year.
 */
function clampToDayOfMonth(date: Date, dayOfMonth: number): Date {
  return setDate(date, Math.min(dayOfMonth, getDaysInMonth(date)));
}

/** The next selected weekday strictly after `from`. */
function nextSelectedWeekday(from: Date, weekdays: number[]): Date {
  const sorted = [...new Set(weekdays)].sort((a, b) => a - b);

  if (sorted.length === 0) {
    return addWeeks(from, 1);
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(from, offset);

    if (sorted.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return addWeeks(from, 1);
}

/** When the occurrence after `from` is due. */
export function nextOccurrence(rule: RecurrenceInput, from: Date): Date {
  const interval = Math.max(1, rule.interval);

  switch (rule.frequency) {
    case "daily":
      return addDays(from, interval);
    case "weekly":
      return addWeeks(from, interval);
    case "monthly": {
      const next = addMonths(from, interval);
      return clampToDayOfMonth(next, rule.dayOfMonth ?? getDate(from));
    }
    case "quarterly": {
      const next = addMonths(from, 3 * interval);
      return clampToDayOfMonth(next, rule.dayOfMonth ?? getDate(from));
    }
    case "yearly":
      return addYears(from, interval);
    case "custom":
      return nextSelectedWeekday(from, rule.weekdays);
  }
}

/**
 * Catches a rule up to the present.
 *
 * If nobody opened the app for six weeks, a weekly task should produce the one
 * occurrence that is now due — not six of them, and not one still dated six
 * weeks ago. The loop is bounded so a malformed rule cannot spin.
 */
export function nextOccurrenceAfter(
  rule: RecurrenceInput,
  from: Date,
  now: Date,
): Date {
  let candidate = nextOccurrence(rule, from);

  for (let guard = 0; guard < 500 && candidate <= now; guard += 1) {
    candidate = nextOccurrence(rule, candidate);
  }

  return candidate;
}

/** True once the rule has passed its end date and should stop generating. */
export function hasRecurrenceEnded(
  rule: RecurrenceInput,
  at: Date,
): boolean {
  if (!rule.endsAt) {
    return false;
  }

  return at > new Date(rule.endsAt);
}

function ordinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";

  return `${value}${suffix}`;
}

/** The rule as a sentence, for the card badge and the editor's summary line. */
export function describeRecurrence(rule: RecurrenceInput): string {
  const every = rule.interval > 1 ? `every ${rule.interval} ` : "";

  switch (rule.frequency) {
    case "daily":
      return rule.interval > 1 ? `Every ${rule.interval} days` : "Every day";
    case "weekly":
      return rule.interval > 1 ? `Every ${rule.interval} weeks` : "Every week";
    case "monthly":
      return rule.dayOfMonth
        ? `${every ? `Every ${rule.interval} months` : "Monthly"} on the ${ordinal(rule.dayOfMonth)}`
        : rule.interval > 1
          ? `Every ${rule.interval} months`
          : "Every month";
    case "quarterly":
      return rule.interval > 1
        ? `Every ${rule.interval} quarters`
        : "Every quarter";
    case "yearly":
      return rule.interval > 1 ? `Every ${rule.interval} years` : "Every year";
    case "custom": {
      const days = [...new Set(rule.weekdays)]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_NAMES[day])
        .filter(Boolean);

      if (days.length === 0) {
        return RECURRENCE_FREQUENCY_LABELS.custom;
      }

      if (days.length === 7) {
        return "Every day";
      }

      return `Every ${days.join(", ")}`;
    }
  }
}
