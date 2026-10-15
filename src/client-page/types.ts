/**
 * `GET <page>/data?e=<key>`: everything the white-label client page shows (Phase 23). The report data is
 * the edition's stored section data (the backend's `SnapshotData` shapes, dates as ISO strings); the
 * branding is live. Nothing here names the product behind the page.
 */
export type ClientReportType = "rank_tracker" | "gbp_audit" | "competitor_analysis" | "citation" | "reputation";

export type Unavailable = { available: false; reason: string };
export type Part<T> = T | Unavailable;

export function isAvailable<T extends object>(part: Part<T> | undefined | null): part is T {
  return Boolean(part) && (part as { available?: boolean }).available !== false;
}

export type ClientPageData = {
  branding: {
    name: string;
    website_url: string | null;
    contact_text: string | null;
    footer_text: string | null;
    primary_color: string;
    secondary_color: string;
    /** Relative to the page (e.g. `./<token>/logo`), or null. */
    logo_url: string | null;
  };
  location: { name: string; address: string | null; city: string | null; state: string | null; country: string | null };
  edition: { key: string; generated_at: string };
  latest_key: string;
  /** Newest first. */
  editions: { key: string; generated_at: string }[];
  /** The selected reports that have data, in display order. */
  reports: ClientReportType[];
  data: {
    rank_tracker?: Part<RankTrackerData>;
    gbp_audit?: Part<GbpAuditData>;
    competitor_analysis?: Part<CompetitorData>;
    citation?: Part<CitationData>;
    reputation?: Part<ReputationData>;
  };
  /** Google Maps attribution when Places content is shown. */
  attribution: string | null;
};

// ---- Rank Tracker ----

export type RtKeywordRow = {
  keyword: string;
  avg_rank: number | null;
  found_rate: number | null;
  top3_rate: number | null;
  /** previous − current: positive = moved up. */
  change: number | null;
  label: string | null;
};

export type RtGrid = {
  keyword: string;
  size: number;
  spacing_km: number;
  cells: { row: number; col: number; rank: number | null; status: "ok" | "not_found" | "error" }[];
  avg_rank: number | null;
  found_rate: number | null;
  top3_rate: number | null;
};

export type RankTrackerData = {
  available: true;
  run: { run_at: string; finished_at: string | null; partial: boolean; grid_size: number; spacing_km: number };
  summary?: { overall_avg_rank: number | null; change: number | null; top3_rate: number | null; found_rate: number | null; keywords: number };
  keywords?: RtKeywordRow[];
  history?: { run_at: string; overall_avg_rank: number | null }[];
  grid?: RtGrid[];
  movers?: { improved: { keyword: string; change: number }[]; declined: { keyword: string; change: number }[]; entered: string[]; dropped: string[] };
  map_ranking?: { keyword: string; points: { point: string; top: { rank: number; name: string | null; is_self: boolean }[]; self_rank: number | null }[] }[];
  keyword_groups?: {
    name: string;
    keywords: string[];
    avg_rank: number | null;
    top3_rate: number | null;
    found_rate: number | null;
    change: number | null;
    comparable_keywords: number;
  }[];
};

// ---- GBP Audit ----

export type CheckState = "pass" | "partial" | "fail" | "not_available";
export type StateCounts = Record<CheckState, number>;

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
  actions: number;
};

export type GbpAuditData = {
  available: true;
  generated_at: string;
  range: string;
  v4_enabled: boolean;
  score?: Part<{
    score: number;
    grade: string;
    partial: boolean;
    version: number;
    counts: StateCounts;
    excluded_pillars: string[];
    pillars: { id: string; weight: number; score: number | null; available: boolean; state: string; counts: StateCounts }[];
  }>;
  checks?: Part<{
    checks: {
      label: string;
      pillar: string;
      status: string;
      state: string;
      points: number;
      max: number;
      detail: string;
      fix_hint: string | null;
      why_it_matters: string | null;
    }[];
    top_fixes: { label: string; pillar: string; fix_hint: string | null }[];
  }>;
  performance?: Part<{
    start: string;
    end: string;
    days: number;
    totals: PerformanceTotals;
    previous_change: Record<keyof PerformanceTotals, number | null>;
    last_year_change: Record<keyof PerformanceTotals, number | null>;
    by_surface: { maps: number; search: number };
    by_device: { mobile: number; desktop: number };
    actions_per_1000: number | null;
    actions_per_1000_change: number | null;
    by_day: { date: string; impressions: number; maps: number; search: number; actions: number; calls: number; website_clicks: number; direction_requests: number }[];
  }>;
  keywords?: Part<{ latest_month: string; top: { keyword: string; value: number | null; threshold: number | null; change: number | null; tracked: boolean }[] }>;
  profile?: Part<{
    title: string | null;
    primary_category: string | null;
    additional_categories: string[];
    phone: string | null;
    website: string | null;
    hours_set: boolean;
    description_length: number;
    nap: { field: "name" | "phone" | "website"; location: string | null; profile: string | null; match: boolean | null }[];
  }>;
  verification?: Part<{ verified: boolean; state: string | null; verified_at?: string | null; method?: string | null; guidance?: string | null }>;
  pending_edits?: Part<{ has_pending: boolean; fields: string[] }>;
  reviews_media_posts?: {
    reviews: Part<{ average_rating: number | null; total: number; new_90d: number; reply_rate_90d: number | null; median_reply_hours: number | null; unreplied: number }>;
    media: Part<{ owner_count: number; customer_count: number; latest_owner_upload: string | null }>;
    posts: Part<{ last_post_at: string | null; last_30_days: number; last_90_days: number }>;
  };
};

// ---- Competitor Analysis ----

export type CompetitorData = {
  available: true;
  generated_at: string;
  public_scores?: { name: string; is_self: boolean; score: number | null; flag: string | null }[];
  table?: {
    name: string;
    is_self: boolean;
    rating: number | null;
    reviews: number | null;
    category: string | null;
    has_hours: boolean;
    has_website: boolean;
    has_phone: boolean;
    status: string | null;
    photos?: number | null;
    photos_capped?: boolean;
  }[];
  insights?: string[];
  reviews?: {
    name: string;
    is_self: boolean;
    items: { rating: number | null; text: string | null; when: string | null; author: string | null; author_uri: string | null }[];
  }[];
};

// ---- Citations ----

export type CitationData = {
  available: true;
  as_of: string;
  range: string;
  score?: { score: number | null; grade: string | null; coverage: number | null; total: number; counts: Record<string, number> };
  table?: { directory: string; type: string; status: string; listing_url: string | null; last_checked_at: string | null; nap_issues: string[] }[];
  nap_issues?: {
    expected: { name: string | null; address: string | null; phone: string | null; website: string | null };
    rows: { directory: string; field: string; found: string | null; expected: string | null }[];
  };
  changes?: { at: string; directory: string; action: string; from: string | null; to: string | null }[];
};

// ---- Reputation ----

export type ReputationData = {
  available: true;
  as_of: string;
  summary?: {
    average_rating: number | null;
    total: number;
    new_this_month: number;
    positive: number;
    negative: number;
    reply_rate: number | null;
    awaiting_attention: number;
    flagged: number;
  };
  distribution?: { stars: number; count: number }[];
  needs_attention?: { rating: number | null; date: string | null; excerpt: string | null; flags: string[]; flag_level: string }[];
  replies_sent?: {
    this_month: number;
    last_90_days: number;
    recent: { rating: number | null; review: string | null; reply: string | null; date: string | null }[];
  };
  insights?: Part<{
    available: true;
    generated_at: string;
    themes: { theme: string; mentions: number; sentiment: string }[];
    praise: string[];
    complaints: string[];
    observations: string[];
  }>;
};
