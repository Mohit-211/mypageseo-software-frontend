import { demoLatency, useResource } from "../mypageseo/resource";
import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoAgencyDashboard, demoBusinessDashboard } from "../mypageseo/demo/dashboard";
import { AccountType } from "../mypageseo/navigation";

/**
 * Dashboard data contract.
 *
 * These types describe the shape the dashboard renders. The values below are
 * representative interface data used until the existing backend read is wired
 * up; swap `loadDashboard` for that call and the UI needs no changes.
 */

export type MetricPoint = {
  label: string;
  value: number;
  /** Change vs. the comparison period. Omitted when no comparison exists. */
  change?: number;
};

export type RankSeriesPoint = {
  period: string;
  averageRank: number;
  previousAverageRank?: number;
};

export type GbpFactor = {
  label: string;
  score: number;
  status: "healthy" | "attention" | "critical";
  detail: string;
};

export type RecommendedAction = {
  id: string;
  title: string;
  reason: string;
  severity: "critical" | "attention" | "info";
  to: "/rankings/keywords" | "/gbp/audit" | "/gbp/reviews" | "/citations" | "/competitors";
  actionLabel: string;
};

export type CompetitorRow = {
  name: string;
  isYou?: boolean;
  averageRank: number;
  rating: number;
  reviews: number;
  photos: number;
};

export type BusinessDashboard = {
  kind: "business";
  comparisonLabel: string;
  visibilityScore: MetricPoint;
  averageRank: MetricPoint;
  gbpHealth: MetricPoint;
  reviewRating: MetricPoint;
  reviewCount: number;
  citationHealth: MetricPoint;
  rankMovement: { improved: number; declined: number; unchanged: number; tracked: number };
  rankSeries: RankSeriesPoint[];
  gbpFactors: GbpFactor[];
  reviews: { unanswered: number; last30Days: number; averageResponseHours: number | null };
  competitors: CompetitorRow[];
  actions: RecommendedAction[];
};

export type PortfolioRow = {
  clientId: string;
  clientName: string;
  locationId: string;
  locationName: string;
  area: string;
  visibility: number;
  visibilityChange: number;
  gbpHealth: number;
  unansweredReviews: number;
  openIssues: number;
};

export type AgencyDashboard = {
  kind: "agency";
  comparisonLabel: string;
  clientCount: number;
  locationCount: number;
  averageVisibility: MetricPoint;
  averageGbpHealth: MetricPoint;
  attention: {
    decliningLocations: number;
    unansweredReviews: number;
    gbpIssues: number;
    reports: { ready: number; scheduled: number; failed: number };
  };
  portfolio: PortfolioRow[];
  actions: RecommendedAction[];
};

export type DashboardData = BusinessDashboard | AgencyDashboard;

export type ComparisonRange = "7d" | "28d" | "90d";

export const comparisonRanges: { value: ComparisonRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "28d", label: "Last 28 days" },
  { value: "90d", label: "Last 90 days" },
];

/**
 * Loads the dashboard for the active account type.
 *
 * The backend read is not connected in this frontend yet, so the demo data
 * layer supplies the response shape. Replace `real` with the backend call and
 * the demo fallback drops out on its own.
 */
export async function loadDashboard(
  accountType: AccountType,
  range: ComparisonRange,
  locationId?: string | null,
): Promise<DashboardData> {
  const real: DashboardData | null = null;
  if (real) return real;
  await demoLatency(450);
  return withDemoFallback(real, () =>
    accountType === "agency" ? demoAgencyDashboard() : demoBusinessDashboard(locationId),
  );
}

/**
 * Dashboard read. Failures are classified into customer-facing copy and never
 * turned into an empty success state.
 */
export function useDashboardData(
  accountType: AccountType,
  range: ComparisonRange,
  locationId?: string | null,
) {
  return useResource(() => loadDashboard(accountType, range, locationId), [
    accountType,
    range,
    locationId,
  ]);
}
