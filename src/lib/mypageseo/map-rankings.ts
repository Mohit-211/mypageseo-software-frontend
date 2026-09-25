import { withDemoFallback } from "./demo/demo-mode";
import { demoMapRankings } from "./demo/rankings";

export type MapRankingStatus =
  | "loading"
  | "ready"
  | "no_keywords"
  | "geographic_data_unavailable"
  | "keyword_no_data"
  | "error";

export type MapRankingResultType = "google_maps" | "local_finder";

export type MapRankingKeyword = {
  id: string;
  label: string;
};

export type MapSearchContext = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type MapRankingPoint = {
  id: string;
  latitude: number;
  longitude: number;
  rank: number | null;
  previousRank: number | null;
  isSelectedBusiness: boolean;
};

export type MapRankingResult = {
  id: string;
  businessName: string;
  position: number;
  previousPosition: number | null;
  isSelectedBusiness: boolean;
};

export type MapRankingData = {
  status: MapRankingStatus;
  keywords: MapRankingKeyword[];
  searchContexts: MapSearchContext[];
  dates: string[];
  comparisonDates: string[];
  resultTypes: MapRankingResultType[];
  selectedKeyword: MapRankingKeyword | null;
  selectedSearchContext: MapSearchContext | null;
  selectedDate: string | null;
  comparisonDate: string | null;
  resultType: MapRankingResultType | null;
  currentRank: number | null;
  previousRank: number | null;
  points: MapRankingPoint[];
  results: MapRankingResult[];
};

/**
 * Geographic ranking collection is not connected in this frontend yet, so
 * this adapter falls back to a deterministic demo map result. A genuine
 * "no keywords" state is still returned untouched once a real source exists.
 */
export function getMapRankings(
  locationId?: string | null,
  real?: MapRankingData | null,
): MapRankingData {
  return withDemoFallback(real, () => demoMapRankings(locationId));
}
