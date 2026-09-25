import type { RankingMovement, RankingResultType } from "../raking-lib/ranking-overview";
import { withDemoFallback } from "./demo/demo-mode";
import { demoKeywordRankings } from "./demo/rankings";

export type KeywordRankingStatus = "loading" | "ready" | "no_keywords" | "no_data" | "error";
export type KeywordSort = "keyword" | "current" | "previous" | "movement";
export type SortOrder = "asc" | "desc";

export type KeywordRankingRow = {
  id: string;
  keyword: string;
  group: string | null;
  resultType: RankingResultType;
  currentPosition: number | null;
  previousPosition: number | null;
  movement: number | null;
  movementStatus: RankingMovement;
  comparisonAvailable: boolean;
};

export type KeywordRankingsData = {
  status: KeywordRankingStatus;
  comparisonLabel: string | null;
  groups: string[];
  rows: KeywordRankingRow[];
  total: number;
};

/**
 * The keyword ranking collection service is not connected in this frontend
 * yet, so this adapter falls back to a deterministic demo table. A genuine
 * "no keywords tracked" state is still returned untouched once a real source
 * exists.
 */
export function getKeywordRankings(
  locationId?: string | null,
  real?: KeywordRankingsData | null,
): KeywordRankingsData {
  return withDemoFallback(real, () => demoKeywordRankings(locationId));
}
