/** `GET /dashboard`: built from stored per-location summaries (no Google calls). Shape by organization type. */
import type { LocationStatus } from "./locations";

type Unavailable = { available: false; reason: string };

/** `source` decides where the action leads. */
export type DashboardAction = {
  id: string;
  source: "connection" | "setup" | "ranking" | "gbp" | "citations" | "reviews" | string;
  location_id?: string | null;
  location_name?: string | null;
  title: string;
  detail?: string | null;
  impact: number;
};

export type DashboardRange = "15d" | "30d" | "60d";

export type PerformanceFigures = {
  impressions: number;
  maps: number;
  search: number;
  actions: number;
  calls: number;
  website_clicks: number;
  direction_requests: number;
  actions_per_1000_impressions: number | null;
};

/** GBP performance over `range` vs the window before it. `change` values are fractions (0.15 = +15 %), `null` with too little data. */
export type PerformanceBlock =
  | {
      available: true;
      range: DashboardRange;
      days: number;
      latest_date: string | null;
      current: PerformanceFigures;
      previous: PerformanceFigures;
      change: Record<keyof PerformanceFigures, number | null>;
      coverage: { current: { days_with_data: number; days: number }; previous: { days_with_data: number; days: number } };
    }
  | { available: false; reason: "gbp_not_connected" | "no_data" | string; range: DashboardRange };

export type SelectedLocation = { location_id: string; name: string; city: string | null } | null;

export type CitationsBlock =
  | {
      available: true;
      score: number | null;
      /** Last movement of the score, kept while it stays the same. */
      score_change?: number | null;
      grade: string | null;
      coverage: number | null;
      listings: number;
      live_correct: number;
      nap_wrong: number;
      not_found: number;
      not_checked: number;
    }
  | Unavailable;

export type ReviewsBlock =
  | {
      available: true;
      rating: number | null;
      /** Average rating now minus at the start of the range (2 decimals). */
      rating_change?: number | null;
      new_in_range?: number;
      count: number | null;
      unreplied?: number | null;
      new_this_month?: number;
      positive?: number;
      negative?: number;
      awaiting_attention?: number;
      flagged?: number;
      suspicious?: number;
      drafts_pending?: number;
      replies_sent_this_month?: number;
      last_review_at?: string | null;
      needs_attention?: { location_id: string; name: string; awaiting_attention: number; suspicious: number }[];
    }
  | (Unavailable & { public_rating?: number | null; public_review_count?: number | null });

export type StatusCounts = Partial<Record<LocationStatus, number>>;

export type BusinessDashboard = {
  type: "business";
  range: DashboardRange;
  selected_location: SelectedLocation;
  performance: PerformanceBlock;
  locations_count: number;
  visibility: { avg_rank: number | null; change: number | null; top3_rate: number | null; top3_rate_change?: number | null; trend: { run_at: string; avg_rank: number | null }[] } | null;
  gbp: { available: true; score: number | null; grade: string | null; change: number | null; partial: boolean } | Unavailable;
  reviews: ReviewsBlock;
  citations?: CitationsBlock;
  movement: { improved: number; declined: number; unchanged: number; entered_top_60: number; dropped_out_of_top_60: number; not_comparable: number } | null;
  key_competitor: {
    place_id: string;
    name: string | null;
    avg_rank: number | null;
    self_avg_rank: number | null;
    ahead: boolean;
    location_id: string;
    location_name: string;
  } | null;
  recommended_actions: DashboardAction[];
  refresh: { last_refreshed_at: string | null; next_refresh_at: string | null } | null;
  status_counts: StatusCounts;
  locations: {
    location_id: string;
    name: string;
    city?: string | null;
    status: LocationStatus;
    avg_rank: number | null;
    change: number | null;
    gbp_score: number | null;
    citation_score?: number | null;
  }[];
};

export type AgencyTableRow = {
  location_id: string;
  name: string;
  client: { client_id: string; name: string } | null;
  city?: string | null;
  status: LocationStatus;
  visibility: { avg_rank: number | null; change: number | null; top3_rate: number | null; top3_rate_change?: number | null } | null;
  gbp: { score: number | null; grade: string | null; change: number | null } | null;
  reviews?: { rating: number | null; total: number | null; awaiting_attention: number; suspicious: number } | null;
  citations?: { score: number | null; grade: string | null; nap_wrong: number } | null;
};

export type AgencyDashboard = {
  type: "agency";
  range: DashboardRange;
  selected_location: SelectedLocation;
  performance: PerformanceBlock;
  /** ready / failed: not archived, for the visible locations; scheduled: active schedules. */
  reports: { ready: number; scheduled: number; failed: number };
  clients_count: number;
  locations_count: number;
  portfolio: {
    avg_rank: number | null;
    avg_rank_change: number | null;
    avg_top3_rate: number | null;
    avg_top3_rate_change?: number | null;
    avg_gbp_score: number | null;
    avg_gbp_score_change: number | null;
    avg_citation_score?: number | null;
  };
  status_counts: StatusCounts;
  declines: { location_id: string; name: string; client: { client_id: string; name: string } | null; change: number | null; declined_keywords: number; dropped_out: number }[];
  gbp_issues: { location_id: string; name: string; client: { client_id: string; name: string } | null; issues: { id: string; label: string }[] }[];
  reviews?: ReviewsBlock;
  citations?: CitationsBlock;
  recommended_actions: DashboardAction[];
  table: { rows: AgencyTableRow[]; page: number; limit: number; total: number };
};

export type Dashboard = BusinessDashboard | AgencyDashboard;

export type DashboardSort = "name" | "client" | "rank" | "rank_change" | "gbp_score";
