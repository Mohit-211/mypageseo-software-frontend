/**
 * `GET locations/:id/gbp/report` (docs/backend/API.md "GBP report (Phase 7c)", score version 2:
 * no ranking data). A section that can't be shown is `{ available: false, reason }`.
 */
import type { Attribution } from "./locations";

export type GbpUnavailableReason =
  | "gbp_not_connected"
  | "v4_access_pending"
  | "not_synced_yet"
  | "no_data"
  | "places_not_configured"
  | "no_place_id";

export type GbpUnavailable = { available: false; reason: GbpUnavailableReason | string };

export type GbpRange = "28d" | "90d" | "12m";

/** `pass` = full points, `fail` = none; build "healthy" / "needs work" on this, never on points. */
export type CheckState = "pass" | "partial" | "fail" | "not_available";

export type StateCounts = Record<CheckState, number>;

export type GbpPillarId = "completeness" | "activity" | "reviews" | "performance";

export type GbpCheck = {
  id: string;
  pillar: GbpPillarId;
  label: string;
  status: "scored" | "not_available";
  state: CheckState;
  value: number | string | boolean | null;
  points: number;
  max: number;
  detail: string;
  fix_hint: string | null;
  why_it_matters: string | null;
};

export type GbpPillar = {
  id: GbpPillarId;
  weight: number;
  available: boolean;
  earned: number;
  available_max: number;
  score: number | null;
  state: CheckState;
  counts: StateCounts;
};

export type GbpScore = {
  available: true;
  /** 2 = no ranking data (since 2026-10-02). */
  version?: number;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  /** True when pillars were excluded (e.g. Activity and Reviews while v4 is off) and the rest rescaled. */
  partial: boolean;
  excluded_pillars: GbpPillarId[];
  pillars: GbpPillar[];
  checks: GbpCheck[];
  top_fixes: GbpCheck[];
  counts: StateCounts;
};

/** Performance totals; the action types Google reports. */
export type PerformanceTotals = {
  impressions: number;
  maps: number;
  search: number;
  mobile: number;
  desktop: number;
  calls: number;
  website_clicks: number;
  direction_requests: number;
  conversations: number;
  bookings: number;
  food_orders: number;
  food_menu_clicks: number;
  actions: number;
};

export type PerformanceComparison = {
  start: string;
  end: string;
  totals: Partial<PerformanceTotals>;
  coverage: { days_with_data: number; days: number };
  /** Fractions (0.068 = +6.8%) per metric; null when not comparable. */
  change: Partial<Record<keyof PerformanceTotals, number | null>>;
};

export type PerformanceSection = {
  available: true;
  latest_date: string;
  range: GbpRange;
  days: number;
  start: string;
  end: string;
  totals: PerformanceTotals;
  coverage: { days_with_data: number; days: number };
  previous_period: PerformanceComparison | null;
  same_period_last_year: PerformanceComparison | null;
  by_day: ({ date: string } & Partial<PerformanceTotals>)[];
  by_surface: { maps: number; search: number };
  by_device: { mobile: number; desktop: number };
  actions_per_1000_impressions: number | null;
  actions_per_1000_change: number | null;
};

/** Search terms people used to find the profile (monthly; small values are "< threshold"). */
export type SearchKeywordsSection = {
  available: true;
  months: string[];
  latest_month: string;
  top: {
    keyword: string;
    value: number | null;
    threshold: number | null;
    previous_value: number | null;
    change: number | null;
    tracked: boolean;
  }[];
  not_tracked: string[];
};

export type ReviewsSection = {
  available: true;
  average_rating: number | null;
  total: number | null;
  new_30d: number | null;
  new_90d: number | null;
  reply_rate_90d: number | null;
  median_reply_hours: number | null;
  per_month: { month: string; count: number; average_rating: number | null }[];
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  unreplied: { rating: number | null; created_at: string | null; excerpt: string | null; reviewer: string | null }[];
};

export type MediaSection = {
  available: true;
  owner_count: number;
  customer_count: number;
  latest_owner_upload: string | null;
  owner_uploads_per_month: Record<string, number>;
};

export type PostsSection = {
  available: true;
  total: number;
  last_post_at: string | null;
  last_30_days: number;
  last_90_days: number;
  per_month: Record<string, number>;
};

export type HoursPeriod = { open_day: string | null; open_time: string | null; close_day: string | null; close_time: string | null };

/** The business's own profile data from Google. */
export type GbpProfile = {
  available: true;
  title: string | null;
  description: string | null;
  primary_category: string | null;
  additional_categories: string[];
  regular_hours: HoursPeriod[];
  special_hour_dates: string[];
  primary_phone: string | null;
  additional_phones: string[];
  website: string | null;
  service_area: { business_type: string | null; place_count: number; region_code: string | null } | null;
  labels: string[];
  open_status: string | null;
  /**
   * `name` is Google's attribute id (e.g. `has_wheelchair_accessible_entrance`). `display_name`,
   * `group` and `value_labels` are Google's own wording; null until the next sync or when
   * Google's attribute list couldn't be read.
   */
  attributes: {
    name: string;
    value_type: string | null;
    values: unknown[];
    display_name?: string | null;
    group?: string | null;
    value_labels?: string[] | null;
  }[];
  service_items: {
    name: string | null;
    description: string | null;
    kind: "structured" | "free_form" | string | null;
    price: { currency: string; amount: number } | null;
  }[];
  maps_uri: string | null;
  new_review_uri: string | null;
  latlng: { latitude: number; longitude: number } | null;
  taken_at: string | null;
};

export type CompetitorRow = {
  place_id: string;
  is_self: boolean;
  source: "self" | "tracking" | "map_list" | string;
  name: string | null;
  rating: number | null;
  user_rating_count: number | null;
  primary_type: string | null;
  primary_type_label: string | null;
  has_hours: boolean;
  has_website: boolean;
  has_phone: boolean;
  has_editorial_summary: boolean | null;
  business_status: string | null;
  photo_count: number | null;
  photos_capped: boolean;
  reviews: {
    rating: number | null;
    text: string | null;
    publish_time: string | null;
    relative_time: string | null;
    author: { name: string | null; uri: string | null } | null;
  }[];
  recent_review_at: string | null;
  fetched_at: string | null;
  stale: boolean;
  error: string | null;
  public_score: {
    score: number;
    flag: "closed_temporarily" | "closed_permanently" | null;
    parts: { id: string; points: number; max: number; available: boolean }[];
  } | null;
};

export type CompetitorsSection = {
  available: true;
  generated_at: string;
  warning: string | null;
  rows: CompetitorRow[];
  insights: { id: string; impact: number; message: string; place_id: string | null }[];
};

export type ScoreHistoryEntry = {
  generated_at: string;
  gbp_score: number | null;
  grade: string | null;
  public_score: number | null;
  /** 1 = included ranking data (older formula), 2 = doesn't; don't compare across versions. */
  version?: number;
};

export type GbpReport = {
  location_id: string;
  generated_at: string;
  trigger: string;
  gbp_connected: boolean;
  v4_enabled: boolean;
  range: GbpRange;
  gbp_score: GbpScore | GbpUnavailable;
  performance: PerformanceSection | GbpUnavailable;
  keywords: SearchKeywordsSection | GbpUnavailable;
  reviews: ReviewsSection | GbpUnavailable;
  media: MediaSection | GbpUnavailable;
  posts: PostsSection | GbpUnavailable;
  profile: GbpProfile | GbpUnavailable;
  pending_google_edits: { available: true; has_pending: boolean; diff_fields: string[]; pending_fields: string[] } | GbpUnavailable;
  verification: { available: true; has_voice_of_merchant: boolean; has_business_authority: boolean; state: string | null } | GbpUnavailable;
  sync:
    | { available?: true; last_synced_at: string | null; last_status: string | null; types: Record<string, { status: string; message: string | null }> }
    | GbpUnavailable;
  competitors: CompetitorsSection | GbpUnavailable;
  score_history: ScoreHistoryEntry[];
  generation: { pending: boolean; scheduled_for: string | null; last_generated_at: string | null };
  attribution?: Attribution;
};
