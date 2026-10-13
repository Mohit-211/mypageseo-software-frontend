/** Tracked keywords per location (the backend's limit). */
export const MAX_KEYWORDS = 20;
const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

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
 * tidied, duplicates are skipped (see `sameKeyword`), and the list stops at `MAX_KEYWORDS`.
 */
export function addKeywords(current: string[], input: string, max = MAX_KEYWORDS): KeywordAddResult {
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
    if (part.length < MIN_LENGTH || part.length > MAX_LENGTH) badLength.push(part);
    else if (keywords.some((keyword) => sameKeyword(keyword, part))) duplicates.push(part);
    else if (keywords.length >= max) overLimit += 1;
    else {
      keywords.push(part);
      added.push(part);
    }
  }

  const problems = [
    duplicates.length ? `${quoteList(duplicates)}: already in your list` : null,
    badLength.length ? `${quoteList(badLength)} ${badLength.length === 1 ? "needs" : "need"} ${MIN_LENGTH}–${MAX_LENGTH} characters` : null,
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

function quoteList(values: string[]): string {
  const shown = values.slice(0, 3).map((value) => `“${value}”`).join(", ");
  return values.length > 3 ? `${shown} and ${values.length - 3} more` : shown;
}
