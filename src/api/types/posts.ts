/**
 * GBP posts (Phase 9) and AI posts / auto-posts (Phase 9.1), with Phase 25c (approvals with reasons, the
 * review queue, the photo library, series publish modes, post writer v2's `ai` block) and the 2026-11-16/17
 * follow-ups (`ai_run` on every post view, server sort and `counts`, calendar counts). Shapes: backend
 * docs/API.md "GBP posts (Phase 9)", "AI posts and auto-posts (Phase 9.1)"; the AI runs and topics are in
 * `./post-ai.ts`.
 */
import type { AiFeatureState, AiTokenCosts } from "./ai";
import type { PostAiRunMarker } from "./post-ai";

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

/** `upload`, `ai` (an AI image) or `enhanced` (Phase 25c: a post's picture made from a library photo and enhanced). */
export type PostMediaKind = "upload" | "ai" | "enhanced";

/** A photo as a post view lists it (`post.media`): no library fields there. */
export type PostMedia = {
  media_id: string;
  url: string;
  width: number;
  height: number;
  kind: PostMediaKind;
  bytes?: number;
  created_at?: string;
};

/** Phase 25c screening flags. `stock_like` and `watermark` can be overridden ("Use anyway", `flags_cleared`); the others can't. */
export type PhotoScreeningFlag =
  | "screenshot"
  | "collage"
  | "text_overlay"
  | "contact_details"
  | "watermark"
  | "stock_like"
  | "people"
  | "minors"
  | "unsafe";

/** The flags an owner or a member may clear on a library photo. */
export type ClearablePhotoFlag = "stock_like" | "watermark";

/**
 * The full photo object (Phase 25c): `GET …/posts/media`, an upload's answer, `PATCH …/posts/media/:mediaId`
 * and the AI picture results. The library fields are optional for servers before 25c.
 */
export type PostMediaDetails = PostMedia & {
  /** In the location's photo library (at most 200). */
  library?: boolean;
  /** What the photo shows (the user's words, else the screening's); null until screened. */
  caption?: string | null;
  caption_source?: "ai" | "user" | null;
  /** A library photo's screening: `pending` until the job ran; flagged photos are never picked for automatic posts. */
  screening?: { state: "pending" | "ok" | "flagged" | "failed"; flags: PhotoScreeningFlag[]; cleared: ClearablePhotoFlag[] } | null;
  /** `ok`, `enhance` (fixed gently when used) or `poor` (never picked automatically); `issues` say why. */
  quality?: { verdict: "ok" | "enhance" | "poor"; issues: string[] } | null;
  usage?: { use_count: number; last_used_at: string | null };
  /** A post's picture: the library photo it was made from. Undo an enhancement by putting this id back in the post's `media_ids`. */
  source_media_id?: string | null;
  ai_generated?: boolean;
  /** Show next to the picture: "AI-generated image, not a photo of your business", "Enhanced from your photo", or null. */
  label?: string | null;
};

/** `GET …/posts/media`: newest first; `library` (Phase 25c) is the library's count and cap. */
export type PostMediaList = {
  media: PostMediaDetails[];
  page: number;
  limit: number;
  total: number;
  library?: { count: number; max: number };
};

/** `PATCH …/posts/media/:mediaId` (owners and members): at least one field. `caption: null` goes back to the screening's. */
export type PostMediaPatch = { library?: boolean; caption?: string | null; flags_cleared?: ClearablePhotoFlag[] };

export type PostIssue = { field: string; code: string; message: string };

/**
 * Why a post waits for approval (Phase 25c `approval.reason`): `team` (a member's post, team mode), `client`
 * (client mode), `ai_review` (an AI post waiting for a person: a review-first series, or an automatic post a
 * safety rule held) or `needs_review` (the checks flagged an AI post: show its `ai.findings`).
 */
export type PostApprovalReason = "team" | "client" | "ai_review" | "needs_review";

/**
 * Why an automatic series post waits for a person (`approval.held`, Phase 25c). `auto_cap_week` and
 * `auto_cap_spacing` are gone since 2026-11-17. Words: `src/lib/posts/approval-labels.ts`.
 */
export type SeriesHold =
  | "checks"
  | "auto_publish_off"
  | "regulated_review_only"
  | "client_consent_required"
  | "first_posts_review"
  | "image_unavailable"
  | "series_paused";

/**
 * A failed or rejected post's `error.code`. Google failures use the reply send's words since 2026-11-17
 * (`reconnect_required`, `google_unavailable`, `google_rejected_request`, `not_configured`); `google_rejected`
 * is Google's review; `review_expired` / `series_changed` sent a series post back to drafts; the billing codes
 * come from the publish job. Words: `src/lib/posts/approval-labels.ts` (`postErrorWords`).
 */
export type PostErrorCode =
  | "google_rejected_request"
  | "google_unavailable"
  | "google_rejected"
  | "reconnect_required"
  | "not_configured"
  | "publish_failed"
  | "gbp_not_connected"
  | "v4_access_pending"
  | "media_url_not_public"
  | "media_unreachable"
  | "media_missing"
  | "publish_interrupted"
  | "gbp_unbound"
  | "location_removed"
  | "post_incomplete"
  | "checks_failed"
  | "review_expired"
  | "series_changed"
  | "interrupted"
  | "organization_suspended"
  | "subscription_required"
  | "feature_not_included";

/** Where an AI post's picture came from (Phase 25c): a library photo, that photo enhanced, an AI image, or none. */
export type PostImageSource = "library" | "enhanced" | "ai" | "none";

/** What happened to the logo on a picture: `placed`, `skipped` (see the reasons), `off` (by `logo_on`) or `none` (no logo set). */
export type PostLogoOutcome = "placed" | "skipped" | "off" | "none";

/**
 * A finding of the checks on the AI's text (`post.ai.findings`): highlight `text` while it is still in the
 * post (an edit may have moved or removed it). A `hard` one must be changed before the post goes out (422
 * `checks_failed`); `warn` asks for a look; `regenerate` is a writing note.
 */
export type PostAiFinding = {
  rule: string;
  kind: string;
  severity: "hard" | "warn" | "regenerate" | (string & {});
  message: string;
  text: string | null;
};

/**
 * How the AI wrote a post (Phase 25c `post.ai`; null for a post the AI never wrote). Owners and members get
 * every field; a client user gets a slim one (`topic`, `findings`, `image.source`, `generated_at`), so the
 * rest are optional here.
 */
export type PostAi = {
  topic: string | null;
  findings: PostAiFinding[];
  image: { source: PostImageSource; logo?: PostLogoOutcome; reasons?: string[] } | null;
  generated_at: string;
  topic_id?: string | null;
  prompt_version?: string | null;
  model?: string | null;
  language?: string | null;
  angle?: string | null;
  pillar?: string | null;
  tone?: string | null;
  instructions?: string | null;
  /** The judge's grade of the AI's text (1–5); null when no judge ran. */
  quality?: {
    score: number | null;
    verdict: "pass" | "revise" | "fail" | null;
    candidates: number;
    criteria: { key: string; score: number | null; passed: boolean }[];
  } | null;
  /** `flagged` or `unavailable`: a person should read it closely. */
  verification?: "passed" | "flagged" | "unavailable" | null;
  keywords_used?: string[];
  /** The spans that state something about the business and the fact ids they rest on. */
  claims?: { span: string; fact_ids: string[] }[];
  /** A person changed the AI's text. */
  edited?: boolean;
  /** A series post: it went out by itself (`auto`) or waited for a person (`review`). */
  publish_mode?: "review" | "auto" | null;
};

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
    /** Phase 25c: why it waits (absent on approvals written before). */
    reason?: PostApprovalReason | null;
    /** Phase 25c: a series post's review time ("Review by …"); past it the post goes back to drafts (`error.code: review_expired`). */
    expires_at?: string | null;
    /** Phase 25c: why an automatic series post waits for a person. */
    held?: SeriesHold[];
  } | null;
  google: { state: string | null; search_url: string | null; missing: boolean; media_url: string | null };
  /**
   * A failed or rejected post's error. A rejected post can still have `error: null` (one imported already
   * rejected, or rejected before 2026-11-17): show "Google rejected this post" then.
   */
  error: { code: PostErrorCode | (string & {}); message: string; at: string } | null;
  /** What still blocks scheduling or publishing; empty = ready. */
  issues: PostIssue[];
  /** Hints, never blocking. */
  warnings: { code: string; message: string }[];
  /** The auto-post series that wrote it and the slot it fills (null for other posts). */
  series_id?: string | null;
  slot_at?: string | null;
  can_edit: boolean;
  /** Phase 25c: the caller may approve or reject it now (use it for the Approve / Reject buttons, not the summary's flag). */
  can_approve?: boolean;
  /** Phase 25c: how the AI wrote it (null for a post the AI never wrote). */
  ai?: PostAi | null;
  /**
   * 2026-11-16: what works on the post now: a run holding it (show "Creating…", poll `run_id`), a series slot its
   * series is writing (`run_id: null`, `kind: "series_slot"`: nothing to poll, reload later), or null. Keep the
   * button, type, event and offer fields locked while it is set. See `src/lib/posts/ai-runs.ts`.
   */
  ai_run?: PostAiRunMarker | null;
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
  /** `can_approve` (Phase 25c): also the AI posts waiting with approval off (owners and members). Each post's own `can_approve` decides its buttons. */
  you: { role: string; needs_approval: boolean; can_approve: boolean };
  /**
   * Phase 25c: whether "Write with AI" and "Change it" can run now (`configured: false`: AI isn't switched on
   * yet; `paused_today`: today's AI budget, or the organization's share of it, is used up) and their prices.
   */
  ai?: { configured: boolean; paused_today: boolean; token_costs: AiTokenCosts };
};

/** 2026-11-17: the posts of each status group under the list's filters without `status` (the filter chips). */
export type PostCounts = { all: number; problems: number; waiting: number; scheduled: number; drafts: number; published: number };

export type PostsList = {
  posts: Post[];
  page: number;
  limit: number;
  total: number;
  /** 2026-11-17 (older servers leave it out). */
  counts?: PostCounts;
};

/**
 * 2026-11-17: `group` (the default) is the Posts page's order: problems (newest failure first), waiting (no time
 * first, then the next to go out), scheduled (next first), drafts (last edited first), published (newest first).
 * A time sort orders by that time (`order`: default `desc`, `asc` for `scheduled_at`; missing times last).
 */
export type PostSort = "group" | "published_at" | "scheduled_at" | "created_at" | "updated_at";

export type PostsQuery = {
  /** One status or a comma list. */
  status?: string;
  type?: PostType;
  source?: PostSource;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: PostSort;
  /** Ignored with `sort=group`. */
  order?: "asc" | "desc";
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

/**
 * A location row of the organization calendar (`GET /posts/calendar`). 2026-11-17 (G16): its `gbp_connected`
 * and stored post counts (zeros before its first post), so the calendar needs no `posts/summary` per location.
 */
export type CalendarLocation = {
  location_id: string;
  name: string;
  gbp_connected?: boolean;
  /** Failed, rejected by Google, waiting for approval. */
  posts?: { failed: number; rejected: number; pending_approval: number };
};

export type PostsCalendar = { from: string; to: string; items: CalendarItem[]; locations?: CalendarLocation[] };

/* -------------------------------------------------------------------------- */
/* The review queue, bulk approve and the digest (Phase 25c)                    */
/* -------------------------------------------------------------------------- */

/** A post of the review queue: the usual post object for the caller, with its location's name. */
export type ReviewQueuePost = Post & { location_name: string };

/**
 * `GET /posts/review`: the AI posts waiting for a person (`source: ai`, `pending_approval`) across the
 * locations the caller may see (a client user: its clients'), the soonest first. Approve the posts with
 * `can_approve`; the others wait for someone else.
 */
export type ReviewQueue = {
  total: number;
  page: number;
  limit: number;
  locations: { location_id: string; name: string }[];
  posts: ReviewQueuePost[];
};

export type ReviewQueueQuery = { location_ids?: readonly string[]; page?: number; limit?: number };

/**
 * One post of a bulk approve, in the order sent. `status` is the post's new status: a post already due comes
 * back `scheduled` (the publishing queue publishes it within moments). `reason` when not approved:
 * `post_not_found`, `not_an_approver`, `review_expired`, `invalid_status`, `post_incomplete`, `checks_failed`, …
 */
export type BulkApproveResult = { post_id: string; approved: boolean; status: PostStatus | null; reason: string | null };

export type BulkApproveResponse = { approved: number; not_approved: number; results: BulkApproveResult[] };

/**
 * The signed-in user's daily AI review digest setting (`GET/PUT /posts/digest`). The digest is behind a
 * server switch (`AI_DIGEST_ENABLED`) that this answer doesn't report.
 */
export type PostsDigestSetting = { enabled: boolean; opted_out_at: string | null };

export type PostTone = "friendly" | "professional" | "enthusiastic" | "informative";

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

/** Phase 25c: `auto` (the topic planner picks each post's topic) or `list` (`topics` in turn; 400 `topics_required` without any). */
export type SeriesTopicMode = "auto" | "list";

/**
 * Phase 25c: `review` (the default: every post waits for a person until its review time) or `auto` (posts
 * publish at their slot unless a safety rule holds one: `approval.held`).
 */
export type SeriesPublishMode = "review" | "auto";

/** Phase 25c: why a series paused itself (`active: false`; resuming clears it). */
export type SeriesPauseReason = "unreviewed" | "needs_review" | "google_rejected";

/**
 * A series history entry's outcome (Phase 25c): `generated`, `failed` (nothing was made; `reason` is the
 * failure code), `held` (an automatic post waits for a person; `reason` is its first hold), `expired` (nobody
 * reviewed it in time), and `paused_*` (the series paused itself).
 */
export type SeriesHistoryOutcome =
  | "generated"
  | "failed"
  | "held"
  | "expired"
  | "paused_unreviewed"
  | "paused_needs_review"
  | "paused_rejected";

/**
 * An agency client's approval of the series' automatic publishing (Phase 25c). While `required` and not
 * `granted`, show the approval to a caller whose `grant_method` is `client` (a client user of the location's
 * client) or `owner_attestation` (the agency owner); a member's is null. The consent text is the app's own:
 * send its version with `PUT …/post-series/:id/auto-consent`. `user_name` (2026-11-17): who gave it, by name
 * (null for a deleted or unnamed account, or hidden from a client user: "Your agency").
 */
export type SeriesAutoConsent = {
  required: boolean;
  granted: boolean;
  method: "client" | "owner_attestation" | null;
  user_id: string | null;
  user_name?: string | null;
  consent_version: string | null;
  at: string | null;
  client_id: string | null;
  grant_method: "client" | "owner_attestation" | null;
};

/**
 * What automatic publishing needs (Phase 25c): the rollout switch (unless `on`, say "Automatic publishing isn't
 * switched on yet"), an agency client's approval, and the review-first posts still to go.
 */
export type SeriesAutoPublish = {
  switch: AiFeatureState;
  consent: SeriesAutoConsent;
  /** "The first N posts still wait for review" (3 after a new or edited automatic series; down on each approval). */
  first_posts_left: number;
};

/** The fields of a series as every series view has them. */
export type PostSeriesFields = {
  name: string;
  cadence: SeriesCadence;
  time_of_day: string;
  starts_on: string;
  ends_on: string | null;
  /** Used in turn in list mode; optional since Phase 25c (auto mode plans each post's topic). */
  topics: string[];
  tone: PostTone;
  cta: PostCta | null;
  include_image: boolean;
  language_code?: string;
  instructions: string | null;
  lead_hours?: number;
  /** IANA zone for `time_of_day` (the user's own, 2026-10-12); null falls back to the location's, then UTC. 400 for an unknown zone. */
  time_zone?: string | null;
};

/**
 * Create (`POST …/post-series`) and edit (`PATCH`) bodies. Since Phase 25c every field is optional: `{}` makes
 * "AI posts" (weekly on one weekday at 10:00 local, review mode, images on, automatic topics, every eligible
 * keyword). `keywords`: tracked keywords only (400 `keyword_not_tracked` + `keywords`), empty = every eligible one.
 */
export type PostSeriesInput = Partial<PostSeriesFields> & {
  topic_mode?: SeriesTopicMode;
  publish_mode?: SeriesPublishMode;
  keywords?: string[];
};

export type PostSeriesHistoryEntry = {
  slot_at: string;
  post_id: string | null;
  outcome: SeriesHistoryOutcome;
  /** A failure code (`insufficient_tokens`, `no_topic`, …), a hold (`first_posts_review`, …) or `image_failed`; null when none. */
  reason: string | null;
  at: string;
};

export type PostSeries = PostSeriesFields & {
  series_id: string;
  location_id: string;
  active: boolean;
  /** The zone in use, and where it came from. */
  time_zone: string;
  time_zone_source?: "series" | "location" | "default";
  posts_generated: number;
  /**
   * Phase 25a: whether the server's auto-post planner runs for this series: `on`, `switched_off` (the
   * rollout switch is off) or `not_in_pilot`. Unless `on`, nothing is generated for `next_slots` (show
   * "Automatic AI posts are paused"; "Generate next" still works). Older servers leave it out.
   */
  planner?: AiFeatureState;
  next_slots: string[];
  /** The backend model allows an error without a slot time (`slot_at: null`). */
  last_error: { code: string; message: string; slot_at: string | null; at: string } | null;
  /** The last 20 outcomes, newest first. */
  history: PostSeriesHistoryEntry[];
  /* Phase 25c (older servers leave these out). */
  topic_mode?: SeriesTopicMode;
  keywords?: string[];
  publish_mode?: SeriesPublishMode;
  auto_publish?: SeriesAutoPublish;
  /** The series' posts waiting for review now (no new post is written while 2 wait). */
  waiting_for_review?: number;
  /** Set when the series paused itself (`active: false`); resuming clears it. */
  paused?: { reason: SeriesPauseReason; at: string; post_id: string | null } | null;
  created_at: string;
  updated_at: string;
};

/**
 * `PATCH …/post-series/:id` (Phase 25c, C81): a change of the schedule or content took the series' unpublished
 * posts of future slots back to drafts (`error.code: series_changed`): "N scheduled posts went back to drafts".
 */
export type PostSeriesUpdateResult = PostSeries & { posts_released?: number };

/** `PUT …/post-series/:id/auto-consent`: `consent_version` (1–40 characters) names the app's consent text shown; required to grant. */
export type SeriesAutoConsentInput = { granted: true; consent_version: string } | { granted: false };

/**
 * `GET …/post-series/:id/preview`. Phase 25c, auto mode: `topic` is the backlog topic the slot would take, in
 * order (`topic_id` its id), or null where the backlog runs out (planned when the post is written).
 */
export type SeriesPreview = {
  time_zone: string;
  topic_mode?: SeriesTopicMode;
  slots: { slot_at: string; topic: string | null; topic_id?: string | null; generates_at: string }[];
};
