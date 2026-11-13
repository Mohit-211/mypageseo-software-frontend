/**
 * Dashboard view models: what the "Today" dashboard renders, built from the live `GET /dashboard`
 * answer (one shape per organization type). A value the backend doesn't have yet is `null` and
 * shows as "—", never as 0. Every block follows the same scope (all locations, or `?location=`).
 */
import type {
  AgencyDashboard as LiveAgency,
  AgencyTableRow,
  BusinessDashboard as LiveBusiness,
  CitationsBlock,
  DashboardRange,
  LocationStatus,
  PerformanceBlock,
  PerformanceFigures,
  ReviewsBlock,
  StatusCounts,
} from "@/api";
import { citationsUnavailableText, coverageText } from "@/lib/citations/citations";
import { avgRankText } from "@/lib/rankings/format";
import { byNumber, byText, sortRows } from "@/lib/sort";
import { toNextSteps, type NextStep } from "./next-steps";

export const RANGE_DAYS: Record<DashboardRange, number> = { "15d": 15, "30d": 30, "60d": 60 };

/** The period picker. Plain words, never the API's "30d". */
export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "15d", label: "15 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
];

export const DEFAULT_RANGE: DashboardRange = "30d";

export function isDashboardRange(value: unknown): value is DashboardRange {
  return value === "15d" || value === "30d" || value === "60d";
}

/** 0–1 → whole percent (0.4 → 40). */
const pct = (rate: number | null | undefined) => (rate == null ? null : Math.round(rate * 100));

/* ------------------------------------------------------------------ performance -- */

export type PerformanceMetricKey = "impressions" | "actions" | "calls" | "website_clicks" | "direction_requests";

export type PerformanceMetric = {
  key: PerformanceMetricKey;
  label: string;
  value: number | null;
  /** Percent vs the previous period (12.5 = +12.5 %); null when not comparable. */
  change: number | null;
  caption: string;
};

/** Google Business Profile performance over the period, against the period before it. */
export type PerformanceView =
  | {
      available: true;
      days: number;
      /** The last day with data ("2026-09-23"): Google reports a few days late. */
      latestDate: string | null;
      partial: boolean;
      metrics: PerformanceMetric[];
      current: PerformanceFigures;
      previous: PerformanceFigures;
    }
  | { available: false; reason: string };

const PERFORMANCE_METRICS: { key: PerformanceMetricKey; label: string; caption: string }[] = [
  { key: "impressions", label: "Profile views", caption: "Times the profile was shown" },
  { key: "actions", label: "Customer actions", caption: "Calls, website clicks and directions" },
  { key: "calls", label: "Calls", caption: "Taps on the call button" },
  { key: "website_clicks", label: "Website clicks", caption: "Visits from the profile" },
  { key: "direction_requests", label: "Direction requests", caption: "Route requests to the business" },
];

function toPerformance(block: PerformanceBlock | undefined): PerformanceView {
  if (!block) return { available: false, reason: "no_data" };
  if (!block.available) return { available: false, reason: block.reason };
  return {
    available: true,
    days: block.days,
    latestDate: block.latest_date,
    partial: block.coverage.current.days_with_data < block.coverage.current.days,
    current: block.current,
    previous: block.previous,
    metrics: PERFORMANCE_METRICS.map((metric) => {
      const change = block.change[metric.key];
      const caption =
        metric.key === "impressions"
          ? `${block.current.maps.toLocaleString()} on Maps · ${block.current.search.toLocaleString()} on Search`
          : metric.key === "actions" && block.current.actions_per_1000_impressions !== null
            ? `${block.current.actions_per_1000_impressions} per 1,000 views`
            : metric.caption;
      return {
        ...metric,
        caption,
        value: block.current[metric.key],
        change: change == null ? null : Math.round(change * 1000) / 10,
      };
    }),
  };
}

/* ----------------------------------------------------------------------- shared -- */

/** Average Google Maps rank: lower is better; `change` is previous − current (positive = improved). */
export type RankView = {
  value: number | null;
  /** "12.4", "60+" or "No data". */
  text: string;
  change: number | null;
};

export type ScoreView =
  | { available: true; score: number | null; grade: string | null; change: number | null; partial: boolean }
  | { available: false; reason: string };

export type CitationView =
  | {
      available: true;
      score: number | null;
      grade: string | null;
      change: number | null;
      napWrong: number;
      notFound: number;
      /** "15 of 16 checked", or why there's no score yet. */
      caption: string;
    }
  | { available: false; reason: string; caption: string };

function toCitations(block: CitationsBlock | undefined): CitationView | null {
  if (!block) return null;
  if (!block.available) return { available: false, reason: block.reason, caption: citationsUnavailableText(block.reason) };
  return {
    available: true,
    score: block.score,
    grade: block.grade,
    change: block.score_change ?? null,
    napWrong: block.nap_wrong,
    notFound: block.not_found,
    caption: coverageText(block.coverage, block.listings),
  };
}

export type ReviewsView =
  | {
      available: true;
      rating: number | null;
      ratingChange: number | null;
      count: number | null;
      newInRange: number | null;
      /** Reviews without a published reply: "need a reply" (the Reviews page's "Needs reply" view). */
      unreplied: number | null;
      /**
       * "Urgent": the part of `unreplied` rated 1–3★, plus flagged reviews without a reply (the
       * backend's `awaiting_attention`). Worth answering first.
       */
      urgent: number | null;
      draftsPending: number | null;
      /** Urgent reviews per location (multi-location scopes), most first. */
      byLocation: { locationId: string; name: string; urgent: number; suspicious: number }[];
    }
  | { available: false; reason: string; publicRating: number | null; publicCount: number | null };

function toReviews(block: ReviewsBlock | undefined): ReviewsView | null {
  if (!block) return null;
  if (!block.available) {
    return { available: false, reason: block.reason, publicRating: block.public_rating ?? null, publicCount: block.public_review_count ?? null };
  }
  return {
    available: true,
    rating: block.rating,
    ratingChange: block.rating_change ?? null,
    count: block.count,
    newInRange: block.new_in_range ?? null,
    unreplied: block.unreplied ?? null,
    urgent: block.awaiting_attention ?? null,
    draftsPending: block.drafts_pending ?? null,
    byLocation: sortRows(
      (block.needs_attention ?? []).map((row) => ({ locationId: row.location_id, name: row.name, urgent: row.awaiting_attention, suspicious: row.suspicious })),
      byNumber((row) => row.urgent, "desc"),
      byText((row) => row.name),
    ),
  };
}

/* --------------------------------------------------------------------- business -- */

export type BusinessLocationRow = {
  locationId: string;
  name: string;
  city: string | null;
  status: LocationStatus;
  rank: RankView | null;
  profileScore: number | null;
  citationScore: number | null;
};

export type KeyCompetitor = {
  name: string;
  rankText: string;
  selfRankText: string;
  ahead: boolean;
  locationId: string;
  locationName: string;
};

export type BusinessDashboardModel = {
  kind: "business";
  rangeDays: number;
  performance: PerformanceView;
  rank: (RankView & { top3: number | null; top3Change: number | null; trend: { at: string; value: number | null }[] }) | null;
  profile: ScoreView;
  reviews: ReviewsView | null;
  citations: CitationView | null;
  /** Keyword movement in the latest ranking check vs the one before (summed over the locations). */
  movement: { improved: number; declined: number; unchanged: number } | null;
  keyCompetitor: KeyCompetitor | null;
  refresh: { last: string | null; next: string | null } | null;
  /** All the organization's locations (for the "Your locations" list in the all-locations view). */
  locations: BusinessLocationRow[];
  nextSteps: NextStep[];
};

export function toBusinessDashboard(live: LiveBusiness): BusinessDashboardModel {
  const visibility = live.visibility;
  const movement = live.movement;
  const competitor = live.key_competitor;
  return {
    kind: "business",
    rangeDays: RANGE_DAYS[live.range] ?? 30,
    performance: toPerformance(live.performance),
    rank: visibility
      ? {
          value: visibility.avg_rank,
          text: avgRankText(visibility.avg_rank, visibility.avg_rank_status, visibility.avg_rank_display),
          change: visibility.change,
          top3: pct(visibility.top3_rate),
          top3Change: pct(visibility.top3_rate_change),
          trend: visibility.trend.map((point) => ({ at: point.run_at, value: point.avg_rank })),
        }
      : null,
    profile: live.gbp.available
      ? { available: true, score: live.gbp.score, grade: live.gbp.grade, change: live.gbp.change, partial: live.gbp.partial }
      : { available: false, reason: live.gbp.reason },
    reviews: toReviews(live.reviews),
    citations: toCitations(live.citations),
    movement: movement
      ? {
          improved: movement.improved + movement.entered_top_60,
          declined: movement.declined + movement.dropped_out_of_top_60,
          unchanged: movement.unchanged,
        }
      : null,
    keyCompetitor:
      competitor && competitor.name
        ? {
            name: competitor.name,
            rankText: avgRankText(competitor.avg_rank, competitor.status),
            selfRankText: avgRankText(competitor.self_avg_rank, competitor.self_status),
            ahead: competitor.ahead,
            locationId: competitor.location_id,
            locationName: competitor.location_name,
          }
        : null,
    refresh: live.refresh ? { last: live.refresh.last_refreshed_at, next: live.refresh.next_refresh_at } : null,
    locations: sortRows(
      live.locations.map((row) => ({
        locationId: row.location_id,
        name: row.name,
        city: row.city ?? null,
        status: row.status,
        rank:
          row.avg_rank != null || row.avg_rank_status
            ? { value: row.avg_rank, text: avgRankText(row.avg_rank, row.avg_rank_status, row.avg_rank_display), change: row.change }
            : null,
        profileScore: row.gbp_score,
        citationScore: row.citation_score ?? null,
      })),
      byText((row) => row.name),
    ),
    nextSteps: toNextSteps(live.recommended_actions),
  };
}

/* ----------------------------------------------------------------------- agency -- */

export type PortfolioRow = {
  locationId: string;
  name: string;
  city: string | null;
  clientId: string | null;
  clientName: string | null;
  status: LocationStatus;
  rank: RankView | null;
  /** Percent of searches in the Maps top 3, and its change in points. */
  top3: number | null;
  top3Change: number | null;
  profileScore: number | null;
  profileGrade: string | null;
  citationScore: number | null;
  citationNapWrong: number;
  /**
   * Urgent reviews: unanswered 1–3★ or flagged (`awaiting_attention`, the only review count agency
   * rows carry); null without review data.
   */
  urgentReviews: number | null;
  rating: number | null;
};

export type LocationRef = { locationId: string; name: string; clientName: string | null };

export type AgencyDashboardModel = {
  kind: "agency";
  rangeDays: number;
  performance: PerformanceView;
  clients: number;
  locations: number;
  statusCounts: StatusCounts;
  rank: RankView | null;
  top3: { value: number | null; change: number | null };
  profile: { value: number | null; change: number | null };
  citationScore: number | null;
  reviews: ReviewsView | null;
  /** Locations whose rankings slipped in the latest check, worst first (the backend lists up to 10). */
  declines: (LocationRef & { change: number | null; declinedKeywords: number; droppedOut: number })[];
  /** Google profile problems per location (up to 10). */
  profileIssues: (LocationRef & { issues: { id: string; label: string }[] })[];
  reports: { ready: number; scheduled: number; failed: number } | null;
  portfolio: { rows: PortfolioRow[]; page: number; limit: number; total: number };
  nextSteps: NextStep[];
};

function toPortfolioRow(row: AgencyTableRow): PortfolioRow {
  const visibility = row.visibility;
  return {
    locationId: row.location_id,
    name: row.name,
    city: row.city ?? null,
    clientId: row.client?.client_id ?? null,
    clientName: row.client?.name ?? null,
    status: row.status,
    rank:
      visibility && (visibility.avg_rank != null || visibility.avg_rank_status)
        ? { value: visibility.avg_rank, text: avgRankText(visibility.avg_rank, visibility.avg_rank_status, visibility.avg_rank_display), change: visibility.change }
        : null,
    top3: pct(visibility?.top3_rate),
    top3Change: pct(visibility?.top3_rate_change),
    profileScore: row.gbp?.score ?? null,
    profileGrade: row.gbp?.grade ?? null,
    citationScore: row.citations?.score ?? null,
    citationNapWrong: row.citations?.nap_wrong ?? 0,
    urgentReviews: row.reviews ? row.reviews.awaiting_attention : null,
    rating: row.reviews?.rating ?? null,
  };
}

export function toAgencyDashboard(live: LiveAgency): AgencyDashboardModel {
  const portfolio = live.portfolio;
  return {
    kind: "agency",
    rangeDays: RANGE_DAYS[live.range] ?? 30,
    performance: toPerformance(live.performance),
    clients: live.clients_count,
    locations: live.locations_count,
    statusCounts: live.status_counts,
    rank:
      portfolio.avg_rank != null || portfolio.avg_rank_status
        ? { value: portfolio.avg_rank, text: avgRankText(portfolio.avg_rank, portfolio.avg_rank_status, portfolio.avg_rank_display), change: portfolio.avg_rank_change }
        : null,
    top3: { value: pct(portfolio.avg_top3_rate), change: pct(portfolio.avg_top3_rate_change) },
    profile: { value: portfolio.avg_gbp_score, change: portfolio.avg_gbp_score_change },
    citationScore: portfolio.avg_citation_score ?? null,
    reviews: toReviews(live.reviews),
    // `change` is previous − current, so the most negative slipped the most.
    declines: sortRows(
      live.declines.map((row) => ({
        locationId: row.location_id,
        name: row.name,
        clientName: row.client?.name ?? null,
        change: row.change,
        declinedKeywords: row.declined_keywords,
        droppedOut: row.dropped_out,
      })),
      byNumber((row) => row.change),
      byNumber((row) => row.declinedKeywords, "desc"),
      byText((row) => row.name),
    ),
    profileIssues: sortRows(
      live.gbp_issues.map((row) => ({ locationId: row.location_id, name: row.name, clientName: row.client?.name ?? null, issues: row.issues })),
      byNumber((row) => row.issues.length, "desc"),
      byText((row) => row.name),
    ),
    reports: live.reports ?? null,
    portfolio: { rows: live.table.rows.map(toPortfolioRow), page: live.table.page, limit: live.table.limit, total: live.table.total },
    nextSteps: toNextSteps(live.recommended_actions),
  };
}

export type DashboardModel = BusinessDashboardModel | AgencyDashboardModel;
