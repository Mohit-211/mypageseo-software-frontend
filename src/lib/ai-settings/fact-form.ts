/**
 * "Facts for the AI" (`/locations/:locationId/ai/facts`, Phase 25a), pure: the four kinds and their
 * fields, the add/edit form, its checks, the request bodies and the words for the list.
 *
 * The backend checks every fact (400 `invalid_fact` with `issues`), so the checks here only spare a
 * round trip for what is certain: required fields, lengths, https links and the order of the dates.
 * Dates are `{ date: "YYYY-MM-DD", time: "HH:mm" | null }` in the location's time zone: they are
 * shown as given, never converted. Since 2026-11-17 the list's `now { date, time }` is the location's
 * clock when it was read, so an end that has passed (with no time: the end of that day) is caught here;
 * the backend still has the last word at the boundary (`already_ended`).
 */
import type { AiFact, AiFactDate, AiFactInput, AiFactKind, AiFactPatch, AiFactsList } from "@/api";

/** The backend's limits (backend docs, API.md "Facts, offers, events and contests"). */
export const FACT_LIMITS = { text: 300, topic: 60, title: 58, coupon_code: 58, terms: 5000, url: 2048, perLocation: 100 } as const;

export const FACT_KINDS: readonly AiFactKind[] = ["fact", "offer", "event", "contest"];

export type FactField = "text" | "topic" | "title" | "start" | "end" | "coupon_code" | "redeem_url" | "terms" | "terms_url";

/** The fields each kind has (any other must stay empty). */
export const FACT_KIND_FIELDS: Record<AiFactKind, readonly FactField[]> = {
  fact: ["text", "topic"],
  offer: ["title", "start", "end", "coupon_code", "redeem_url", "terms", "text"],
  event: ["title", "start", "end", "text"],
  contest: ["title", "start", "end", "terms_url", "text"],
};

export const FACT_KIND_COPY: Record<AiFactKind, { label: string; article: string; description: string }> = {
  fact: { label: "Fact", article: "a fact", description: "Something true about the business: parking, payment, who runs the kitchen." },
  offer: { label: "Offer", article: "an offer", description: "A deal with its dates, like 20% off winter tires." },
  event: { label: "Event", article: "an event", description: "Something on a date, like a tasting night or an open house." },
  contest: { label: "Contest", article: "a contest", description: "A giveaway or contest, with a link to its rules." },
};

/** True for the kinds with a title and dates. */
export function isDatedKind(kind: AiFactKind): boolean {
  return kind !== "fact";
}

/** What the dialog's fields hold (always strings). */
export type FactForm = {
  text: string;
  topic: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  coupon_code: string;
  redeem_url: string;
  terms: string;
  terms_url: string;
};

/** A new fact of `kind`; a dated kind starts today (the location's date). */
export function emptyFactForm(kind: AiFactKind, today: string | null | undefined): FactForm {
  return {
    text: "",
    topic: "",
    title: "",
    startDate: isDatedKind(kind) && today ? today : "",
    startTime: "",
    endDate: "",
    endTime: "",
    coupon_code: "",
    redeem_url: "",
    terms: "",
    terms_url: "",
  };
}

export function factFormFrom(fact: AiFact): FactForm {
  return {
    text: fact.text ?? "",
    topic: fact.topic ?? "",
    title: fact.title ?? "",
    startDate: fact.start?.date ?? "",
    startTime: fact.start?.time ?? "",
    endDate: fact.end?.date ?? "",
    endTime: fact.end?.time ?? "",
    coupon_code: fact.coupon_code ?? "",
    redeem_url: fact.redeem_url ?? "",
    terms: fact.terms ?? "",
    terms_url: fact.terms_url ?? "",
  };
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A real calendar date "YYYY-MM-DD". */
function validDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const at = new Date(Date.UTC(year, month - 1, day));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month - 1 && at.getUTCDate() === day;
}

/** Minutes on a calendar without time zones; no time = the start of the day, or its last minute for an end. */
function minutes(date: string, time: string, endOfDay: boolean): number | null {
  if (!validDate(date) || (time && !TIME.test(time))) return null;
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time ? (time.split(":").map(Number) as [number, number]) : endOfDay ? [23, 59] : [0, 0];
  return Date.UTC(year, month - 1, day) / 60_000 + hour * 60 + minute;
}

/**
 * True when an end (in minutes, see `minutes`) is before the location's clock: `today` and, when known, `nowTime`.
 * Without the time only an earlier day counts (the backend decides the last minutes of today).
 */
function endHasPassed(end: number, today: string, nowTime: string | null | undefined): boolean {
  // Without the time, "now" is the start of today, so only an earlier day counts.
  const now = minutes(today, nowTime && TIME.test(nowTime) ? nowTime : "", false);
  return now !== null && end < now;
}

/** An https:// address with a host (the backend's own check is stricter about characters). */
export function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

export type FactFormErrors = Partial<Record<FactField, string>>;

/**
 * What to fix before saving. `checkEnd`: the end may not have passed (`today` is the location's date,
 * `nowTime` its time "HH:mm"), as the backend checks for new dates; off when editing a fact whose dates
 * didn't change. An end with no time counts as the end of its day.
 */
export function factFormErrors(
  kind: AiFactKind,
  form: FactForm,
  options: { today?: string | null; nowTime?: string | null; checkEnd?: boolean } = {},
): FactFormErrors {
  const errors: FactFormErrors = {};
  const text = form.text.trim();
  if (kind === "fact" && !text) errors.text = "Write the fact.";
  if (text.length > FACT_LIMITS.text) errors.text = `Keep it to ${FACT_LIMITS.text} characters.`;
  if (kind === "fact") {
    if (form.topic.trim().length > FACT_LIMITS.topic) errors.topic = `Keep it to ${FACT_LIMITS.topic} characters.`;
    return errors;
  }

  const title = form.title.trim();
  if (!title) errors.title = "Add a title.";
  else if (title.length > FACT_LIMITS.title) errors.title = `Keep it to ${FACT_LIMITS.title} characters.`;

  const start = form.startDate ? minutes(form.startDate, form.startTime, false) : null;
  const end = form.endDate ? minutes(form.endDate, form.endTime, true) : null;
  if (!form.startDate) errors.start = "Add the start date.";
  else if (start === null) errors.start = "Pick a valid date and time.";
  if (!form.endDate) errors.end = "Add the end date.";
  else if (end === null) errors.end = "Pick a valid date and time.";
  else if (start !== null && end < start) errors.end = "The end must be after the start.";
  else if (options.checkEnd && options.today && endHasPassed(end, options.today, options.nowTime)) errors.end = "This date has passed. Pick a later end.";

  if (kind === "offer") {
    if (form.coupon_code.trim().length > FACT_LIMITS.coupon_code) errors.coupon_code = `Keep it to ${FACT_LIMITS.coupon_code} characters.`;
    if (form.terms.trim().length > FACT_LIMITS.terms) errors.terms = `Keep it to ${FACT_LIMITS.terms.toLocaleString()} characters.`;
    const redeem = form.redeem_url.trim();
    if (redeem && (!isHttpsUrl(redeem) || redeem.length > FACT_LIMITS.url)) errors.redeem_url = "Use an https:// address.";
  }
  if (kind === "contest") {
    const rules = form.terms_url.trim();
    if (!rules) errors.terms_url = "A contest needs a link to its rules (https://…).";
    else if (!isHttpsUrl(rules) || rules.length > FACT_LIMITS.url) errors.terms_url = "Use an https:// address.";
  }
  return errors;
}

const dateOf = (date: string, time: string): AiFactDate => ({ date, time: time || null });

/** One field's value as the API takes it ("" → null). */
function fieldValue(form: FactForm, field: FactField): string | AiFactDate | null {
  if (field === "start") return form.startDate ? dateOf(form.startDate, form.startTime) : null;
  if (field === "end") return form.endDate ? dateOf(form.endDate, form.endTime) : null;
  return form[field].trim() || null;
}

/** The `POST` body: the kind and its own fields. */
export function factInput(kind: AiFactKind, form: FactForm): AiFactInput {
  const input: AiFactInput = { kind };
  for (const field of FACT_KIND_FIELDS[kind]) {
    const value = fieldValue(form, field);
    if (value !== null) (input as Record<string, unknown>)[field] = value;
  }
  return input;
}

const sameDate = (a: AiFactDate | null, b: AiFactDate | null) => (a?.date ?? null) === (b?.date ?? null) && (a?.time ?? null) === (b?.time ?? null);

/** The `PATCH` body: only the fields that changed (`null` clears one). Empty when nothing changed. */
export function factPatch(fact: AiFact, form: FactForm): AiFactPatch {
  const patch: AiFactPatch = {};
  for (const field of FACT_KIND_FIELDS[fact.kind]) {
    const next = fieldValue(form, field);
    if (field === "start" || field === "end") {
      if (!sameDate(fact[field], next as AiFactDate | null)) patch[field] = next as AiFactDate | null;
    } else if ((fact[field] ?? null) !== next) {
      patch[field] = next as string | null;
    }
  }
  return patch;
}

/** True when the edit moves a date (the backend then checks that the new end hasn't passed). */
export function datesChanged(fact: AiFact, form: FactForm): boolean {
  const patch = factPatch(fact, form);
  return "start" in patch || "end" in patch;
}

/* -------------------------------------------------------------------------- */
/* Words for the list                                                          */
/* -------------------------------------------------------------------------- */

/** "Nov 20" (or "Nov 20, 2027" when `withYear`), read as a calendar date: never shifted by a time zone. */
export function formatFactDay(date: string, withYear = false): string {
  const match = DATE.exec(date);
  if (!match) return date;
  const local = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) }).format(local);
}

/** "6:00 PM" for "18:00", as given (the location's own clock). */
export function formatFactTime(time: string): string {
  const match = TIME.exec(time);
  if (!match) return time;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
}

/**
 * The dates in plain words: "Nov 20 – Nov 30, until 6:00 PM", "Dec 31, 8:00 PM – Jan 1, 2027, 1:00 AM",
 * "Nov 22, from 7:00 PM". The year shows when it isn't the year of `today`.
 */
export function formatFactDates(start: AiFactDate | null, end: AiFactDate | null, today?: string | null): string | null {
  if (!start || !end) return null;
  const year = (today ?? "").slice(0, 4);
  const day = (d: AiFactDate) => formatFactDay(d.date, Boolean(year) && d.date.slice(0, 4) !== year);
  const time = (value: string | null) => (value ? formatFactTime(value) : null);
  const [startTime, endTime] = [time(start.time), time(end.time)];
  if (start.date === end.date) {
    if (startTime && endTime) return `${day(start)}, ${startTime} – ${endTime}`;
    if (startTime) return `${day(start)}, from ${startTime}`;
    if (endTime) return `${day(start)}, until ${endTime}`;
    return day(start);
  }
  const from = startTime ? `${day(start)}, ${startTime}` : day(start);
  if (endTime && !startTime) return `${from} – ${day(end)}, until ${endTime}`;
  return `${from} – ${day(end)}${endTime ? `, ${endTime}` : ""}`;
}

export type FactTimingCopy = { label: string; tone: "info" | "success" | "neutral" };

export const FACT_TIMING_COPY: Record<NonNullable<AiFact["timing"]>, FactTimingCopy> = {
  upcoming: { label: "Upcoming", tone: "info" },
  current: { label: "Running now", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
};

/** The main line of a fact in the list: its title, else its text. */
export function factHeadline(fact: AiFact): string {
  return (isDatedKind(fact.kind) ? fact.title : fact.text)?.trim() || FACT_KIND_COPY[fact.kind].label;
}

/**
 * Why the AI can't use an offer (2026-11-17, `offer_refusal`): the business's categories, or the regulated word
 * the offer's own text names ("Offers can't name cocktails (alcohol)"). Null when it may.
 */
export function offerRefusalText(refusal: AiFact["offer_refusal"]): string | null {
  if (!refusal) return null;
  if (refusal.reason === "offer_not_allowed_for_lodging") return "Google doesn't allow offers for hotels and other lodging";
  if (refusal.term) return `Offers can't name ${refusal.term}${refusal.sector ? ` (${refusal.sector})` : ""}`;
  return refusal.sector ? `Google restricts offers for ${refusal.sector}` : "Google restricts offers for regulated products";
}

/** Why the AI doesn't see a fact (`in_fact_sheet: false`), in a few words; null when it does. */
export function hiddenReason(fact: AiFact, offers: AiFactsList["offers"] | null | undefined): string | null {
  if (fact.in_fact_sheet) return null;
  if (!fact.active) return "Switched off";
  if (fact.timing === "ended") return "It has ended";
  const refusal = offerRefusalText(fact.offer_refusal);
  if (refusal) return refusal;
  if (fact.kind === "offer" && offers && !offers.allowed) return "Offers aren't allowed for this business";
  if (fact.kind === "offer") return "Google doesn't allow this offer";
  return null;
}

/** Phase 25b: a fact made from a confirmed business brief suggestion (`source_ref: "brief:<itemId>"`). */
export function isFromBrief(fact: Pick<AiFact, "source_ref">): boolean {
  return typeof fact.source_ref === "string" && fact.source_ref.startsWith("brief:");
}

/** Why "Add an offer" is left out, from `offers` (null while offers are allowed). */
export function offersRefusedText(offers: AiFactsList["offers"] | null | undefined): string | null {
  if (!offers || offers.allowed) return null;
  if (offers.reason === "offer_not_allowed_for_lodging") return "Google doesn't allow offers for hotels and other lodging, so you can't add offers here. Add an event or a fact instead.";
  return `Google restricts offers for ${offers.sector ?? "regulated products"}, so you can't add offers for this business. Add an event or a fact instead.`;
}
