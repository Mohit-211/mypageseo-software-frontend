/**
 * AI on posts (Phase 25c and the follow-ups of 2026-11-16/17): background runs, the topic backlog, and the
 * requests behind "Write with AI", "Change it", "Create image", "Generate next", "Post ideas" and "Plan now".
 *
 * Every one of those buttons answers 202 `{ run, existing }` and the work goes on in a job; the app polls the
 * run (`src/lib/posts/ai-runs.ts` has the hooks). Shapes: backend docs/API.md "Background AI runs
 * (2026-11-16)", "In the editor", "Auto-posts (series)", "Post topics (Phase 25c)"; ENDPOINTS #213, #214,
 * #224, #227, #270–#273, #285–#286.
 */
import type { AiImageStyle, CtaType, Post, PostImageSource, PostLogoOutcome, PostMediaDetails, PostSeries, PostTone, PostType } from "./posts";

/* -------------------------------------------------------------------------- */
/* Runs                                                                         */
/* -------------------------------------------------------------------------- */

/** `draft` (Write with AI), `revise` (Change it), `image` (Create image), `series_next` (Generate next), `plan` (Post ideas, Plan now). */
export type PostAiRunKind = "draft" | "revise" | "image" | "series_next" | "plan";

/** `queued` and `running` are active (poll every 3 s); `done` and `failed` are final. */
export type PostAiRunStatus = "queued" | "running" | "done" | "failed";

/**
 * For the progress text (may be null): `waiting` (another post of the location, or a topic plan, is being made
 * first), `planning`, `writing`, `picture`.
 */
export type PostAiRunStep = "waiting" | "planning" | "writing" | "picture";

/**
 * Every post view's `ai_run`: what works on the post now. A run holding it (poll `run_id`), or a series post its
 * series is writing (`run_id: null`, `kind: "series_slot"`: nothing to poll, reload the post later).
 */
export type PostAiRunMarker =
  | { run_id: string; kind: PostAiRunKind; status: PostAiRunStatus; step: PostAiRunStep | null }
  | { run_id: null; kind: "series_slot"; status: "running"; step: null };

/**
 * A part of a request left out ("We left out: …"): `contact_details` (a phone number, link, email or handle),
 * `google_rules` (hashtags, emoji, …), or the AI's own reason when the facts don't support it.
 */
export type PostDeclinedInstruction = { text: string; reason: "contact_details" | "google_rules" | (string & {}) };

/**
 * Why a run failed: `code` (= `data.reason`), the message, the HTTP status the route would have answered at once
 * and its body (`data`: null for a client user). Handle `code` with `data` as the same error at once
 * (`runErrorFrom` in `src/lib/posts/ai-runs.ts` makes an `ApiError` of it). Besides the routes' own codes:
 * `post_changed`, `access_removed`, `read_only`, `location_removed`, `timed_out`, `interrupted`, `internal_error`,
 * `enqueue_failed`; Generate next also `series_changed`. A failed run costs nothing.
 */
export type PostAiRunError = { code: string; message: string; status: number; data: Record<string, unknown> | null };

/**
 * A picture made inside a draft or a "Change it" run (`image: true` / `image: "new"`). `attached: true`: it is on
 * the post. `attached: false` with `media`: the post changed meanwhile (it is charged: offer "Use this picture").
 * `media: null` with `reasons`: none could be made; the post is text only (not a failure).
 */
export type AiPictureResult = {
  media: PostMediaDetails | null;
  attached: boolean;
  /** `post_changed`, `invalid_status`, …; null when attached or no picture. */
  attach_error: string | null;
  source: PostImageSource;
  logo: PostLogoOutcome;
  reasons: string[];
};

/**
 * Write with AI's result: `post` is the new (or filled) draft as `GET …/posts/:postId` shows it: open it in the
 * editor. `topic`: the backlog topic it used (null for a typed one). `declined_instructions` ("We left out: …")
 * and `proposed_facts` (statements to offer as owner facts) and `tokens_spent` are absent for client users.
 * Anything deleted since is null.
 */
export type AiDraftResult = {
  post: Post | null;
  topic: PostTopic | null;
  declined_instructions?: PostDeclinedInstruction[];
  proposed_facts?: string[];
  tokens_spent?: number;
  image: AiPictureResult | null;
};

/** Change it's result. `unscheduled: true`: "Review it, then schedule it again" (the new text didn't pass every check). */
export type AiReviseResult = {
  post: Post | null;
  unscheduled: boolean;
  declined_instructions?: PostDeclinedInstruction[];
  proposed_facts?: string[];
  tokens_spent?: number;
  image: AiPictureResult | null;
};

/**
 * Create image's result. With the `post_id` of a post not on Google yet the picture replaces its photo
 * (`attached: true`, `post` the updated post); otherwise it comes back unattached (`attach_error`; offer "Use
 * this picture"). A picture asked without a `post_id` is never attached: add `media.media_id` to the post.
 * `media: null` with `reasons` (`judge_rejected`, `moderation_blocked`, `ai_images_off`, …) means no picture.
 */
export type AiImageResult = {
  media: PostMediaDetails | null;
  attached: boolean;
  attach_error: string | null;
  post: Post | null;
  /** The style asked for, else null. */
  style: AiImageStyle | null;
  source: PostImageSource;
  logo: PostLogoOutcome;
  reasons: string[];
  tokens_spent?: number;
};

/**
 * Generate next's outcome: `generated` (handed over as the series' mode says), `held` (an automatic post a safety
 * rule holds for a person: `reason` is its first hold) or `not_handed_over` (it stayed a draft with its `error`;
 * a person decides; it is charged). Show the post's state from `post.status`.
 */
export type SeriesNextOutcome = "generated" | "held" | "not_handed_over";

export type SeriesNextResult = {
  post: Post | null;
  series: PostSeries | null;
  outcome: SeriesNextOutcome | null;
  /** `image_failed` with `generated` (no picture could be made); the first hold with `held`. */
  reason: string | null;
  tokens_spent?: number;
};

/** A plan's result (Post ideas, Plan now): show `topics` (the new ones, best first), then reload `GET …/posts/topics`. */
export type TopicPlanResult = { planned: number; backlog_full: boolean; topics: PostTopic[]; suggestions: TopicSuggestion[] };

type PostAiRunOf<K extends PostAiRunKind, R> = {
  run_id: string;
  kind: K;
  status: PostAiRunStatus;
  step: PostAiRunStep | null;
  location_id: string;
  /**
   * The post being filled, changed or pictured. A new draft has none until its post exists (the end of
   * `writing`); null for a picture asked without a `post_id`; Generate next's slot post at once.
   */
  post_id: string | null;
  /** Generate next: its series and slot. */
  series_id: string | null;
  slot_at: string | null;
  /** Who started it ("Sam is writing this post"); null for a client user. `name` is null for an unnamed account. */
  requested_by: { user_id: string; name: string | null } | null;
  /** The request as accepted; null for a client user. */
  input: Record<string, unknown> | null;
  /** The parts of the request declined at once (empty for a client user). */
  declined_instructions: PostDeclinedInstruction[];
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  /** Once `done`: what it delivered, as the reader sees it. Null until then. */
  result: R | null;
  /** Once `failed`. */
  error: PostAiRunError | null;
};

export type PostAiDraftRun = PostAiRunOf<"draft", AiDraftResult>;
export type PostAiReviseRun = PostAiRunOf<"revise", AiReviseResult>;
export type PostAiImageRun = PostAiRunOf<"image", AiImageResult>;
export type PostAiSeriesNextRun = PostAiRunOf<"series_next", SeriesNextResult>;
export type PostAiPlanRun = PostAiRunOf<"plan", TopicPlanResult>;

/**
 * A background AI run on posts, as `GET …/posts/ai-runs[/:runId]`, the 202 of the start routes and a 409
 * `generation_in_progress` (`data.run`) show it. Narrow on `kind` to read its typed `result`. Kept 7 days; then
 * `GET` answers 404 `run_not_found` (the post stays).
 */
export type PostAiRun = PostAiDraftRun | PostAiReviseRun | PostAiImageRun | PostAiSeriesNextRun | PostAiPlanRun;

/**
 * The 202 of a start route. `existing: true`: this same request is already running (a double click, or a
 * teammate asked for exactly the same): show that run; nothing new started.
 */
export type PostAiRunStart<R extends PostAiRun = PostAiRun> = { run: R; existing: boolean };

/**
 * The reasons (`data.reason`, a failed run's `error.code`) of the AI post routes and runs, 2026-11-17. New with the
 * runs: `ai_org_budget_reached` (503: the organization's share of today's AI budget is used; it resumes tomorrow),
 * `run_not_queued` (503: nothing was spent, try again), `generation_in_progress` (409 with `data.run`: another AI
 * action holds the post or action; show and poll that run) and `series_paused` (409: resume the series first).
 * Gone: `topics_planning`, posts' `revision_in_progress` (replies keep it).
 */
export type PostAiErrorCode =
  // At once.
  | "invalid_input"
  | "instructions_declined"
  | "no_text"
  | "subject_required"
  | "post_not_found"
  | "topic_not_found"
  | "series_not_found"
  | "post_not_empty"
  | "invalid_status"
  | "topic_not_available"
  | "no_slots"
  | "series_paused"
  | "generation_in_progress"
  | "insufficient_tokens"
  | "ai_not_configured"
  | "ai_budget_reached"
  | "ai_org_budget_reached"
  | "run_not_queued"
  | "rate_limited"
  | "subscription_required"
  | "organization_suspended"
  | "feature_not_included"
  | "read_only"
  // On a run (besides the codes above when they happen later).
  | "ai_failed"
  | "no_topic"
  | "post_changed"
  | "series_changed"
  | "access_removed"
  | "location_removed"
  | "timed_out"
  | "interrupted"
  | "internal_error"
  | "enqueue_failed"
  // Reading a run.
  | "run_not_found";

/** The body of a 409 `generation_in_progress`: the run holding the post or action (null for a series post its series is writing). */
export type GenerationInProgressData = { reason: "generation_in_progress"; run: PostAiRun | null };

/** `GET …/posts/ai-runs`: `active` (the default) lists every queued or running run, newest first, not paged; `recent` those finished in the last 24 h. */
export type PostAiRunsQuery = { status?: "active" | "recent"; post_id?: string | null; page?: number; limit?: number };

export type PostAiRunsList = { runs: PostAiRun[]; total: number; page: number; limit: number };

/* -------------------------------------------------------------------------- */
/* The requests                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `POST …/posts/ai-draft` ("Write with AI"; it saves a draft). Without `topic` and `topic_id` the planner picks the
 * best waiting topic; `topic_id` writes a backlog topic; `topic` (3–300) a typed one (not both). `keywords` ≤ 3
 * (at most 2 used), `instructions` ≤ 500. `post_id` fills a draft without text the user started. `image: true`
 * makes the picture in the same run (else call `aiPostImage({ post_id })` next).
 */
export type AiDraftInput = {
  topic?: string | null;
  topic_id?: string | null;
  tone?: PostTone;
  type?: PostType;
  cta_type?: CtaType | null;
  language_code?: string;
  keywords?: string[];
  instructions?: string | null;
  image?: boolean;
  post_id?: string | null;
};

/**
 * `POST …/posts/:postId/ai-revise` ("Change it", on a post not on Google yet): as asked (`instructions` ≤ 500), or
 * without them a clearly different post on the same topic. `image: "new"` makes a new picture once the text is saved.
 */
export type AiReviseInput = { instructions?: string | null; image?: "keep" | "new" };

/**
 * `POST …/posts/ai-image`: a saved post's picture (`post_id`, from its text) or a description's (`prompt_hint`,
 * 3–500; with the `post_id` of a post without text it says what the picture shows). `style` skips the library.
 */
export type AiImageInput = ({ post_id: string; prompt_hint?: string } | { post_id?: null; prompt_hint: string }) & {
  style?: AiImageStyle | null;
};

/* -------------------------------------------------------------------------- */
/* Topics (`/posts/topics`, Phase 25c: planned automatically, never repeated)   */
/* -------------------------------------------------------------------------- */

export type TopicAngle =
  | "service_spotlight"
  | "practical_tip"
  | "faq_answer"
  | "seasonal_advice"
  | "local_angle"
  | "behind_the_scenes"
  | "offer"
  | "event";

/** `proposed` (waiting, in the backlog) → `reserved` (picked for a draft or a slot) → `used`; or `dismissed`, `expired`. */
export type TopicStatus = "proposed" | "reserved" | "used" | "dismissed" | "expired";

export type TopicSource =
  | "service"
  | "faq"
  | "differentiator"
  | "owner_fact"
  | "offer"
  | "event"
  | "season"
  | "holiday"
  | "local"
  | "category";

/**
 * Why a topic was planned: `service_new`, `keyword_due`, `keyword_top10`, `keyword_top20`, `keyword_low`,
 * `season`, `season_ahead`, `holiday`, `faq`, `owner_offer`, `owner_event`, `review_theme`.
 */
export type TopicReason =
  | "service_new"
  | "keyword_due"
  | "keyword_top10"
  | "keyword_top20"
  | "keyword_low"
  | "season"
  | "season_ahead"
  | "holiday"
  | "faq"
  | "owner_offer"
  | "owner_event"
  | "review_theme"
  | (string & {});

/** A planned post topic (best first in the backlog). */
export type PostTopic = {
  topic_id: string;
  title: string;
  question: string | null;
  angle: TopicAngle;
  /** The angle in words ("Practical tip"). */
  angle_label: string;
  type: PostType;
  source: TopicSource;
  /** What it is about, in today's words (null when that subject is gone). */
  subject: { ref: string | null; label: string | null };
  service_ref: string | null;
  pillar: { id: string; name: string | null } | null;
  /** The tracked keyword it uses (a used topic: the one its post used); null: none. */
  keyword: string | null;
  fact_ids: string[];
  reasons: TopicReason[];
  fits: { season: string | null; holiday: string | null; holiday_date: string | null };
  valid_until: string | null;
  status: TopicStatus;
  post_id: string | null;
  brief_version: number | null;
  focus: string | null;
  planned_at: string;
  reserved_at: string | null;
  used_at: string | null;
  closed_at: string | null;
  /** Why it expired: `age`, `brief_changed`, `timing`, `fact_gone`, `repeat`, `covered`, `replaced`. */
  closed_reason: string | null;
};

/** Ask the owner for an offer or an event in AI facts (offer and event topics come only from the owner's own). */
export type TopicSuggestion = { code: "add_offer" | "add_event" | (string & {}); message: string };

export type ContentPillar = { id: string; name: string; description: string; source: "brief" | "default" };

/** `GET …/posts/topics` (no AI; client users read it too). */
export type PostTopicsList = {
  /** Waiting, best first (at most `limits.backlog_max`). */
  backlog: PostTopic[];
  reserved: PostTopic[];
  /** At most 10. */
  recently_used: PostTopic[];
  /** At most 20. */
  dismissed: PostTopic[];
  suggestions: TopicSuggestion[];
  pillars: ContentPillar[];
  brief_version: number | null;
  limits: { backlog_max: number; expire_days: number; repeat_days: number };
};

/**
 * `POST …/posts/ai-topics { count, focus? }` ("Post ideas", free). 200 with `run: null` when enough ideas wait
 * and there is no `focus` (or a plan can't start but ideas wait); else 202 with what waits now (`topics`, may be
 * empty) and a plan run whose result holds the new ideas.
 */
export type PostIdeasAnswer = {
  topics: PostTopic[];
  planned: number;
  suggestions: TopicSuggestion[];
  tokens_spent: number;
  run: PostAiPlanRun | null;
  existing?: boolean;
};

/**
 * `POST …/posts/topics/plan { focus? }` ("Plan now", free): 200 with the list and `backlog_full: true` when the
 * backlog is full and there is no `focus`; else 202 `{ run, existing }`. Tell them apart with `isRunStart`.
 */
export type PlanTopicsAnswer = (PostTopicsList & { planned: number; backlog_full: boolean }) | PostAiRunStart<PostAiPlanRun>;
