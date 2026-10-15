/** Number and date formatting for the client page (the reader's own locale). */

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value: string | null | undefined, fallback = "—") => {
  const date = toDate(value);
  return date ? dateFormat.format(date) : fallback;
};

export const formatShortDate = (value: string | null | undefined, fallback = "—") => {
  const date = toDate(value);
  return date ? shortDateFormat.format(date) : fallback;
};

/** "2026-09" or a date → "September 2026". */
export const formatMonth = (value: string | null | undefined, fallback = "—") => {
  const date = toDate(value && /^\d{4}-\d{2}$/.test(value) ? `${value}-01T12:00:00Z` : value);
  return date ? monthFormat.format(date) : fallback;
};

export const formatNumber = (value: number | null | undefined, fallback = "—") =>
  value === null || value === undefined || !Number.isFinite(value) ? fallback : value.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** A rate stored as a fraction (0.42) → "42%". */
export const formatRate = (value: number | null | undefined, fallback = "—") =>
  value === null || value === undefined || !Number.isFinite(value) ? fallback : `${Math.round(value * 100)}%`;

/** An average Maps position; 61 means "not in the top 60". */
export const formatRank = (value: number | null | undefined, fallback = "—") =>
  value === null || value === undefined ? fallback : value > 60 ? "60+" : value.toFixed(1).replace(/\.0$/, "");

/** A fraction change (0.068) → "+6.8%". */
export const formatPercentChange = (change: number | null | undefined): string | null => {
  if (change === null || change === undefined || !Number.isFinite(change)) return null;
  const pct = change * 100;
  const size = Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Number(Math.abs(pct).toFixed(1));
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${size}%`;
};

/** The website's host for display ("www.example.com/x" → "example.com"). */
export const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`;
