/**
 * Dates and times for display, always in the viewer's own time zone and language.
 *
 * The backend sends instants as ISO strings in UTC ("2026-10-02T03:00:00.000Z"); the
 * browser converts those to local time. Calendar dates ("2026-09-23") and months
 * ("2026-09") have no time zone: they are read as local dates, so they never shift a
 * day (JavaScript would otherwise treat "2026-09-23" as UTC midnight, the previous day
 * in the Americas).
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_ONLY = /^(\d{4})-(\d{2})$/;

export type DateInput = string | number | Date | null | undefined;

/** A Date for any backend value, or null when missing or invalid. */
export function parseDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const day = DATE_ONLY.exec(value);
    if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    const month = MONTH_ONLY.exec(value);
    if (month) return new Date(Number(month[1]), Number(month[2]) - 1, 1);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The viewer's time zone, e.g. "America/New_York". */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string {
  const date = parseDate(value);
  // `undefined` locale and no `timeZone`: the viewer's language and local time.
  return date ? new Intl.DateTimeFormat(undefined, options).format(date) : fallback;
}

/** "Oct 2, 2026". */
export function formatDate(value: DateInput, fallback = "—"): string {
  return format(value, { month: "short", day: "numeric", year: "numeric" }, fallback);
}

/** "Oct 2, 2026, 9:30 AM" in local time. */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  return format(value, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }, fallback);
}

/** "Oct 2" (charts and compact lists). */
export function formatShortDate(value: DateInput, fallback = "—"): string {
  return format(value, { month: "short", day: "numeric" }, fallback);
}

/** "9:30 AM" in local time. */
export function formatTime(value: DateInput, fallback = "—"): string {
  return format(value, { hour: "numeric", minute: "2-digit" }, fallback);
}

/** "September 2026". */
export function formatMonth(value: DateInput, fallback = "—"): string {
  return format(value, { month: "long", year: "numeric" }, fallback);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 hours ago", "in 2 days"; "just now" under a minute. */
export function formatRelative(value: DateInput, now: number = Date.now(), fallback = "—"): string {
  const date = parseDate(value);
  if (!date) return fallback;
  const seconds = (date.getTime() - now) / 1000;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
