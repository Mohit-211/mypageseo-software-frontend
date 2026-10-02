/**
 * Dashboard view model: what the dashboard design renders. Built from the live
 * `GET /dashboard` response, enriched with the focus location's GBP report and
 * Rank Tracker (business) and the report counts (agency). A value the backend
 * doesn't provide yet is `null` and shows as "—".
 */
import type {
  AgencyDashboard as LiveAgency,
  BusinessDashboard as LiveBusiness,
  DashboardAction,
  GbpReport,
  RankTrackerResponse,
} from "@/api";
import { formatShortDate } from "@/lib/datetime";
import { locationSetupPath } from "@/lib/locations/location-actions";

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

export type BusinessDashboard = {
  kind: "business";
  comparisonLabel: string;
  /** The location the detail panels describe (the header's, else the first). */
  focusLocationId: string | null;
  visibilityScore: MetricPoint;
  averageRank: MetricPoint;
  gbpHealth: MetricPoint;
  reviewRating: MetricPoint;
  reviewCount: number | null;
  citationHealth: MetricPoint;
  rankMovement: { improved: number; declined: number; unchanged: number; tracked: number | null };
  rankSeries: RankSeriesPoint[];
  gbpFactors: GbpFactor[];
  reviews: { unanswered: number | null; last30Days: number | null; averageResponseHours: number | null };
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
  unansweredReviews: number | null;
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
    unansweredReviews: number | null;
    gbpIssues: number;
    reports: { ready: number | null; scheduled: number | null; failed: number | null };
  };
  portfolio: PortfolioRow[];
  actions: RecommendedAction[];
};

export type DashboardData = BusinessDashboard | AgencyDashboard;

const COMPARISON_LABEL = "Latest ranking run and report vs the previous one";

const ACTION_LABEL: Record<string, string> = {
  ranking: "Inspect rankings",
  gbp: "Open audit",
  reviews: "Open reviews",
  citations: "Open citations",
  setup: "Finish setup",
  connection: "Reconnect Google",
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
    comparisonLabel: COMPARISON_LABEL,
    focusLocationId: focus.locationId,
    visibilityScore: { label: "Local Visibility", value: pct(visibility?.top3_rate), change: null },
    averageRank: { label: "Average Rank", value: visibility?.avg_rank ?? null, change: visibility?.change == null ? null : -visibility.change },
    gbpHealth: { label: "GBP Health", value: live.gbp.available ? live.gbp.score : null, change: live.gbp.available ? live.gbp.change : null },
    reviewRating: {
      label: "Review Rating",
      value: reviews.available ? reviews.rating : ("public_rating" in reviews ? (reviews.public_rating ?? null) : null),
      change: null,
    },
    reviewCount: reviews.available ? reviews.count : ("public_review_count" in reviews ? (reviews.public_review_count ?? null) : null),
    citationHealth: { label: "Citation Health", value: citations?.available ? citations.score : null, change: null },
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
      last30Days: reportReviews?.new_30d ?? null,
      averageResponseHours: reportReviews?.median_reply_hours == null ? null : Math.round(reportReviews.median_reply_hours),
    },
    competitors: competitorRows(focus.tracker, focus.report, focus.name),
    actions: live.recommended_actions.map((action) => toAction(action, live.locations_count > 1)),
  };
}

export function toAgencyDashboard(
  live: LiveAgency,
  reports: { ready: number | null; scheduled: number | null; failed: number | null },
  areas: Map<string, string>,
): AgencyDashboard {
  const issuesByLocation = new Map(live.gbp_issues.map((row) => [row.location_id, row.issues.length]));
  const unanswered = live.table.rows.reduce<number | null>((sum, row) => (row.reviews ? (sum ?? 0) + row.reviews.awaiting_attention : sum), null);
  return {
    kind: "agency",
    comparisonLabel: COMPARISON_LABEL,
    clientCount: live.clients_count,
    locationCount: live.locations_count,
    averageVisibility: { label: "Avg. Visibility", value: pct(live.portfolio.avg_top3_rate), change: null },
    averageGbpHealth: { label: "Avg. GBP Health", value: live.portfolio.avg_gbp_score, change: live.portfolio.avg_gbp_score_change },
    attention: {
      decliningLocations: live.declines.length,
      unansweredReviews: live.reviews?.available ? (live.reviews.awaiting_attention ?? unanswered) : unanswered,
      gbpIssues: live.gbp_issues.length,
      reports,
    },
    portfolio: live.table.rows.map((row) => ({
      clientId: row.client?.client_id ?? null,
      clientName: row.client?.name ?? "No client",
      locationId: row.location_id,
      locationName: row.name,
      area: areas.get(row.location_id) ?? "",
      visibility: pct(row.visibility?.top3_rate),
      visibilityChange: null,
      gbpHealth: row.gbp?.score ?? null,
      unansweredReviews: row.reviews ? row.reviews.awaiting_attention : null,
      openIssues: issuesByLocation.get(row.location_id) ?? 0,
    })),
    actions: live.recommended_actions.map((action) => toAction(action, true)),
  };
}
