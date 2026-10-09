/**
 * Dashboard view model: what the dashboard design renders. Built from the live
 * `GET /dashboard` response, enriched with the focus location's GBP report and
 * Rank Tracker (business). A value the backend doesn't provide is `null` and
 * shows as "—".
 */
import type {
  AgencyDashboard as LiveAgency,
  BusinessDashboard as LiveBusiness,
  DashboardAction,
  DashboardRange,
  GbpReport,
  PerformanceBlock,
  PerformanceFigures,
  RankTrackerResponse,
} from "@/api";
import { formatDate, formatShortDate } from "@/lib/datetime";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { citationsUnavailableText, coverageText } from "@/lib/citations/citations";

export type MetricPoint = {
  label: string;
  value: number | null;
  /** Change vs. the comparison period. Omitted when no comparison exists. */
  change?: number | null;
};

export type RankSeriesPoint = {
  period: string;
  averageRank: number | null;
  previousAverageRank?: number | null;
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
  to: string;
  actionLabel: string;
};

export type CompetitorRow = {
  name: string;
  isYou?: boolean;
  averageRank: number | null;
  rating: number | null;
  reviews: number | null;
  photos: string | null;
};

/** GBP performance over the selected period; `change` in percent. */
export type PerformanceView =
  | { available: true; days: number; latestDate: string | null; partial: boolean; metrics: (MetricPoint & { key: keyof PerformanceFigures; caption: string })[] }
  | { available: false; reason: string };

export type BusinessDashboard = {
  kind: "business";
  comparisonLabel: string;
  rangeDays: number;
  performance: PerformanceView;
  /** The location the detail panels describe (the header's, else the first). */
  focusLocationId: string | null;
  visibilityScore: MetricPoint;
  averageRank: MetricPoint;
  gbpHealth: MetricPoint;
  reviewRating: MetricPoint;
  reviewCount: number | null;
  citationHealth: MetricPoint;
  /** "5 of 6 checked", or why there's no score yet. */
  citationCaption: string;
  rankMovement: { improved: number; declined: number; unchanged: number; tracked: number | null };
  rankSeries: RankSeriesPoint[];
  gbpFactors: GbpFactor[];
  reviews: { unanswered: number | null; newInRange: number | null; averageResponseHours: number | null };
  competitors: CompetitorRow[];
  actions: RecommendedAction[];
};

export type PortfolioRow = {
  clientId: string | null;
  clientName: string;
  locationId: string;
  locationName: string;
  area: string;
  visibility: number | null;
  visibilityChange: number | null;
  gbpHealth: number | null;
  citationScore: number | null;
  citationNapWrong: number;
  unansweredReviews: number | null;
  openIssues: number;
};

export type AgencyDashboard = {
  kind: "agency";
  comparisonLabel: string;
  rangeDays: number;
  performance: PerformanceView;
  clientCount: number;
  locationCount: number;
  averageVisibility: MetricPoint;
  averageGbpHealth: MetricPoint;
  averageCitationScore: number | null;
  attention: {
    decliningLocations: number;
    unansweredReviews: number | null;
    gbpIssues: number;
    reports: { ready: number | null; scheduled: number | null; failed: number | null };
  };
  portfolio: PortfolioRow[];
  actions: RecommendedAction[];
};

export type DashboardData = BusinessDashboard | AgencyDashboard;

export const RANGE_DAYS: Record<DashboardRange, number> = { "15d": 15, "30d": 30, "60d": 60 };

const comparisonLabel = (range: DashboardRange) =>
  `Rankings vs the previous run · profile performance and reviews over the last ${RANGE_DAYS[range]} days vs the ${RANGE_DAYS[range]} before`;

const PERFORMANCE_METRICS: { key: keyof PerformanceFigures; label: string; caption: string }[] = [
  { key: "impressions", label: "Profile views", caption: "Times the profile was shown" },
  { key: "actions", label: "Customer actions", caption: "Calls, website clicks and directions" },
  { key: "calls", label: "Calls", caption: "Taps on the call button" },
  { key: "website_clicks", label: "Website clicks", caption: "Visits from the profile" },
  { key: "direction_requests", label: "Direction requests", caption: "Route requests to the business" },
];

function toPerformance(block: PerformanceBlock | undefined): PerformanceView {
  if (!block) return { available: false, reason: "no_data" };
  if (!block.available) return { available: false, reason: block.reason };
  const { coverage } = block;
  return {
    available: true,
    days: block.days,
    latestDate: block.latest_date ? formatDate(block.latest_date) : null,
    partial: coverage.current.days_with_data < coverage.current.days,
    metrics: PERFORMANCE_METRICS.map((metric) => {
      const change = block.change[metric.key];
      const caption =
        metric.key === "impressions"
          ? `${block.current.maps.toLocaleString()} on Maps · ${block.current.search.toLocaleString()} on Search`
          : metric.key === "actions" && block.current.actions_per_1000_impressions !== null
            ? `${block.current.actions_per_1000_impressions} per 1,000 views`
            : metric.caption;
      return { ...metric, caption, value: block.current[metric.key], change: change === null ? null : Math.round(change * 1000) / 10 };
    }),
  };
}

const ACTION_LABEL: Record<string, string> = {
  ranking: "Inspect rankings",
  gbp: "Open audit",
  reviews: "Open reviews",
  citations: "Open citations",
  posts: "Open posts",
  setup: "Finish setup",
  connection: "Reconnect Google",
};

/** Where each post action lands on the Posts page. */
const POST_ACTION_QUERY: Record<string, string> = {
  "posts:failed": "?tab=problems",
  "posts:approval": "?tab=pending_approval",
  "posts:stale": "?new=1",
  "posts:series_problem": "?view=auto",
};

function toAction(action: DashboardAction, showLocation: boolean): RecommendedAction {
  const id = action.location_id;
  const to = !id
    ? "/locations"
    : ({
        setup: locationSetupPath(id),
        ranking: `/locations/${id}/rankings`,
        gbp: `/locations/${id}/gbp/audit`,
        reviews: `/locations/${id}/reputation`,
        citations: `/locations/${id}/citations`,
        posts: `/locations/${id}/gbp/posts${POST_ACTION_QUERY[action.id] ?? ""}`,
        // The Google accounts panel (Reconnect) is on the Locations page.
        connection: "/locations",
      } as Record<string, string>)[action.source] ?? `/locations/${id}`;
  return {
    id: `${action.id}-${id ?? ""}`,
    title: action.title,
    reason: [action.detail, showLocation && action.location_name ? action.location_name : null].filter(Boolean).join(" · "),
    severity: action.impact >= 0.7 ? "critical" : action.impact >= 0.4 ? "attention" : "info",
    to,
    actionLabel: ACTION_LABEL[action.source] ?? "Open",
  };
}

const pct = (rate: number | null | undefined) => (rate == null ? null : Math.round(rate * 100));

const PILLAR_LABEL: Record<string, string> = {
  completeness: "Profile completeness",
  activity: "Activity",
  reviews: "Reviews",
  performance: "Performance",
};

/** GBP health factors from the focus location's GBP Score pillars. */
function gbpFactors(report: GbpReport | undefined): GbpFactor[] {
  if (!report?.gbp_score.available) return [];
  return report.gbp_score.pillars
    .filter((pillar) => pillar.available && pillar.score !== null)
    .map((pillar) => {
      const score = Math.round(((pillar.score ?? 0) / pillar.weight) * 100);
      const failing = report.gbp_score.available ? report.gbp_score.checks.filter((check) => check.pillar === pillar.id && check.state !== "pass" && check.state !== "not_available") : [];
      return {
        label: PILLAR_LABEL[pillar.id] ?? pillar.id,
        score,
        status: pillar.state === "pass" ? "healthy" : pillar.state === "fail" || score < 40 ? "critical" : "attention",
        detail: failing.length === 0 ? "All checks pass." : `To improve: ${failing.slice(0, 2).map((check) => check.label.toLowerCase()).join(", ")}${failing.length > 2 ? "…" : ""}.`,
      } satisfies GbpFactor;
    });
}

/** You and your tracked competitors: rank from the Rank Tracker, public facts from the GBP report. */
function competitorRows(tracker: RankTrackerResponse | undefined, report: GbpReport | undefined, selfName: string | null): CompetitorRow[] {
  const facts = report?.competitors.available ? report.competitors.rows : [];
  const targets = tracker?.targets ?? [];
  if (targets.length === 0) {
    return facts.map((row) => ({
      name: row.name ?? "Unnamed business",
      isYou: row.is_self,
      averageRank: null,
      rating: row.rating,
      reviews: row.user_rating_count,
      photos: row.photo_count == null ? null : row.photos_capped ? "10+" : String(row.photo_count),
    }));
  }
  return targets.map((target) => {
    const fact = facts.find((row) => row.place_id === target.place_id || (target.key === "self" && row.is_self));
    return {
      name: target.key === "self" ? (selfName ?? fact?.name ?? "Your business") : (target.name ?? fact?.name ?? "Competitor"),
      isYou: target.key === "self",
      averageRank: tracker?.overall[target.key]?.overallAvgRank ?? null,
      rating: fact?.rating ?? null,
      reviews: fact?.user_rating_count ?? null,
      photos: fact?.photo_count == null ? null : fact.photos_capped ? "10+" : String(fact.photo_count),
    };
  });
}

export function toBusinessDashboard(
  live: LiveBusiness,
  focus: { locationId: string | null; name: string | null; report?: GbpReport | undefined; tracker?: RankTrackerResponse | undefined },
): BusinessDashboard {
  const visibility = live.visibility;
  const reviews = live.reviews;
  const citations = live.citations;
  const movement = live.movement;
  const reportReviews = focus.report?.reviews.available ? focus.report.reviews : null;
  return {
    kind: "business",
    comparisonLabel: comparisonLabel(live.range),
    rangeDays: RANGE_DAYS[live.range] ?? 30,
    performance: toPerformance(live.performance),
    focusLocationId: focus.locationId,
    visibilityScore: { label: "Local Visibility", value: pct(visibility?.top3_rate), change: pct(visibility?.top3_rate_change) },
    averageRank: { label: "Average Rank", value: visibility?.avg_rank ?? null, change: visibility?.change == null ? null : -visibility.change },
    gbpHealth: { label: "GBP Health", value: live.gbp.available ? live.gbp.score : null, change: live.gbp.available ? live.gbp.change : null },
    reviewRating: {
      label: "Review Rating",
      value: reviews.available ? reviews.rating : ("public_rating" in reviews ? (reviews.public_rating ?? null) : null),
      change: reviews.available ? (reviews.rating_change ?? null) : null,
    },
    reviewCount: reviews.available ? reviews.count : ("public_review_count" in reviews ? (reviews.public_review_count ?? null) : null),
    citationHealth: { label: "Citation Health", value: citations?.available ? citations.score : null, change: citations?.available ? (citations.score_change ?? null) : null },
    citationCaption: !citations
      ? "Directory accuracy"
      : citations.available
        ? coverageText(citations.coverage, citations.listings)
        : citationsUnavailableText(citations.reason),
    rankMovement: {
      improved: (movement?.improved ?? 0) + (movement?.entered_top_60 ?? 0),
      declined: (movement?.declined ?? 0) + (movement?.dropped_out_of_top_60 ?? 0),
      unchanged: movement?.unchanged ?? 0,
      tracked: focus.tracker ? focus.tracker.keywords.length : null,
    },
    rankSeries: (visibility?.trend ?? []).map((point) => ({ period: formatShortDate(point.run_at), averageRank: point.avg_rank })),
    gbpFactors: gbpFactors(focus.report),
    reviews: {
      unanswered: reviews.available ? (reviews.awaiting_attention ?? reviews.unreplied ?? null) : null,
      newInRange: reviews.available ? (reviews.new_in_range ?? null) : null,
      averageResponseHours: reportReviews?.median_reply_hours == null ? null : Math.round(reportReviews.median_reply_hours),
    },
    competitors: competitorRows(focus.tracker, focus.report, focus.name),
    actions: live.recommended_actions.map((action) => toAction(action, live.locations_count > 1)),
  };
}

export function toAgencyDashboard(live: LiveAgency): AgencyDashboard {
  const issuesByLocation = new Map(live.gbp_issues.map((row) => [row.location_id, row.issues.length]));
  const unanswered = live.table.rows.reduce<number | null>((sum, row) => (row.reviews ? (sum ?? 0) + row.reviews.awaiting_attention : sum), null);
  return {
    kind: "agency",
    comparisonLabel: comparisonLabel(live.range),
    rangeDays: RANGE_DAYS[live.range] ?? 30,
    performance: toPerformance(live.performance),
    clientCount: live.clients_count,
    locationCount: live.locations_count,
    averageVisibility: { label: "Avg. Visibility", value: pct(live.portfolio.avg_top3_rate), change: pct(live.portfolio.avg_top3_rate_change) },
    averageGbpHealth: { label: "Avg. GBP Health", value: live.portfolio.avg_gbp_score, change: live.portfolio.avg_gbp_score_change },
    averageCitationScore: live.portfolio.avg_citation_score ?? null,
    attention: {
      decliningLocations: live.declines.length,
      unansweredReviews: live.reviews?.available ? (live.reviews.awaiting_attention ?? unanswered) : unanswered,
      gbpIssues: live.gbp_issues.length,
      reports: live.reports ?? { ready: null, scheduled: null, failed: null },
    },
    portfolio: live.table.rows.map((row) => ({
      clientId: row.client?.client_id ?? null,
      clientName: row.client?.name ?? "No client",
      locationId: row.location_id,
      locationName: row.name,
      area: row.city ?? "",
      visibility: pct(row.visibility?.top3_rate),
      visibilityChange: pct(row.visibility?.top3_rate_change),
      gbpHealth: row.gbp?.score ?? null,
      citationScore: row.citations?.score ?? null,
      citationNapWrong: row.citations?.nap_wrong ?? 0,
      unansweredReviews: row.reviews ? row.reviews.awaiting_attention : null,
      openIssues: issuesByLocation.get(row.location_id) ?? 0,
    })),
    actions: live.recommended_actions.map((action) => toAction(action, true)),
  };
}
