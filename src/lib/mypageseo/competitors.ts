import { withDemoFallback } from "./demo/demo-mode";
import { demoCompetitorDetail, demoCompetitorsData } from "./demo/competitors";

export type CompetitorsStatus = "loading" | "ready" | "no_competitors" | "error";

/** How a competitor entered the workspace, as reported by the backend. */
export type CompetitorSource = "tracked" | "discovered";

export type CompetitorRow = {
  id: string;
  businessName: string;
  isSelectedBusiness: boolean;
  category: string | null;
  area: string | null;
  source: CompetitorSource | null;
  /** Average local pack position across tracked keywords. */
  averagePosition: number | null;
  visibility: number | null;
  reviewCount: number | null;
  rating: number | null;
  citationCoverage: number | null;
  gbpHealth: number | null;
};

export type CompetitiveSummary = {
  trackedCompetitors: number | null;
  averageCompetitorPosition: number | null;
  yourAveragePosition: number | null;
  relativeRank: number | null;
  yourReviewCount: number | null;
  averageCompetitorReviewCount: number | null;
};

export type CompetitiveInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "advantage" | "gap" | "neutral";
  competitorId: string | null;
};

export type CompetitorsCapabilities = {
  canSearch: boolean;
  canFilterByCategory: boolean;
  canTrackCompetitors: boolean;
  canRemoveCompetitors: boolean;
  hasDetailView: boolean;
};

export type CompetitorsData = {
  status: CompetitorsStatus;
  lastCheckedAt: string | null;
  summary: CompetitiveSummary;
  competitors: CompetitorRow[];
  insights: CompetitiveInsight[];
  capabilities: CompetitorsCapabilities;
};

/**
 * The live competitor discovery/tracking feed is not connected in this
 * frontend, so this adapter falls back to a deterministic demo dataset scoped
 * to the active location.
 */
export function getCompetitors(locationId?: string | null, real?: CompetitorsData | null): CompetitorsData {
  return withDemoFallback(real, () => demoCompetitorsData(locationId));
}

export const COMPETITOR_SOURCE_LABEL: Record<CompetitorSource, string> = {
  tracked: "Manually tracked",
  discovered: "Discovered from local search results",
};

export const COMPETITORS_PAGE_SIZE = 25;

export type CompetitorDetailStatus = "loading" | "ready" | "partial" | "not_found" | "error";

export type MetricComparison = {
  id: string;
  label: string;
  /** Metric value for the selected Mypageseo location. */
  yours: number | null;
  /** Metric value for the competitor. */
  theirs: number | null;
  unit: "count" | "percent" | "position" | "rating" | "score" | null;
  /** Whether a lower value is the better outcome (positions, for example). */
  lowerIsBetter: boolean;
};

export type CompetitorKeywordComparison = {
  id: string;
  keyword: string;
  resultType: string | null;
  yourPosition: number | null;
  yourPreviousPosition: number | null;
  theirPosition: number | null;
  theirPreviousPosition: number | null;
};

export type CompetitorGap = {
  id: string;
  title: string;
  detail: string;
  tone: "advantage" | "gap" | "neutral";
};

export type CompetitorTrendPoint = {
  period: string;
  yourAveragePosition: number | null;
  theirAveragePosition: number | null;
};

export type CompetitorProfile = {
  id: string;
  businessName: string;
  category: string | null;
  area: string | null;
  website: string | null;
  source: CompetitorSource | null;
  /** Only used when the backend genuinely supplies a score, with its meaning. */
  score: number | null;
  scoreExplanation: string | null;
};

export type CompetitorDetailCapabilities = {
  canEdit: boolean;
  canUntrack: boolean;
};

export type CompetitorDetailData = {
  status: CompetitorDetailStatus;
  competitor: CompetitorProfile | null;
  lastUpdatedAt: string | null;
  metrics: MetricComparison[];
  keywords: CompetitorKeywordComparison[];
  reviewMetrics: MetricComparison[];
  citationMetrics: MetricComparison[];
  gbpMetrics: MetricComparison[];
  websiteMetrics: MetricComparison[];
  gaps: CompetitorGap[];
  trend: CompetitorTrendPoint[];
  capabilities: CompetitorDetailCapabilities;
};

/**
 * The live competitor record source is not connected in this frontend, so
 * this falls back to the deterministic demo comparison for the requested
 * competitor.
 */
export function getCompetitorDetail(
  competitorId: string,
  locationId?: string | null,
  real?: CompetitorDetailData | null,
): CompetitorDetailData {
  return withDemoFallback(real, () => demoCompetitorDetail(competitorId, locationId));
}
