import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoLocalSearchGrid } from "../mypageseo/demo/rankings";

export type LocalSearchGridStatus = "loading" | "ready" | "no_keywords" | "grid_data_unavailable" | "no_scans" | "error";
export type GridSearchType = "google_maps" | "local_finder";
export type GridKeyword = { id: string; label: string };
export type GridPoint = { id: string; row: number; column: number; latitude: number; longitude: number; rank: number | null; previousRank: number | null };
export type GridMetric = { value: number; change: number | null };
export type GridDistributionBucket = { label: string; count: number; range: "strong" | "visible" | "weak" | "unranked" };

export type LocalSearchGridData = {
  status: LocalSearchGridStatus;
  keywords: GridKeyword[];
  gridSizes: string[];
  radii: string[];
  searchTypes: GridSearchType[];
  scanDates: string[];
  comparisonDates: string[];
  selectedKeyword: GridKeyword | null;
  gridSize: string | null;
  radius: string | null;
  searchType: GridSearchType | null;
  scanDate: string | null;
  comparisonDate: string | null;
  geographicContext: string | null;
  rows: number;
  columns: number;
  points: GridPoint[];
  metrics: { averageRank: GridMetric | null; visibility: GridMetric | null; coverage: GridMetric | null };
  distribution: GridDistributionBucket[];
};

/**
 * Geographic scan collection is not connected in this frontend yet, so this
 * adapter falls back to a deterministic 7x7 demo grid. A genuine "no scans"
 * state is still returned untouched once a real source exists.
 */
export function getLocalSearchGrid(
  locationId?: string | null,
  real?: LocalSearchGridData | null,
): LocalSearchGridData {
  return withDemoFallback(real, () => demoLocalSearchGrid(locationId));
}
