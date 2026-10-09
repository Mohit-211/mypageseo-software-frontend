/** GBP posts (Phase 9): `/locations/:id/posts*` and the organization-wide `/posts/calendar`. */

export type PostType = "standard" | "event" | "offer";
export type PostStatus = "draft" | "pending_approval" | "scheduled" | "publishing" | "published" | "failed" | "rejected";
export type PostSource = "manual" | "ai" | "google" | string;
export type PostCtaType = "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
export type PostApprovalMode = "off" | "team" | "client";

/** The location's local calendar date (`YYYY-MM-DD`) with an optional `HH:mm`. */
export type PostDateTime = { date: string; time?: string | null };

export type PostRecurrence = {
  pattern: "daily" | "weekly" | "monthly";
  days_of_week?: string[] | null;
  day_of_month?: number | null;
  week_of_month?: "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST" | null;
  ends_on?: string | null;
};

export type PostMedia = { media_id: string; url: string; width: number; height: number; kind: string; bytes?: number; created_at?: string };

export type PostIssue = { field: string; code: string; message: string };
export type PostWarning = { code: string; message: string };

export type Post = {
  post_id: string;
  location_id: string;
  type: PostType;
  source: PostSource;
  status: PostStatus;
  /** Set on posts an auto-post series wrote. */
  series_id?: string | null;
  language_code: string | null;
  summary: string | null;
  cta: { type: PostCtaType; url?: string | null } | null;
  event: { title: string | null; start: PostDateTime | null; end: PostDateTime | null } | null;
  offer: {
    title: string | null;
    start: PostDateTime | null;
    end: PostDateTime | null;
    coupon_code?: string | null;
    redeem_url?: string | null;
    terms?: string | null;
  } | null;
  recurrence: PostRecurrence | null;
  media: PostMedia[];
  scheduled_at: string | null;
  published_at: string | null;
  approval: {
    requested_by?: string | null;
    requested_at?: string | null;
    decided_by?: string | null;
    decided_at?: string | null;
    decision?: "approved" | "rejected" | null;
    on_behalf?: boolean;
    note?: string | null;
  } | null;
  google: { state: string | null; search_url: string | null; missing: boolean; media_url: string | null } | null;
  error: { code: string; message: string; at: string } | null;
  issues: PostIssue[];
  warnings: PostWarning[];
  can_edit: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PostsSummary = {
  stats: {
    drafts: number;
    pending_approval: number;
    scheduled: number;
    published: number;
    failed: number;
    rejected: number;
    published_last_30_days: number;
    last_published_at: string | null;
    next_scheduled_at: string | null;
    /** Auto-post series with a `last_error`. */
    series_problems?: number;
    updated_at: string | null;
  };
  settings: {
    approval: PostApprovalMode;
    default_cta: { type: PostCtaType; url?: string | null } | null;
    language_code: string | null;
    refreshed_at: string | null;
  };
  connection: { gbp_connected: boolean; v4_enabled: boolean; photos_publishable: boolean };
  you: { role: string; needs_approval: boolean; can_approve: boolean };
};

export type PostsListQuery = {
  /** Comma-separated statuses. */
  status?: string;
  type?: PostType;
  source?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PostsList = { posts: Post[]; page: number; limit: number; total: number };

export type PostCalendarItem = {
  post_id: string;
  location_id: string;
  location_name?: string;
  type: PostType;
  status: PostStatus;
  source: PostSource;
  date: string;
  summary: string | null;
  event: Post["event"];
  recurrence: PostRecurrence | null;
};

export type PostsCalendar = { from: string; to: string; items: PostCalendarItem[]; locations?: { location_id: string; name: string }[] };

/** Body of `POST posts` / `PATCH posts/:id`: `null` or `""` clears a field. */
export type PostInput = {
  type?: PostType;
  summary?: string | null;
  cta?: { type: PostCtaType; url?: string | null } | null;
  event?: Post["event"];
  offer?: Post["offer"];
  recurrence?: PostRecurrence | null;
  media_ids?: string[];
  language_code?: string;
  scheduled_at?: string | null;
  /** `ai` when the text came from "Write with AI". */
  source?: "manual" | "ai";
};

export type PostAction = "draft" | "schedule" | "publish";

/* ------------------------------ AI (Phase 9.1) ------------------------------ */

export type PostTone = "friendly" | "professional" | "enthusiastic" | "informative";

export type PostImageStyle =
  | "photo_scene"
  | "lifestyle_photo"
  | "detail_photo"
  | "flat_illustration"
  | "render_3d"
  | "watercolor"
  | "photo_wide";

export type PostAiDraft = { summary: string; event_title: string | null; cta_type: PostCtaType | null; image_idea: string | null };

/* ---------------------------- Auto-posts (series) --------------------------- */

export type PostSeriesCadence =
  | { kind: "weekly"; days_of_week: string[] }
  | { kind: "every_n_days"; n: number }
  | { kind: "monthly"; day_of_month: number };

export type PostSeriesFailure = "insufficient_tokens" | "ai_not_configured" | "ai_budget_reached" | "ai_failed" | "gbp_not_connected" | string;

export type PostSeries = {
  series_id: string;
  location_id: string;
  name: string;
  active: boolean;
  cadence: PostSeriesCadence;
  /** `HH:mm` in `time_zone` (the location's). */
  time_of_day: string;
  time_zone: string;
  starts_on: string;
  ends_on: string | null;
  topics: string[];
  tone: PostTone;
  cta: { type: PostCtaType; url?: string | null } | null;
  include_image: boolean;
  language_code: string | null;
  instructions: string | null;
  lead_hours: number;
  posts_generated: number;
  next_slots: string[];
  last_error: { code: PostSeriesFailure; message: string; slot_at: string | null; at: string } | null;
  history: { slot_at: string; post_id: string | null; outcome: "generated" | "failed"; reason: string | null; at: string }[];
  created_at: string;
  updated_at: string;
};

export type PostSeriesInput = {
  name: string;
  cadence: PostSeriesCadence;
  time_of_day: string;
  starts_on: string;
  ends_on: string | null;
  topics: string[];
  tone: PostTone;
  cta: { type: PostCtaType; url?: string | null } | null;
  include_image: boolean;
  instructions: string | null;
};

export type PostSeriesPreview = { time_zone: string; slots: { slot_at: string; topic: string; generates_at: string }[] };
