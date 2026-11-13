/**
 * Orders for ranking data (tables.md §5.5): best average first, "60+" after real positions and
 * "no data" last; leaderboards rank every business together (the caller highlights "you" in place);
 * ties fall back to the name A–Z so the order never jumps between renders.
 */
import { useState } from "react";
import type { ChangeLabel, RankStatus } from "@/api";
import { byNumber, byText, rankKey, sortRows, type Comparator, type SortDirection } from "@/lib/sort";

type RankLike = { avgRank?: number | null; status?: RankStatus | null | undefined } | null | undefined;
type ChangeLike = { change?: number | null; changeLabel?: ChangeLabel | null } | null | undefined;

/** Best average first in "asc"; "60+" (61) after every real position; no data last either way. */
export function byRank<T>(get: (row: T) => RankLike, direction: SortDirection = "asc"): Comparator<T> {
  return byNumber((row) => {
    const value = get(row);
    return rankKey(value?.avgRank, value?.status);
  }, direction);
}

/**
 * A change as a number for sorting (positive = improved). Entering the top 60 counts as the biggest
 * gain and dropping out as the biggest loss, since those have no number.
 */
export function changeKey(value: ChangeLike): number | null {
  if (value?.changeLabel === "entered_top_60") return 1000;
  if (value?.changeLabel === "dropped_out_of_top_60") return -1000;
  return value?.change ?? null;
}

/** Biggest improvement first in "desc". */
export function byChange<T>(get: (row: T) => ChangeLike, direction: SortDirection = "desc"): Comparator<T> {
  return byNumber((row) => changeKey(get(row)), direction);
}

/** The columns of a keyword ranking table. */
export type RankColumn = "keyword" | "rank" | "change" | "found" | "top3";

/** The first click on a column: names A–Z, ranks best first, everything else biggest first. */
export const RANK_COLUMN_FIRST_ORDER: Record<RankColumn, SortDirection> = {
  keyword: "asc",
  rank: "asc",
  change: "desc",
  found: "desc",
  top3: "desc",
};

type RankRowSummary = RankLike & ChangeLike & { foundRate?: number | null; top3Rate?: number | null };

/** Sorts keyword rows by a column, ties by keyword A–Z. */
export function sortRankRows<T>(
  rows: readonly T[],
  column: RankColumn,
  direction: SortDirection,
  get: { keyword: (row: T) => string; summary: (row: T) => RankRowSummary | null | undefined },
): T[] {
  const byKeyword = byText<T>(get.keyword);
  switch (column) {
    case "keyword":
      return sortRows(rows, byText(get.keyword, direction));
    case "change":
      return sortRows(rows, byChange((row) => get.summary(row), direction), byRank((row) => get.summary(row)), byKeyword);
    case "found":
      return sortRows(rows, byNumber((row) => get.summary(row)?.foundRate, direction), byRank((row) => get.summary(row)), byKeyword);
    case "top3":
      return sortRows(rows, byNumber((row) => get.summary(row)?.top3Rate, direction), byRank((row) => get.summary(row)), byKeyword);
    default:
      return sortRows(rows, byRank((row) => get.summary(row), direction), byKeyword);
  }
}

/** Businesses ranked best first, ties A–Z ("you" stays in its place; the caller highlights it). */
export function leaderboard<T>(rows: readonly T[], rank: (row: T) => RankLike, name: (row: T) => string): T[] {
  return sortRows(rows, byRank(rank), byText(name));
}

/**
 * Sort state for a table sorted in the browser (the whole data set is loaded): a new column starts
 * in its natural direction (`firstOrder`), the same column flips.
 */
export function useSortState<K extends string>(initial: K, firstOrder: Record<K, SortDirection>, initialOrder?: SortDirection) {
  const [state, setState] = useState<{ sort: K; order: SortDirection }>({ sort: initial, order: initialOrder ?? firstOrder[initial] });
  const onSort = (next: K) =>
    setState((current) =>
      current.sort === next ? { sort: next, order: current.order === "asc" ? "desc" : "asc" } : { sort: next, order: firstOrder[next] },
    );
  return { sort: state.sort, order: state.order, onSort, setSort: setState };
}
