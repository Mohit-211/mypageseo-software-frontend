/**
 * Order and filters of the Keywords table. The default is "Your order", the saved list, because that
 * order is the AI priority (see `usage-rules.ts`); every other sort ends with a stable tie-break.
 */
import { byChange, byRank } from "@/lib/rankings/rank-sort";
import { byNumber, byText, sortRows, type SortDirection } from "@/lib/sort";
import type { KeywordBand } from "./bands";
import { keywordKey } from "./keywords";
import type { KeywordSortKey } from "./paths";
import type { KeywordRow, SearchTerm } from "./use-keywords";

export const KEYWORD_SORT_FIRST_ORDER: Record<KeywordSortKey, SortDirection> = {
  priority: "asc",
  keyword: "asc",
  rank: "asc",
  change: "desc",
  top3: "desc",
  searches: "desc",
};

/** For the sort menu (phones, where the column headers aren't shown). */
export const KEYWORD_SORT_LABEL: Record<KeywordSortKey, string> = {
  priority: "Your order (AI priority)",
  keyword: "Keyword A–Z",
  rank: "Best rank first",
  change: "Biggest improvement",
  top3: "Top 3 rate",
  searches: "Most Google searches",
};

/** A search term's count for sorting: "fewer than 15" sorts just below 15. */
function searchesValue(term: SearchTerm | null): number | null {
  if (!term) return null;
  if (term.value != null) return term.value;
  return term.threshold != null ? term.threshold - 1 : null;
}

export function sortKeywordRows(rows: readonly KeywordRow[], sort: KeywordSortKey, order: SortDirection): KeywordRow[] {
  const byPosition = byNumber<KeywordRow>((row) => row.position);
  const byName = byText<KeywordRow>((row) => row.text);
  switch (sort) {
    case "keyword":
      return sortRows(rows, byText((row) => row.text, order), byPosition);
    case "rank":
      return sortRows(rows, byRank((row) => row.self, order), byName, byPosition);
    case "change":
      return sortRows(rows, byChange((row) => row.self, order), byRank((row) => row.self), byName);
    case "top3":
      return sortRows(rows, byNumber((row) => row.self?.top3Rate, order), byRank((row) => row.self), byName);
    case "searches":
      return sortRows(rows, byNumber((row) => searchesValue(row.searches), order), byName);
    default:
      return sortRows(rows, byNumber((row) => row.position, order));
  }
}

export type KeywordFilters = { q?: string; groupId?: string | null; band?: KeywordBand | null };

export function filterKeywordRows(rows: readonly KeywordRow[], filters: KeywordFilters): KeywordRow[] {
  const needle = filters.q ? keywordKey(filters.q) : "";
  return rows.filter(
    (row) =>
      (!needle || row.key.includes(needle)) &&
      (!filters.groupId || row.groups.some((group) => group.group_id === filters.groupId)) &&
      (!filters.band || row.band === filters.band),
  );
}
