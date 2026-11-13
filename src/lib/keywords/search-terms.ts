/**
 * How Google's search terms read (the GBP report's `keywords.top`), the same on every screen that
 * shows them: the Keywords page, GBP Overview, the keyword sheet and the keyword table. Google gives
 * an exact monthly count or, for small numbers, only "fewer than N".
 */
import type { SearchKeywordsSection } from "@/api";

type TermCount = Pick<SearchKeywordsSection["top"][number], "value" | "threshold">;

/** "1,204", "Fewer than 15", or "—". After other words on the same line (`inline`), "fewer than 15". */
export function searchCountText(term: TermCount, { inline = false }: { inline?: boolean } = {}): string {
  if (term.value != null) return term.value.toLocaleString();
  if (term.threshold != null) return `${inline ? "fewer" : "Fewer"} than ${term.threshold.toLocaleString()}`;
  return "—";
}

/** The explanation next to "Searches". */
export const SEARCHES_TIP = "Google reports small numbers as “fewer than N” to protect searchers' privacy.";
