import { withDemoFallback } from "./demo/demo-mode";
import { demoRankingOverview } from "./demo/rankings";

export type RankingOverviewStatus = "loading" | "ready" | "no_keywords" | "no_data" | "error";
export type RankingMovement = "improved" | "declined" | "unchanged";
export type RankingResultType = "google" | "local_finder";

export type RankingMetric = {
  value: number;
  change: number | null;
};

export type RankingHistoryPoint = {
  date: string;
  averagePosition: number;
  comparisonPosition: number | null;
};

export type RankingBucket = {
  label: string;
  count: number;
};

export type RankingKeywordRow = {
  id: string;
  keyword: string;
  previousPosition: number | null;
  currentPosition: number | null;
  movement: number | null;
  resultType: string | null;
};

export type RankingOverviewData = {
  status: RankingOverviewStatus;
  comparisonLabel: string | null;
  metrics: {
    averageGooglePosition: RankingMetric | null;
    keywordMovement: RankingMetric | null;
    positionalMovement: RankingMetric | null;
    localPackCoverage: RankingMetric | null;
  };
  history: RankingHistoryPoint[];
  distribution: RankingBucket[];
  topMovers: RankingKeywordRow[];
  snapshot: RankingKeywordRow[];
};

/**
 * The live ranking service is not connected in this frontend yet, so this
 * adapter falls back to a deterministic demo overview. Genuine "no keywords
 * tracked" states are still returned untouched once a real source exists.
 */
export function getRankingOverview(
  locationId?: string | null,
  real?: RankingOverviewData | null,
): RankingOverviewData {
  return withDemoFallback(real, () => demoRankingOverview(locationId));
}
