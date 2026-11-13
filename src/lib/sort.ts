/**
 * Shared, null-safe comparators for lists and tables.
 *
 * Missing values (null, undefined, NaN, empty text, unparsable dates) always sort last,
 * in both directions, so "no data" never floats to the top of a table.
 * Compose with `chain()` and always end with a stable tie-breaker (an id or a name).
 */
export type SortDirection = "asc" | "desc";
export type Comparator<T> = (a: T, b: T) => number;

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/** 0 when both are present-or-missing alike is undecided (null), else missing goes last. */
function missingLast(a: unknown, b: unknown): number | null {
  const aMissing = isMissing(a);
  const bMissing = isMissing(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return null;
}

/** Milliseconds since the epoch for an ISO string, a Date or a number; null when unusable. */
export function toTime(value: string | number | Date | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const time = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function byNumber<T>(get: (row: T) => number | null | undefined, direction: SortDirection = "asc"): Comparator<T> {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    const missing = missingLast(x, y);
    if (missing !== null) return missing;
    const diff = (x as number) - (y as number);
    return direction === "asc" ? diff : -diff;
  };
}

/** Dates and timestamps. Newest first by default, the order people expect in a feed. */
export function byTime<T>(get: (row: T) => string | number | Date | null | undefined, direction: SortDirection = "desc"): Comparator<T> {
  return byNumber((row) => toTime(get(row)), direction);
}

/** Human text: case-insensitive, accent-insensitive, numbers in natural order ("Store 2" before "Store 10"). */
export function byText<T>(get: (row: T) => string | null | undefined, direction: SortDirection = "asc"): Comparator<T> {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    const missing = missingLast(x, y);
    if (missing !== null) return missing;
    const result = collator.compare(x as string, y as string);
    return direction === "asc" ? result : -result;
  };
}

/** Booleans: `true` first by default (e.g. "active" series before paused ones). */
export function byBoolean<T>(get: (row: T) => boolean | null | undefined, trueFirst = true): Comparator<T> {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    const missing = missingLast(x, y);
    if (missing !== null) return missing;
    if (x === y) return 0;
    return (x ? -1 : 1) * (trueFirst ? 1 : -1);
  };
}

/** Applies comparators in order until one decides. */
export function chain<T>(...comparators: Comparator<T>[]): Comparator<T> {
  return (a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };
}

/** A sorted copy (the input is never mutated). */
export function sortRows<T>(rows: readonly T[], ...comparators: Comparator<T>[]): T[] {
  return [...rows].sort(chain(...comparators));
}

/**
 * Sort key for a Google Maps position: the number itself; "not in the top 60" counts as 61
 * (after every real position); no data is null (sorted last).
 */
export function rankKey(value: number | null | undefined, status?: string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (status === "not_found") return 61;
  return null;
}
