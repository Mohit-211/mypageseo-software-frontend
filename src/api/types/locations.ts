import type { RankStatus } from "./rankings";
import type { CitationCounts, CitationHealthSummary } from "./citations";
/** Google's attribution for Places content: show `text` near business names, ratings and reviews. */
export type Attribution = { provider: string; text: string };

/** A picked, unbound Business Profile location: `GET locations` → `pending_gbp`. Not a location yet. */
export type PendingGbpPick = {
  pick_id: string;
  google_sub: string;
  google_email: string;
  gbpLocationId: string;
  title: string;
  address: string | null;
  city: string | null;
  region_code: string | null;
  place_id: string | null;
  picked_at: string;
  /** The organization already has a location for this place: Bind links to it and uses no new slot. */
  existing_location_id: string | null;
};

/** `gbp_disconnected`: its GBP was unbound (it had one); `gbp_not_connected`: it never had GBP. */
export type LocationStatus = "active" | "setup_required" | "gbp_not_connected" | "gbp_disconnected" | "reconnect_required";

/** Where rankings are measured from: the business's own pin (`place`) or a city / ZIP set at setup (`manual`). */
/**
 * The display source on a location and on every run: `place` (the business's own position,
 * `label` = its address; also a center picked with "Use the business address") or `manual`
 * (a city / ZIP). Only the `PUT center` answer carries the stored `place_details`.
 */
export type CenterSource = "place" | "manual";

export type LocationCenter = { source: CenterSource | null; label: string | null; lat: number; lng: number };

export type LocationClientRef = { client_id: string; name: string };

/** One row of `GET locations`. A `null` block means no data yet: show "—", never 0. */
export type LocationRow = {
  location_id: string;
  name: string;
  city: string | null;
  country: string | null;
  client: LocationClientRef | null;
  source: "gbp" | "places_search";
  gbp_connected: boolean;
  status: LocationStatus;
  gbp_disconnected_at?: string | null;
  /** `change` is previous − current: positive means improved. */
  /** `status` / `display` (2026-10-08): "12.4", "60+" or "No data". */
  rank: { overall_avg_rank: number | null; change: number | null; status?: RankStatus | null; display?: string | null } | null;
  gbp: { score: number | null; grade: string | null; partial: boolean } | null;
  reviews: { rating: number | null; count: number | null } | null;
  /** Citation Health; null until the MyPageSEO team has checked a listing. */
  citations?: CitationHealthSummary | null;
  last_refreshed_at: string | null;
  next_refresh_at: string | null;
};

export type LocationSortField = "name" | "city" | "rank" | "gbp_score" | "rating" | "citation_score" | "last_refreshed";

export type LocationsListParams = {
  search?: string;
  client_id?: string;
  status?: LocationStatus;
  sort?: LocationSortField;
  order?: "asc" | "desc";
  page?: number;
  /** At most 100. */
  limit?: number;
};

/** `GET locations`. */
export type LocationsListResponse = {
  locations: LocationRow[];
  page: number;
  limit: number;
  total: number;
  pending_gbp?: PendingGbpPick[];
  attribution?: Attribution;
};

/** Location onboarding steps, in order (`center_needed` / `center_set` only for service-area businesses). */
export type LocationOnboardingStep =
  | "profile_selected"
  | "place_selected"
  | "center_needed"
  | "center_set"
  | "keywords_set"
  | "competitors_set"
  | "completed";

/** `GET locations/:id`: the location header. */
export type LocationHeader = {
  location_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  phone: string | null;
  website: string | null;
  business_category: string | null;
  place_id: string | null;
  source: "gbp" | "places_search";
  gbp_connected: boolean;
  gbp_disconnected_at?: string | null;
  status: LocationStatus;
  client: LocationClientRef | null;
  lat: number | null;
  lng: number | null;
  /** Null before a center exists. */
  center?: LocationCenter | null;
  timezone: string | null;
  onboarding: { step: LocationOnboardingStep; started_at: string | null; completed_at: string | null } | null;
  created_at: string;
};

/** A section without data: `{ available: false, reason }`. */
export type Unavailable = { available: false; reason: string };

/** `GET locations/:id/overview`: the header plus the latest summaries. */
export type LocationOverview = LocationHeader & {
  rankings:
    | {
        available: true;
        run_id: string;
        run_at: string;
        status: string;
        overall_avg_rank: number | null;
        overall_status?: RankStatus | null;
        overall_display?: string | null;
        change: number | null;
        keywords: number;
        trend: { run_at: string; overall_avg_rank: number | null; status?: RankStatus | null }[];
      }
    | Unavailable;
  gbp:
    | {
        available: true;
        score: number | null;
        grade: string | null;
        partial: boolean;
        top_fixes: { id: string; label: string; fix_hint: string }[];
      }
    | Unavailable;
  performance:
    | {
        available: true;
        range: string;
        impressions: number | null;
        actions: number | null;
        impressions_change: number | null;
        actions_change: number | null;
      }
    | Unavailable;
  reviews: { available: true; rating: number | null; count: number | null; unreplied: number | null } | Unavailable;
  /** `no_citations_yet` (no list) or `not_checked_yet` (a list, nothing checked) when unavailable. */
  citations?:
    | {
        available: true;
        score: number | null;
        grade: string | null;
        score_change: number | null;
        coverage: number | null;
        listings: number;
        counts: CitationCounts;
        last_checked_at: string | null;
      }
    | Unavailable;
  competitors:
    | {
        available: true;
        tracked: number;
        compared: number;
        public_score: number | null;
        best_competitor: { place_id: string; name: string; public_score: number | null } | null;
      }
    | Unavailable;
  empty_states?: Record<string, boolean>;
  attribution?: Attribution;
};

/** `POST locations` → 201. */
export type CreateLocationResult = { location: LocationHeader; api_calls?: number };

/** `PUT locations/:id/center`. */
export type LocationCenterResult = {
  lat: number;
  lng: number;
  /** The stored source: `manual` (city / ZIP) or `place_details` (the business's own position; no label). Not for display. */
  center_source: "manual" | "place_details" | string;
  center_label: string | null;
  onboarding_step?: LocationOnboardingStep;
};

/** `GET/PUT locations/:id/tracking` → `tracking`. */
export type LocationTracking = {
  keywords: { text: string; normalized: string }[];
  keywords_version: number;
  competitors: string[];
  /** `radius_km` = center to edge (Phase 17). */
  grid: { size: number; spacing_km: number; radius_km: number };
  frequency: string;
  last_run_at: string | null;
  last_error: string | null;
};

/** A tracked competitor's details (Phase 17); fields are null when no details were found. */
export type TrackedCompetitor = {
  place_id: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type TrackingResponse = {
  tracking: LocationTracking;
  /** Same order as `tracking.competitors`. */
  competitors?: TrackedCompetitor[];
  onboarding_step?: LocationOnboardingStep;
};

/** `GET locations/:id/tracking/estimate`: what a run would need, before saving. */
export type TrackingEstimate = {
  grid: { size: number; spacing_km: number; radius_km: number };
  keywords: number;
  points_per_keyword: number;
  tracker_offset_km: number;
  expected_duration_ms: number;
  cap: number;
  /** True = a run would be refused (422): don't save these settings. */
  over_cap: boolean;
  dev_capped: boolean;
  token_cost: { rankings: number };
};

export type CompetitorSuggestion = {
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  userRatingCount: number | null;
  best_position: number | null;
  keywords: { keyword: string; position: number | null }[];
  already_selected: boolean;
};

/** `GET locations/:id/competitor-suggestions`. */
export type CompetitorSuggestionsResponse = {
  suggestions: CompetitorSuggestion[];
  keywords_used: string[];
  cached: boolean;
  attribution?: Attribution;
};

export type PlaceSearchResult = {
  place_id: string;
  name: string;
  address: string | null;
  /** Add-location search only: the existing location's id, or null. */
  already_added?: string | null;
};

/** `GET places/search`. */
export type PlaceSearchResponse = { results: PlaceSearchResult[]; attribution?: Attribution };

export type RankRunStatus = "queued" | "running" | "done" | "partial" | "failed";

/** `GET locations/:id/rank-runs/:runId`. */
export type RankRun = {
  run_id: string;
  status: RankRunStatus;
  /** When it was queued; the expected start while `started_at` is null. */
  run_at: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
  /** How long the run should take at the server's search rate (2026-10-01). */
  expected_duration_ms?: number | null;
  estimate?: { keywords?: number; gridSize?: number; points?: number } | null;
};

/** The `quote` on a 402 `location_payment_required`. */
export type LocationSlotQuote = {
  quantity: number;
  amount: number;
  currency: string;
  period_end?: string;
  lines?: { label: string; quantity: number; unit_price: number; amount: number }[];
};

/** `POST billing/location-slots`: PayPal sends `approve_url`; manual billing answers `fulfilled: true`. */
export type LocationSlotOrder = {
  order_id?: string;
  provider_order_id?: string;
  approve_url?: string;
  amount?: number;
  currency?: string;
  fulfilled: boolean;
  quote?: LocationSlotQuote;
};

/** `POST billing/orders/:orderId/capture`. */
export type BillingCaptureResult = {
  status: "captured" | "pending";
  order_id: string;
  purpose: string;
  billing: unknown;
};

/** `GET onboarding/state` (only the fields the app reads). */
export type OnboardingStateResponse = {
  organization: {
    id: string;
    type: "business" | "agency";
    steps: { id: string; status: "done" | "pending" | "skipped" | "not_available" }[];
    next_step: string | null;
    completed: boolean;
    completed_at?: string | null;
  };
  gbp?: { connected: boolean; connections: { google_sub: string; google_email: string; status: "active" | "revoked" }[] };
  locations: {
    location_id: string;
    name: string;
    source: "gbp" | "places_search";
    client_id: string | null;
    onboarding: { step: LocationOnboardingStep };
  }[];
};

/** `POST onboarding/complete`. */
export type OnboardingCompleteResult = {
  completed: boolean;
  completed_at: string;
  rank_run: { run_id: string; status: RankRunStatus; existing: boolean };
};

export type ClientRecord = {
  client_id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  locations_count: number;
  website?: string | null;
  contact_email?: string | null;
  avg_rank?: number | null;
  avg_gbp_score?: number | null;
  created_at?: string;
};

/** `GET clients`. */
export type ClientsListResponse = { clients: ClientRecord[]; page: number; limit: number; total: number };

/** `GET billing` (only the fields the app reads so far). */
export type BillingState = "trialing" | "active" | "past_due" | "inactive" | "suspended_by_admin";

export type BillingPrices = { first_location: number; additional_location: number };

export type BillingDetails = {
  name: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
};

/** `GET billing`. Owner and member read it; a client_user gets 403. */
export type BillingSummary = {
  state: BillingState;
  read_only: boolean;
  trial_ends_at?: string | null;
  /** `past_due` keeps full access until this date. */
  grace_ends_at?: string | null;
  currency: string;
  plan?: { id: string; name: string; kind: string; max_locations: number; users_per_location: number } | null;
  /** `current` is null until an admin sets prices. */
  prices?: { current: BillingPrices | null; upcoming: (BillingPrices & { effective_from: string }) | null } | null;
  subscription?: {
    id: string;
    status: string;
    billing_method: "paypal" | "manual" | string;
    paid_quantity: number;
    price: BillingPrices | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    comp_until: string | null;
  } | null;
  /** Null when cancelled, comped or without a subscription. */
  next_renewal?: { date: string; quantity: number; amount: number; fixed: boolean } | null;
  locations?: { active: number; allowed: number; max: number };
  users?: { used: number; limit: number };
  tokens: {
    balance: number;
    cost_per_refresh: { rankings: number; gbp: number };
    /** Tokens added each paid period (0 = no grant). */
    monthly_grant?: number;
    last_grant_at?: string | null;
    next_grant_at?: string | null;
    /** Tokens per AI action, e.g. `post_draft` (1) and `post_image` (3). */
    ai_costs?: Record<string, number>;
  };
  billing_details?: BillingDetails | null;
  online_payments: boolean;
};

export type SubscriptionCheckout = {
  subscription_id: string;
  approve_url: string;
  quantity: number;
  currency: string;
  monthly_amount: number;
  starts_at: string | null;
};

export type InvoiceLine = { label: string; quantity: number; unit_price: number; amount: number };

export type BillingInvoice = {
  id: string;
  number: string;
  kind: "subscription" | "location_slots" | "token_pack" | "manual";
  status: "open" | "paid" | "refunded" | "void";
  currency: string;
  lines: InvoiceLine[];
  tax_lines: InvoiceLine[];
  total: number;
  charged_amount: number | null;
  period_start: string | null;
  period_end: string | null;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  has_pdf: boolean;
};

export type InvoiceList = { invoices: BillingInvoice[]; page: number; limit: number; total: number };

export type CouponQuote = { pack_id: string; currency: string; price: number; discount: number; total: number };

export type TokenLedgerEntry = {
  id: string;
  type: "purchase" | "spend" | "refund" | "grant" | "monthly_grant" | "adjustment" | "expiry";
  amount: number;
  balance_after: number;
  note: string | null;
  at: string;
};

/** `GET billing/tokens/ledger`, newest first. */
export type TokenLedger = { balance: number; entries: TokenLedgerEntry[]; page: number; limit: number; total: number };

export type TokenPack = {
  id: string;
  name: string;
  tokens: number;
  currency: string;
  list_price: number;
  price: number;
  expires_after_days: number | null;
};

/** `GET places/autocomplete`: city / region / ZIP suggestions for the setup-center picker. */
export type PlaceSuggestion = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string | null;
  types: string[];
};
