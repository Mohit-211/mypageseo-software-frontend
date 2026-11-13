/**
 * A location's tracked keywords: the rules the backend applies to `PUT tracking { keywords }`, in one
 * place, so every editor (the Keywords page, the setup wizard, "Track" buttons) agrees before saving.
 *
 * The saved list is ordered, and the order matters: AI posts and AI review replies take the first
 * keywords (see `usage-rules.ts`). `PUT` replaces the whole list; reordering or re-casing keeps
 * `keywords_version` (no new ranking history), adding or removing a keyword bumps it.
 */

/**
 * Tracked keywords per location: the backend's `RANK_MAX_KEYWORDS` default (a master setting, 1–50).
 * The API doesn't expose the cap yet (a backend ask), so this is the only place it is written down.
 */
export const MAX_KEYWORDS = 20;
export const MIN_KEYWORD_LENGTH = 2;
export const MAX_KEYWORD_LENGTH = 80;

export type KeywordAddResult = {
  /** The list with the new keywords appended. */
  keywords: string[];
  added: string[];
  /** Why some weren't added, ready to show; null when everything was added. */
  message: string | null;
};

/**
 * Adds what the user typed. Several keywords can go in at once, separated by ";" (or new lines,
 * for a pasted list): "clean; cleaner" or "cleaning;janitor" add two keywords each. Spaces are
 * tidied, duplicates are skipped (see `sameKeyword`), and the list stops at `max`.
 */
export function addKeywords(current: readonly string[], input: string, max = MAX_KEYWORDS): KeywordAddResult {
  const parts = input
    .split(/[;\n]/)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const keywords = [...current];
  const added: string[] = [];
  const duplicates: string[] = [];
  const badLength: string[] = [];
  let overLimit = 0;

  for (const part of parts) {
    if (part.length < MIN_KEYWORD_LENGTH || part.length > MAX_KEYWORD_LENGTH) badLength.push(part);
    else if (keywords.some((keyword) => sameKeyword(keyword, part))) duplicates.push(part);
    else if (keywords.length >= max) overLimit += 1;
    else {
      keywords.push(part);
      added.push(part);
    }
  }

  const problems = [
    duplicates.length ? `${quoteList(duplicates)}: already in your list` : null,
    badLength.length
      ? `${quoteList(badLength)} ${badLength.length === 1 ? "needs" : "need"} ${MIN_KEYWORD_LENGTH}–${MAX_KEYWORD_LENGTH} characters`
      : null,
    overLimit ? `${overLimit} more didn't fit (up to ${max} keywords)` : null,
  ].filter(Boolean);
  return { keywords, added, message: problems.length ? `${problems.join("; ")}.` : null };
}

/**
 * The comparison form, the backend's rule: case and extra spaces don't count ("Clean", "CLEAN" and
 * "clean  " are one keyword), but a space inside a keyword does ("office cleaning" ≠ "officecleaning").
 */
export function keywordKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameKeyword(a: string, b: string): boolean {
  return keywordKey(a) === keywordKey(b);
}

/** Position of `keyword` in `list` by the backend's rule, or -1. */
export function indexOfKeyword(list: readonly string[], keyword: string): number {
  const key = keywordKey(keyword);
  return list.findIndex((entry) => keywordKey(entry) === key);
}

/** The list without `remove` (matched by the backend's rule). */
export function withoutKeywords(list: readonly string[], remove: readonly string[]): string[] {
  const keys = new Set(remove.map(keywordKey));
  return list.filter((entry) => !keys.has(keywordKey(entry)));
}

/** The list with the keyword at `from` moved to `to` (both clamped to the list). */
export function moveKeyword(list: readonly string[], from: number, to: number): string[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(Math.max(to, 0), next.length - 1);
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item!);
  return next;
}

/** “a”, “b”, “c” and 2 more. */
export function quoteList(values: readonly string[], shown = 3): string {
  const head = values.slice(0, shown).map((value) => `“${value}”`);
  const text = head.length <= 1 ? (head[0] ?? "") : `${head.slice(0, -1).join(", ")}${values.length > shown ? ", " : " and "}${head.at(-1)}`;
  return values.length > shown ? `${text} and ${values.length - shown} more` : text;
}
