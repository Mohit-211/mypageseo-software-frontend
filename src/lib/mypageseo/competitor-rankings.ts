import type { RankingMovement, RankingResultType } from "../raking-lib/ranking-overview";
import { withDemoFallback } from "./demo/demo-mode";
import { demoCompetitorRankings } from "./demo/rankings";

export type CompetitorRankingStatus = "loading" | "ready" | "no_competitors" | "no_data" | "error";
export type CompetitorRankingSort = "keyword" | "location" | "gap";
export type CompetitorRankingOrder = "asc" | "desc";

export type TrackedCompetitor = { id: string; name: string };
export type CompetitorPosition = {
  competitorId: string;
  currentPosition: number | null;
  previousPosition: number | null;
  movement: number | null;
  movementStatus: RankingMovement;
};
export type CompetitorRankingRow = {
  id: string;
  keyword: string;
  group: string | null;
  resultType: RankingResultType;
  locationPosition: number | null;
  locationPreviousPosition: number | null;
  locationMovement: number | null;
  locationMovementStatus: RankingMovement;
  competitorPositions: CompetitorPosition[];
};
export type CompetitorTrendPoint = { date: string; locationPosition: number | null; competitorPositions: Record<string, number | null> };

export type CompetitorRankingsData = {
  status: CompetitorRankingStatus;
  locationName: string | null;
  competitors: TrackedCompetitor[];
  groups: string[];
  dates: string[];
  comparisonPeriods: string[];
  resultTypes: RankingResultType[];
  comparisonAvailable: boolean;
  rows: CompetitorRankingRow[];
  trend: CompetitorTrendPoint[];
  total: number;
};

/**
 * Competitor ranking collection is not connected in this frontend yet, so
 * this adapter falls back to a deterministic demo comparison. A genuine
 * "no competitors tracked" state is still returned untouched once a real
 * source exists.
 */
export function getCompetitorRankings(
  locationId?: string | null,
  real?: CompetitorRankingsData | null,
): CompetitorRankingsData {
  return withDemoFallback(real, () => demoCompetitorRankings(locationId));
}
