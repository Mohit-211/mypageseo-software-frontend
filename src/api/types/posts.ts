/** GBP posts (Phase 9) and AI posts / auto-posts (Phase 9.1). Shapes: docs/backend/API.md "GBP posts (Phase 9)". */

export type PostType = "standard" | "event" | "offer";
export type PostSource = "manual" | "ai" | "google";
export type PostStatus = "draft" | "pending_approval" | "scheduled" | "publishing" | "published" | "failed" | "rejected";
export type CtaType = "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type WeekOfMonth = "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "LAST";

/** A local calendar date (`YYYY-MM-DD`) with an optional time (`HH:mm`); without a time it's the whole day. */
export type PostDate = { date: string; time?: string | null };

export type PostCta = { type: CtaType; url?: string | null };

export type PostEvent = { title: string; start: PostDate; end: PostDate };

export type PostOffer = { coupon_code?: string | null; redeem_url?: string | null; terms?: string | null };

export type PostRecurrence = {
  pattern: "daily" | "weekly" | "monthly";
  days_of_week?: Weekday[] | null;
  day_of_month?: number | null;
  week_of_month?: WeekOfMonth | null;
  ends_on: string;
};

export type PostMedia = {
  media_id: string;
  url: string;
  width: number;
  height: number;
  kind: "upload" | "ai";
  bytes?: number;
  created_at?: string;
};

export type PostIssue = { field: string; code: string; message: string };

export type Post = {
  post_id: string;
  location_id: string;
  type: PostType;
  source: PostSource;
  status: PostStatus;
  language_code: string | null;
  summary: string | null;
  cta: PostCta | null;
  event: PostEvent | null;
  offer: PostOffer | null;
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
  google: { state: string | null; search_url: string | null; missing: boolean; media_url: string | null };
  error: { code: string; message: string; at: string } | null;
  /** What still blocks scheduling or publishing; empty = ready. */
  issues: PostIssue[];
  /** Hints, never blocking. */
  warnings: { code: string; message: string }[];
  series_id?: string | null;
  can_edit: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalMode = "off" | "team" | "client";

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
    series_problems?: number;
    updated_at?: string | null;
  };
  settings: { approval: ApprovalMode; default_cta: PostCta | null; language_code: string; refreshed_at?: string | null };
  connection: { gbp_connected: boolean; v4_enabled: boolean; photos_publishable: boolean };
  you: { role: string; needs_approval: boolean; can_approve: boolean };
};

export type PostsList = { posts: Post[]; page: number; limit: number; total: number };

export type PostsQuery = {
  status?: string;
  type?: PostType;
  source?: PostSource;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

/** The editable fields of a post (create and PATCH; `null` or "" clears a field on PATCH). */
export type PostInput = {
  type?: PostType;
  summary?: string | null;
  cta?: PostCta | null;
  event?: PostEvent | null;
  offer?: PostOffer | null;
  recurrence?: PostRecurrence | null;
  media_ids?: string[];
  language_code?: string;
  source?: "manual" | "ai";
};

export type PostCreateInput = PostInput & { action?: "draft" | "schedule" | "publish"; scheduled_at?: string };

export type CalendarItem = {
  post_id: string;
  location_id: string;
  location_name?: string;
  type: PostType;
  status: PostStatus;
  source: PostSource;
  date: string;
  summary: string | null;
  event: PostEvent | null;
  recurrence: PostRecurrence | null;
};

export type PostsCalendar = { from: string; to: string; items: CalendarItem[]; locations?: { location_id: string; name: string }[] };

export type PostTone = "friendly" | "professional" | "enthusiastic" | "informative";

export type AiPostDraft = { summary: string; event_title: string | null; cta_type: CtaType | null; image_idea: string | null };

export type AiImageStyle =
  | "photo_scene"
  | "lifestyle_photo"
  | "detail_photo"
  | "flat_illustration"
  | "render_3d"
  | "watercolor"
  | "photo_wide";

export type SeriesCadence =
  | { kind: "weekly"; days_of_week: Weekday[] }
  | { kind: "every_n_days"; n: number }
  | { kind: "monthly"; day_of_month: number };

export type PostSeriesInput = {
  name: string;
  cadence: SeriesCadence;
  time_of_day: string;
  starts_on: string;
  ends_on: string | null;
  topics: string[];
  tone: PostTone;
  cta: PostCta | null;
  include_image: boolean;
  language_code?: string;
  instructions: string | null;
  lead_hours?: number;
};

export type PostSeries = PostSeriesInput & {
  series_id: string;
  location_id: string;
  active: boolean;
  time_zone: string;
  posts_generated: number;
  next_slots: string[];
  last_error: { code: string; message: string; slot_at: string; at: string } | null;
  history: { slot_at: string; post_id: string | null; outcome: "generated" | "failed"; reason: string | null; at: string }[];
  created_at: string;
  updated_at: string;
};

export type SeriesPreview = { time_zone: string; slots: { slot_at: string; topic: string; generates_at: string }[] };
