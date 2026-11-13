/**
 * Post dates in words, in the viewer's language and time zone.
 *
 * - Instants (`published_at`, `scheduled_at`, `error.at`) are UTC ISO strings: shown in local time.
 * - Event and offer dates are the location's own calendar dates ("2026-10-04" + an optional
 *   "10:00"), with no time zone: shown exactly as entered, never shifted a day.
 * The current year is left out ("Fri, Nov 14 · 11:00 AM"); other years are spelled out.
 */
import type { Post, PostDate, PostEvent, PostRecurrence, PostType, Weekday, WeekOfMonth } from "@/api";
import { formatDate, parseDate } from "@/lib/datetime";

export const POST_TYPE_LABEL: Record<PostType, string> = { standard: "Update", event: "Event", offer: "Offer" };

// Read once at module load (never during render). It only decides whether a date shows its year.
const THIS_YEAR = new Date().getFullYear();

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, options);
const DAY = fmt({ month: "short", day: "numeric" });
const DAY_YEAR = fmt({ month: "short", day: "numeric", year: "numeric" });
const WEEKDAY_DAY = fmt({ weekday: "short", month: "short", day: "numeric" });
const WEEKDAY_DAY_YEAR = fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
const TIME = fmt({ hour: "numeric", minute: "2-digit" });

const sameYear = (date: Date) => date.getFullYear() === THIS_YEAR;

/** "Nov 9 · 12:30 PM" (or "Fri, Nov 14 · 11:00 AM" with `weekday`); the year only when it isn't this year. */
export function formatPostMoment(value: string | null | undefined, options: { weekday?: boolean; time?: boolean } = {}): string {
  const date = parseDate(value);
  if (!date) return "—";
  const { weekday = false, time = true } = options;
  const day = (weekday ? (sameYear(date) ? WEEKDAY_DAY : WEEKDAY_DAY_YEAR) : sameYear(date) ? DAY : DAY_YEAR).format(date);
  return time ? `${day} · ${TIME.format(date)}` : day;
}

/** What happened to a post, or will, and when: the card's date line. */
export function postTimeline(post: Post): string {
  switch (post.status) {
    case "published":
      return post.published_at ? `Published ${formatPostMoment(post.published_at)}` : "Published";
    case "scheduled":
      return post.scheduled_at ? `Goes out ${formatPostMoment(post.scheduled_at, { weekday: true })}` : "Scheduled";
    case "publishing":
      return "Publishing now";
    case "pending_approval":
      return post.scheduled_at ? `Goes out ${formatPostMoment(post.scheduled_at, { weekday: true })} once approved` : "Publishes as soon as it's approved";
    case "failed":
      return post.error?.at ? `Failed ${formatPostMoment(post.error.at)}` : "Couldn't publish";
    case "rejected":
      return post.error?.at ? `Rejected by Google ${formatPostMoment(post.error.at)}` : "Rejected by Google";
    case "draft":
    default:
      return `Edited ${formatPostMoment(post.updated_at, { time: false })}`;
  }
}

/** A post date as a local Date (the calendar date, plus the time when there is one). */
function localDate(value: PostDate): Date | null {
  const date = parseDate(value.date);
  if (!date) return null;
  const match = value.time ? /^(\d{1,2}):(\d{2})/.exec(value.time) : null;
  if (match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/**
 * An event's or offer's dates: "Sat, Oct 4 · 10:00 AM – 3:00 PM", "Sat, Oct 4 (all day)",
 * "Nov 3 – 24", "Oct 4, 10:00 AM – Oct 6, 3:00 PM"; years only when they aren't this year.
 */
export function formatEventRange(event: Pick<PostEvent, "start" | "end">): string | null {
  const start = localDate(event.start);
  const end = localDate(event.end);
  if (!start) return null;
  const timed = Boolean(event.start.time);
  const showYear = !sameYear(start) || (end !== null && !sameYear(end));
  if (!end || event.start.date === event.end.date) {
    const day = (showYear ? WEEKDAY_DAY_YEAR : WEEKDAY_DAY).format(start);
    if (!timed) return `${day} (all day)`;
    const endTime = end && event.end.time ? ` – ${TIME.format(end)}` : "";
    return `${day} · ${TIME.format(start)}${endTime}`;
  }
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "numeric" } : {}),
    ...(timed ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  // An end before the start (an unfinished draft) would read as "Oct 6 – 4": spell out both ends.
  if (end.getTime() < start.getTime()) return `${fmt(options).format(start)} – ${fmt(options).format(end)}`;
  try {
    return fmt(options).formatRange(start, end);
  } catch {
    return `${fmt(options).format(start)} – ${fmt(options).format(end)}`;
  }
}

const WEEKDAY_NAME: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};
const WEEKDAY_BY_INDEX: Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const ORDINAL: Record<WeekOfMonth, string> = { FIRST: "first", SECOND: "second", THIRD: "third", FOURTH: "fourth", LAST: "last" };

const joinWords = (words: string[]) =>
  words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/** "Repeats every Saturday until Jan 30, 2027" (Google repeats the post itself). */
export function formatRecurrence(recurrence: PostRecurrence, start?: PostDate | null): string {
  const until = `until ${formatDate(recurrence.ends_on)}`;
  const startDay = start ? parseDate(start.date) : null;
  const startWeekday = startDay ? WEEKDAY_BY_INDEX[startDay.getDay()] : undefined;
  if (recurrence.pattern === "daily") return `Repeats every day ${until}`;
  if (recurrence.pattern === "weekly") {
    const days = recurrence.days_of_week?.length ? recurrence.days_of_week : startWeekday ? [startWeekday] : [];
    return days.length ? `Repeats every ${joinWords(days.map((day) => WEEKDAY_NAME[day]))} ${until}` : `Repeats every week ${until}`;
  }
  if (recurrence.week_of_month) {
    const weekday = startWeekday ? WEEKDAY_NAME[startWeekday] : "week";
    return `Repeats on the ${ORDINAL[recurrence.week_of_month]} ${weekday} of each month ${until}`;
  }
  if (recurrence.day_of_month) return `Repeats monthly on day ${recurrence.day_of_month} ${until}`;
  return `Repeats every month ${until}`;
}
