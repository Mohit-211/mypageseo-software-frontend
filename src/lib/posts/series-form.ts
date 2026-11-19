/**
 * The auto-post series form (create and edit) and the words for a series' settings (Phase 25c and the
 * 2026-11-16/17 follow-ups). Pure: no React.
 *
 * Creating: every field is optional since Phase 25c (`POST …/post-series {}`), which makes "AI posts": weekly on one
 * weekday (two days from today, Monday instead of a weekend day) at 10:00 in the series' zone, starting today,
 * review mode, pictures on, automatic topics, every eligible keyword and the default button. The form opens with
 * exactly those values (`newSeriesForm`) and `createInput` sends only what the user changed, so an untouched form
 * sends `{}`. The one exception is the time zone: series times are in the user's own zone (Mohit, 2026-10-12), so it
 * is sent whenever it isn't the zone the server would use anyway (the location's, else UTC).
 *
 * Editing: `PATCH` gets only the changed fields (`patchInput`). A change of the schedule or the content
 * (`releasesPosts`: anything but the name) takes the posts the series already wrote for future slots back to drafts
 * (`posts_released`) and starts its review-first posts again.
 *
 * Backend: docs/API.md "Auto-posts (series)"; src/modules/posts/domain/series.ts (`defaultSeriesSchedule`,
 * `SERIES_RELEASE_FIELDS`) and validation/posts.validation.ts (name ≤ 80, topics 3–200 characters and ≤ 20,
 * keywords ≤ 20, instructions ≤ 500, every_n_days 1–30, day_of_month 1–28).
 */
import type { CtaType, PostCta, PostSeries, PostSeriesInput, PostTone, SeriesCadence, SeriesPublishMode, SeriesTopicMode, Weekday } from "@/api";

/** The name of a series made without one. */
export const SERIES_DEFAULT_NAME = "AI posts";
/** The time of day of a series made without one (in the series' zone). */
export const SERIES_DEFAULT_TIME = "10:00";
export const SERIES_DEFAULT_TONE: PostTone = "friendly";

export const SERIES_FIELD_LIMITS = {
  nameMax: 80,
  topicMin: 3,
  topicMax: 200,
  topicsMax: 20,
  keywordsMax: 20,
  instructionsMax: 500,
  everyNMax: 30,
  dayOfMonthMax: 28,
} as const;

/** Monday first, as the backend lists days. */
export const WEEK_ORDER: readonly Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

const WEEKDAY_NAME: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

const WEEKDAY_SHORT: Record<Weekday, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

/** `Date#getUTCDay()` (0 = Sunday) → the backend's day name. */
const BY_UTC_DAY: readonly Weekday[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/* -------------------------------------------------------------------------- */
/* Time zones and today                                                         */
/* -------------------------------------------------------------------------- */

/** True for an IANA zone this browser knows (the backend checks with the same database). */
export function isValidTimeZone(zone: string): boolean {
  if (!zone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone.trim() });
    return true;
  } catch {
    return false;
  }
}

/** The browser's own zone ("UTC" when it can't tell). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Today's date (`YYYY-MM-DD`) in `zone`, as the backend reads "today" for a series. An unknown zone counts as UTC. */
export function zonedToday(now: number, zone: string | null | undefined): string {
  const date = new Date(now);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone && isValidTimeZone(zone) ? zone : "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const text = `${get("year")}-${get("month")}-${get("day")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  } catch {
    // Falls through to the UTC date.
  }
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * The weekday a series made without a schedule posts on: two days from today in its zone (so the first post can
 * be reviewed before it goes out), Monday when that falls on a weekend (backend `defaultSeriesSchedule`).
 */
export function defaultSeriesDay(now: number, zone: string | null | undefined): Weekday {
  const [year, month, day] = zonedToday(now, zone).split("-").map(Number);
  const target = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 2));
  const weekday = target.getUTCDay();
  return weekday === 0 || weekday === 6 ? "MONDAY" : (BY_UTC_DAY[weekday] ?? "MONDAY");
}

/* -------------------------------------------------------------------------- */
/* Words                                                                        */
/* -------------------------------------------------------------------------- */

const TIME_OF_DAY = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "09:00" (a series' local time of day) → "9:00 AM" in the viewer's format. */
export function formatTimeOfDay(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  return TIME_OF_DAY.format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
}

export function weekdayName(day: Weekday): string {
  return WEEKDAY_NAME[day];
}

/** "Every Thursday", "Every Mon, Thu", "Every day", "Every 3 days", "Monthly on day 1". */
export function cadenceText(cadence: SeriesCadence): string {
  if (cadence.kind === "weekly") {
    const days = WEEK_ORDER.filter((day) => cadence.days_of_week.includes(day));
    if (days.length === 1 && days[0]) return `Every ${WEEKDAY_NAME[days[0]]}`;
    if (days.length === 7) return "Every day";
    return `Every ${days.map((day) => WEEKDAY_SHORT[day]).join(", ") || "week"}`;
  }
  if (cadence.kind === "every_n_days") return cadence.n === 1 ? "Every day" : `Every ${cadence.n} days`;
  return `Monthly on day ${cadence.day_of_month}`;
}

/** "Every Thursday at 10:00 AM". */
export function scheduleText(cadence: SeriesCadence, timeOfDay: string): string {
  return `${cadenceText(cadence)} at ${formatTimeOfDay(timeOfDay)}`;
}

/** A series' topic mode; series made before Phase 25c have none: a list when they have topics, else automatic. */
export function seriesTopicMode(series: Pick<PostSeries, "topic_mode" | "topics">): SeriesTopicMode {
  return series.topic_mode ?? (series.topics.length > 0 ? "list" : "auto");
}

/** A series' publish mode; series made before Phase 25c read as `review`. */
export function seriesPublishMode(series: Pick<PostSeries, "publish_mode">): SeriesPublishMode {
  return series.publish_mode ?? "review";
}

/** "1 scheduled post went back to drafts" for a PATCH's `posts_released`; null when none did. */
export function postsReleasedText(count: number | null | undefined): string | null {
  if (!count || count <= 0) return null;
  return count === 1 ? "1 scheduled post went back to drafts" : `${count} scheduled posts went back to drafts`;
}

/* -------------------------------------------------------------------------- */
/* The form                                                                     */
/* -------------------------------------------------------------------------- */

/** The button: a fixed one, or `auto` (the location's default button, else Learn more to the matching page, else Call). */
export type SeriesButton = CtaType | "auto";

export type SeriesForm = {
  /** Empty = "AI posts". */
  name: string;
  kind: SeriesCadence["kind"];
  days: Weekday[];
  everyN: string;
  dayOfMonth: string;
  /** `HH:mm` in `zone`. */
  time: string;
  zone: string;
  /** `YYYY-MM-DD`; empty = today. */
  startsOn: string;
  /** `YYYY-MM-DD` or empty. */
  endsOn: string;
  topicMode: SeriesTopicMode;
  /** One topic per line (list mode). */
  topics: string;
  /** `all`: every eligible tracked keyword (the series' `keywords: []`). */
  keywordMode: "all" | "some";
  keywords: string[];
  publishMode: SeriesPublishMode;
  tone: PostTone;
  cta: SeriesButton;
  ctaUrl: string;
  includeImage: boolean;
  instructions: string;
};

/** A new series' form: the server's defaults for `{}` in `zone` (`includeImage` false where photos can't publish yet). */
export function newSeriesForm({ now, zone, includeImage = true }: { now: number; zone: string; includeImage?: boolean }): SeriesForm {
  return {
    name: "",
    kind: "weekly",
    days: [defaultSeriesDay(now, zone)],
    everyN: "3",
    dayOfMonth: "1",
    time: SERIES_DEFAULT_TIME,
    zone,
    startsOn: zonedToday(now, zone),
    endsOn: "",
    topicMode: "auto",
    topics: "",
    keywordMode: "all",
    keywords: [],
    publishMode: "review",
    tone: SERIES_DEFAULT_TONE,
    cta: "auto",
    ctaUrl: "",
    includeImage,
    instructions: "",
  };
}

/** An existing series as the form shows it. */
export function seriesFormFrom(series: PostSeries): SeriesForm {
  const cadence = series.cadence;
  return {
    name: series.name,
    kind: cadence.kind,
    days: cadence.kind === "weekly" ? [...cadence.days_of_week] : ["MONDAY"],
    everyN: cadence.kind === "every_n_days" ? String(cadence.n) : "3",
    dayOfMonth: cadence.kind === "monthly" ? String(cadence.day_of_month) : "1",
    time: series.time_of_day,
    zone: series.time_zone,
    startsOn: series.starts_on,
    endsOn: series.ends_on ?? "",
    topicMode: seriesTopicMode(series),
    topics: series.topics.join("\n"),
    keywordMode: series.keywords?.length ? "some" : "all",
    keywords: [...(series.keywords ?? [])],
    publishMode: seriesPublishMode(series),
    tone: series.tone,
    cta: series.cta?.type ?? "auto",
    ctaUrl: series.cta?.url ?? "",
    includeImage: series.include_image,
    instructions: series.instructions ?? "",
  };
}

/** The form's cadence (days in week order). */
export function formCadence(form: SeriesForm): SeriesCadence {
  if (form.kind === "every_n_days") return { kind: "every_n_days", n: Number(form.everyN) };
  if (form.kind === "monthly") return { kind: "monthly", day_of_month: Number(form.dayOfMonth) };
  return { kind: "weekly", days_of_week: WEEK_ORDER.filter((day) => form.days.includes(day)) };
}

/** The list mode's topics: one per line, trimmed, empty lines dropped. */
export function formTopics(form: Pick<SeriesForm, "topics">): string[] {
  return form.topics
    .split("\n")
    .map((topic) => topic.trim())
    .filter(Boolean);
}

/** The form's button, as the API takes it (null: chosen for each post). */
export function formCta(form: Pick<SeriesForm, "cta" | "ctaUrl">): PostCta | null {
  if (form.cta === "auto") return null;
  return { type: form.cta, url: form.cta === "CALL" ? null : form.ctaUrl.trim() || null };
}

export type SeriesFormField = "name" | "days" | "everyN" | "dayOfMonth" | "time" | "zone" | "dates" | "topics" | "keywords" | "ctaUrl" | "instructions";

/** What the user has to fix before saving, per field (empty when the form can be saved). */
export function seriesFormProblems(form: SeriesForm): Partial<Record<SeriesFormField, string>> {
  const problems: Partial<Record<SeriesFormField, string>> = {};
  const limits = SERIES_FIELD_LIMITS;
  if (form.name.trim().length > limits.nameMax) problems.name = `Use ${limits.nameMax} characters or fewer.`;
  if (form.kind === "weekly" && form.days.length === 0) problems.days = "Pick at least one day.";
  const n = Number(form.everyN);
  if (form.kind === "every_n_days" && !(Number.isInteger(n) && n >= 1 && n <= limits.everyNMax)) problems.everyN = `Pick a number from 1 to ${limits.everyNMax}.`;
  const day = Number(form.dayOfMonth);
  if (form.kind === "monthly" && !(Number.isInteger(day) && day >= 1 && day <= limits.dayOfMonthMax)) {
    problems.dayOfMonth = `Pick a day from 1 to ${limits.dayOfMonthMax}.`;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) problems.time = "Pick a time.";
  if (!isValidTimeZone(form.zone)) problems.zone = "Use a time zone such as America/Toronto.";
  if (form.endsOn && form.startsOn && form.endsOn < form.startsOn) problems.dates = "The end date must be after the start date.";
  if (form.topicMode === "list") {
    const topics = formTopics(form);
    if (topics.length === 0) problems.topics = "Add at least one topic, or let AI plan the topics.";
    else if (topics.length > limits.topicsMax) problems.topics = `Use up to ${limits.topicsMax} topics.`;
    else if (topics.some((topic) => topic.length < limits.topicMin)) problems.topics = `Each topic needs at least ${limits.topicMin} characters.`;
    else if (topics.some((topic) => topic.length > limits.topicMax)) problems.topics = `Keep each topic under ${limits.topicMax} characters.`;
  }
  if (form.keywordMode === "some" && form.keywords.length === 0) problems.keywords = "Pick at least one keyword, or use all of them.";
  else if (form.keywordMode === "some" && form.keywords.length > limits.keywordsMax) problems.keywords = `Pick up to ${limits.keywordsMax} keywords.`;
  const url = form.ctaUrl.trim();
  if (form.cta !== "auto" && form.cta !== "CALL" && url && !/^https:\/\/\S+\.\S+/i.test(url)) problems.ctaUrl = "Use a web address that starts with https://";
  if (form.instructions.trim().length > limits.instructionsMax) problems.instructions = `Use ${limits.instructionsMax} characters or fewer.`;
  return problems;
}

const keywordKey = (keyword: string) => keyword.trim().toLowerCase().replace(/\s+/g, " ");

/** True when two keyword lists name the same keywords (the backend compares ignoring case and spacing). */
export function sameKeywords(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a.map(keywordKey));
  const right = new Set(b.map(keywordKey));
  return left.size === right.size && [...left].every((key) => right.has(key));
}

function sameCadence(a: SeriesCadence, b: SeriesCadence): boolean {
  if (a.kind === "weekly" && b.kind === "weekly") {
    return a.days_of_week.length === b.days_of_week.length && a.days_of_week.every((day) => b.days_of_week.includes(day));
  }
  if (a.kind === "every_n_days" && b.kind === "every_n_days") return a.n === b.n;
  if (a.kind === "monthly" && b.kind === "monthly") return a.day_of_month === b.day_of_month;
  return false;
}

function sameCta(a: PostCta | null, b: PostCta | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.type === b.type && (a.url || null) === (b.url || null);
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * A new series' body: only what differs from the server's defaults for `{}` (so an untouched form is `{}`), plus the
 * user's zone when the server would use another (`locationZone`, else UTC).
 */
export function createInput(form: SeriesForm, { now, locationZone }: { now: number; locationZone: string | null | undefined }): PostSeriesInput {
  const zone = form.zone.trim();
  const input: PostSeriesInput = {};
  if (zone && zone !== (locationZone || "UTC")) input.time_zone = zone;
  const name = form.name.trim();
  if (name && name !== SERIES_DEFAULT_NAME) input.name = name;
  const cadence = formCadence(form);
  const defaultDay = defaultSeriesDay(now, zone);
  if (!(cadence.kind === "weekly" && cadence.days_of_week.length === 1 && cadence.days_of_week[0] === defaultDay)) input.cadence = cadence;
  if (form.time !== SERIES_DEFAULT_TIME) input.time_of_day = form.time;
  if (form.startsOn && form.startsOn !== zonedToday(now, zone)) input.starts_on = form.startsOn;
  if (form.endsOn) input.ends_on = form.endsOn;
  if (form.topicMode === "list") {
    input.topic_mode = "list";
    input.topics = formTopics(form);
  }
  if (form.keywordMode === "some" && form.keywords.length > 0) input.keywords = [...form.keywords];
  if (form.publishMode === "auto") input.publish_mode = "auto";
  if (!form.includeImage) input.include_image = false;
  if (form.tone !== SERIES_DEFAULT_TONE) input.tone = form.tone;
  const cta = formCta(form);
  if (cta) input.cta = cta;
  const instructions = form.instructions.trim();
  if (instructions) input.instructions = instructions;
  return input;
}

/** An edit's body: only the fields that changed (empty: nothing to save). */
export function patchInput(form: SeriesForm, series: PostSeries): PostSeriesInput {
  const input: PostSeriesInput = {};
  const name = form.name.trim() || SERIES_DEFAULT_NAME;
  if (name !== series.name) input.name = name;
  const cadence = formCadence(form);
  if (!sameCadence(cadence, series.cadence)) input.cadence = cadence;
  if (form.time !== series.time_of_day) input.time_of_day = form.time;
  const zone = form.zone.trim();
  if (zone && zone !== series.time_zone) input.time_zone = zone;
  if (form.startsOn && form.startsOn !== series.starts_on) input.starts_on = form.startsOn;
  const endsOn = form.endsOn || null;
  if (endsOn !== (series.ends_on ?? null)) input.ends_on = endsOn;
  const topics = formTopics(form);
  if (form.topicMode !== seriesTopicMode(series)) {
    input.topic_mode = form.topicMode;
    if (form.topicMode === "list") input.topics = topics;
  } else if (form.topicMode === "list" && !sameList(topics, series.topics)) {
    input.topic_mode = "list";
    input.topics = topics;
  }
  const keywords = form.keywordMode === "all" ? [] : form.keywords;
  if (!sameKeywords(keywords, series.keywords ?? [])) input.keywords = [...keywords];
  if (form.publishMode !== seriesPublishMode(series)) input.publish_mode = form.publishMode;
  if (form.tone !== series.tone) input.tone = form.tone;
  const cta = formCta(form);
  if (!sameCta(cta, series.cta)) input.cta = cta;
  if (form.includeImage !== series.include_image) input.include_image = form.includeImage;
  const instructions = form.instructions.trim() || null;
  if (instructions !== (series.instructions?.trim() || null)) input.instructions = instructions;
  return input;
}

/**
 * True when an edit changes the schedule or the content (everything but the name): the posts the series already
 * wrote for future slots go back to drafts, and an automatic series' first posts wait for review again.
 */
export function releasesPosts(input: PostSeriesInput): boolean {
  return Object.keys(input).some((key) => key !== "name");
}

/** One line for the form's choices: "Every Thursday at 10:00 AM · AI plans the topics · Each post waits for review · With a picture". */
export function seriesFormSummary(form: SeriesForm): string {
  const cadence = formCadence(form);
  const schedule = form.kind === "weekly" && cadence.kind === "weekly" && cadence.days_of_week.length === 0 ? "No day picked yet" : scheduleText(cadence, form.time);
  return [
    schedule,
    form.topicMode === "auto" ? "AI plans the topics" : "Your topics in turn",
    form.publishMode === "auto" ? "Publishes on its own" : "Each post waits for review",
    form.includeImage ? "With a picture" : "Text only",
  ].join(" · ");
}
