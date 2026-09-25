import { withDemoFallback } from "./demo/demo-mode";
import { demoGbpOverview } from "./demo/gbp";

export type GbpOverviewStatus = "loading" | "ready" | "disconnected" | "error";
export type GbpItemStatus = "complete" | "attention" | "unavailable";

export type GbpProfileField = {
  label: string;
  value: string | null;
};

export type GbpHealthFactor = {
  id: string;
  label: string;
  status: GbpItemStatus;
  detail: string | null;
};

export type GbpAction = {
  id: string;
  title: string;
  description: string;
  destination: "audit" | "reviews" | "posts" | null;
};

export type GbpOverviewData = {
  status: GbpOverviewStatus;
  healthScore: number | null;
  healthLabel: string | null;
  healthFactors: GbpHealthFactor[];
  profile: GbpProfileField[];
  completeness: GbpHealthFactor[];
  reviews: {
    averageRating: number | null;
    total: number | null;
    unanswered: number | null;
    recentActivity: string | null;
  };
  media: {
    photoCount: number | null;
    status: string | null;
  };
  rankingContext: {
    localPackCoverage: number | null;
    detail: string | null;
  };
  actions: GbpAction[];
};

/**
 * The live Google Business Profile read is not connected in this frontend
 * yet, so this adapter falls back to a deterministic demo overview.
 */
export function getGbpOverview(
  locationId?: string | null,
  real?: GbpOverviewData | null,
): GbpOverviewData {
  return withDemoFallback(real, () => demoGbpOverview(locationId));
}
