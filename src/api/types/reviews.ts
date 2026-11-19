/**
 * Reviews (Phase 18): `/locations/:id/reviews`. AI routes spend MyPageSEO tokens. Phase 25b (replies v3,
 * automatic replies, analysis v2) and the 2026-11-17 follow-ups (AI replies and analyses in blocks of 10 per
 * location, updates of a reply on Google, send codes, one review by id). Shapes: backend docs/API.md "Reviews
 * and AI (Phase 18)"; ENDPOINTS #159–#171, #212, #258–#259, #265–#269, #284.
 */
import type { AiFeatureState, AiTokenCosts, AutoReplyPauseReason } from "./ai";
import type { Attribution } from "./locations";

/**
 * `none` (no reply), `draft` (a draft waits), `sent` (published on Google), `failed` (the last send
 * failed: `send_error`). Phase 25a, Google's moderation: `pending` (our reply is on Google and Google
 * is still reviewing it; it counts as replied) and `rejected` (Google rejected it: not public, the
 * review counts as unanswered, and a new reply can be drafted and sent).
 */
export type ReplyState = "none" | "draft" | "sent" | "failed" | "pending" | "rejected";
export type FlagLevel = "none" | "attention" | "suspicious";
export type ReviewReportStatus = "not_reported" | "reported" | "appeal_submitted" | "removed" | "kept";

/* -------------------------------------------------------------------------- */
/* Phase 25a: replies v2 — the checks on a draft and on a text being sent       */
/* -------------------------------------------------------------------------- */

/** `hard`: never sent. `warn`: a person must look first. `regenerate`: a writing note (never blocks). */
export type DraftCheckSeverity = "hard" | "warn" | "regenerate";

export type DraftCheckRule =
  | "too_long"
  | "incentive"
  | "accusation"
  | "promotion"
  | "personal_data"
  | "boilerplate"
  | "duplicate"
  | "grounding"
  | "voice"
  | "format"
  | "length"
  | "language"
  | "keyword"
  | "contact_line"
  | "fault"
  | "restricted"
  | "moderation"
  | "verifier"
  // Phase 25b, the quality checks (`length` and `duplicate` above gain kinds `chars`, `guide_example`, `batch`).
  | "coverage"
  | "parroting"
  | "generic"
  | "attribution"
  | "business_name"
  | "service"
  | "place";

/**
 * One reply-check finding, on `draft.checks` or in a send's `findings`. Phase 25b: a failed judge gate is a
 * `verifier` warning of kind `accuracy`, `policy`, `privacy` or (after "Change it") `request`; `{ rule:
 * "verifier", kind: "unavailable" }` means nothing double-checked the AI's text. 2026-11-17: `{ rule:
 * "restricted", kind: "no_public_reply", severity: "warn", span: null }` comes at send for a law firm's 1-2★ review.
 */
export type DraftCheck = {
  rule: DraftCheckRule | (string & {});
  kind: string;
  severity: DraftCheckSeverity;
  /** Where in the text: UTF-16 offsets (as JavaScript counts); null = the whole text (e.g. its length). */
  span: { start: number; end: number; text: string } | null;
  /** What's wrong, in words: always a non-empty string since 2026-11-17 (G2); still typed nullable for older answers. */
  detail: string | null;
};

/**
 * The judge's record of the AI's text (Phase 25b, `draft.quality`; null for a draft the user wrote and for
 * drafts before 25b). `score` (1–5) and `criteria` are null or empty when no judge ran: show no score then.
 * Show the notes of criteria under 4. `scored_text: "candidate"`: the score is of the text before the AI's
 * edit (label it "before the AI's edit", or show none). After the user edits, the score still describes the AI's text.
 */
export type ReplyDraftQuality = {
  score: number | null;
  verdict: "pass" | "revise" | "fail" | null;
  criteria: { key: string; score: number; verified: boolean; passed: boolean; note: string | null }[];
  judge_model: string | null;
  /** `reply@2`, `reply_restricted@2`; after "Change it" `reply_revision@2` or `reply_restricted_revision@2`. */
  rubric: string | null;
  candidates: number;
  decided_by: string | null;
  chosen_by: "judge" | "checks";
  edit: "applied" | "refused" | "reverted" | "unavailable" | "none";
  scored_text: "final" | "candidate";
  metrics: {
    coverage: { covered: number; total: number } | null;
    parroting: number | null;
    generic: { generic: number; sentences: number };
    attribution: { own: number; other: number; method: "vector" | "lexical" } | null;
    businessNames: number;
    servicePhrases: number;
    chars: number;
  } | null;
};

/** The other candidate the writer made ("Try the other version": `POST …/draft/swap`); null when there is none. */
export type ReplyAlternative = {
  text: string;
  checks: DraftCheck[];
  verification: DraftVerification | null;
  /** The judge's score of it (1–5), or null. */
  score: number | null;
  keywords_used: string[];
};

/** The AI verifier and moderation on the AI's text; null for a draft the user wrote. */
export type DraftVerification = "passed" | "flagged" | "unavailable";

export type ReviewDraft = {
  text: string;
  source: "ai" | "user";
  /** The text differs from the AI's `original_text`. */
  edited?: boolean;
  generated_at?: string | null;
  /** The review changed since the draft was made. */
  stale: boolean;
  /* Phase 25a provenance: null or empty on drafts written before 25a. */
  /** The AI's text as shown (null for a draft the user wrote). */
  original_text?: string | null;
  /** The tracked keywords the current text uses. */
  keywords_used?: string[];
  /** The reply checks on the current text (re-run on every save). */
  checks?: DraftCheck[];
  verification?: DraftVerification | null;
  model?: string | null;
  prompt_version?: string | null;
  /** The review's language (null when its text is too short to tell). */
  language?: string | null;
  /** A law firm's reply to a 1–2★ review in restricted mode: the business may prefer not to reply publicly. */
  recommendation?: "no_public_reply" | null;
  /** The "Change it" request the AI followed (the accepted part), else null. */
  instructions?: string | null;
  /**
   * 2026-11-17 (G3): an update of the reply on Google (a draft saved or changed with "Change it" while the review
   * had a reply there): show it in "Drafts to check" as "Replaces the reply on Google"; sent one at a time. A draft
   * with `replaces_reply: false` while `reply_state` is `sent` or `pending` was left behind ("Written before the
   * reply on Google"): sending it answers 409 `draft_predates_reply`; save it again (it becomes an update) or delete it.
   */
  replaces_reply?: boolean;
  /** Phase 25b: the judge's record of the AI's text. */
  quality?: ReplyDraftQuality | null;
  /** Phase 25b: the other candidate ("Try the other version"), or null. */
  alternative?: ReplyAlternative | null;
};

/** Google's moderation of the reply as last read (Phase 25a). `reason` is Google's, for a rejection only. */
export type ReplyModeration = { state: "pending" | "published" | "rejected"; reason: string | null; checked_at: string | null };

/**
 * A failed send's kind (2026-11-17, G4; the same words as a failed post's `error.code`): `reconnect_required`
 * (offer Reconnect), `google_unavailable` (try again later), `google_rejected_request` (show `reason` /
 * `send_error`), `not_configured` (contact support), `send_failed` (anything else).
 */
export type SendErrorCode = "reconnect_required" | "google_unavailable" | "google_rejected_request" | "not_configured" | "send_failed";

/** Where an automatic reply stands (Phase 25b `review.auto.state`): `queued`/`drafting` (being written), `scheduled` ("Goes out at …"), `sending`, `sent`, `held` (waits for a person), `cancelled` (a person took over, or the review changed). */
export type AutoReplyState = "queued" | "drafting" | "held" | "scheduled" | "sending" | "sent" | "cancelled";

/** `review.auto` (Phase 25b): null when the review isn't handled automatically. Show `labels` (the fixed words of `reasons`). */
export type ReviewAutoReply = {
  state: AutoReplyState;
  reasons: string[];
  labels: string[];
  scheduled_for: string | null;
  at: string;
};

/** Analysis v2 (Phase 25b): what the reviewer mentioned, each with its quote from the review (highlight it). */
export type ReviewMention = {
  kind: "service" | "product" | "staff" | "outcome" | "complaint" | "question" | (string & {});
  text: string;
  /** The reviewer's own words; drop one you can't find in the review. */
  quote: string;
  sentiment: "positive" | "negative" | "neutral" | (string & {});
  /** The business's service it names, else null. */
  service: string | null;
};

export type ReviewRisk =
  | "safety"
  | "injury"
  | "legal"
  | "discrimination"
  | "health"
  | "billing"
  | "staff_conduct"
  | "competitor"
  | "personal_data"
  | (string & {});

export type ReviewEmotion = "delighted" | "grateful" | "satisfied" | "neutral" | "disappointed" | "frustrated" | "angry" | "worried" | (string & {});

export type Review = {
  review_id: string;
  rating: number | null;
  comment: string | null;
  reviewer: { display_name: string | null; is_anonymous: boolean } | null;
  create_time: string | null;
  update_time: string | null;
  /** The reply on Google, if any. */
  reply: { comment: string | null; update_time?: string | null } | string | null;
  reply_state: ReplyState;
  /** Phase 25a: Google's moderation of our reply; kept on a new draft so it can say why the last one was rejected. */
  reply_moderation?: ReplyModeration | null;
  sent_at: string | null;
  send_error: string | null;
  /** 2026-11-17 (G4): the last failed send's kind (null after a successful send). A failed update keeps `sent`/`pending` and shows these. */
  send_error_code?: SendErrorCode | null;
  /** Phase 25b: how our reply went out: `user`, `auto` ("Sent automatically"), or null (no reply of ours). */
  sent_via?: "user" | "auto" | null;
  /** Phase 25b: where an automatic reply stands; null when the review isn't handled automatically. */
  auto?: ReviewAutoReply | null;
  draft: ReviewDraft | null;
  flags: { code: string; source: "system" | "ai" | string; label: string; detail?: string | null }[];
  flag_level: FlagLevel;
  analysis: {
    sentiment: string | null;
    severity: string | null;
    suspicious_indicators: string[];
    summary: string | null;
    recommended_action: string | null;
    analyzed_at: string | null;
    stale: boolean;
    /* Phase 25b, analysis v2: an analysis made before has `version: 1`, `mentions: []`, `risks: []` and the rest null. */
    version?: number;
    /** At most 8, the most important first. */
    mentions?: ReviewMention[];
    risks?: ReviewRisk[];
    emotion?: ReviewEmotion | null;
    asks_question?: boolean | null;
    /** ISO 639-1. */
    language?: string | null;
  } | null;
  appeal: { text: string; policy_reason: string; generated_at: string | null; stale: boolean } | null;
  report_status: ReviewReportStatus;
  ai_reply_eligible: boolean;
  /** `already_replied`, `flagged`, `no_rating`, or (25a) `deleted_on_google`. */
  ai_reply_skip_reason: string | null;
  appeal_eligible: boolean;
  first_seen_at: string | null;
  /** Phase 25a: set when the review is gone from Google (deleted, or removed after a report). */
  deleted_on_google_at?: string | null;
};

/** @deprecated The summary sends the plan's six AI prices: use `AiTokenCosts`. */
export type ReviewTokenCosts = AiTokenCosts;

/**
 * 2026-11-17: the location's AI replies and analyses left (bought in blocks of `block_size`, 10, at
 * `token_costs.reply_drafts_per_10` / `analysis_per_10` each). Costs: `src/lib/reviews/reply-credits.ts`.
 */
export type ReplyCredits = { block_size: number; replies_left: number; analyses_left: number };

/**
 * Phase 25a: an agency's authorization to reply for its client (Google's API policy). In an agency
 * organization `POST reviews/send` answers 409 `reply_authorization_required` until it is granted.
 */
export type ReplyAuthorization = {
  required: boolean;
  granted: boolean;
  /** How it was given. */
  method: "client" | "owner_attestation" | null;
  user_id: string | null;
  consent_version: string | null;
  at: string | null;
  client_id: string | null;
  /** How the signed-in user can grant or revoke it; null = they can't (a member). */
  grant_method: "client" | "owner_attestation" | null;
  /**
   * 2026-11-17: who granted it (`user_id`), by profile name; null for a deleted or unnamed account, and for a
   * client user looking at the agency's staff (show "Your agency"). Never an email.
   */
  user_name?: string | null;
};

/** `GET reviews/summary` (no AI). */
export type ReviewsSummary = {
  stats: {
    total: number;
    average_rating: number | null;
    new_this_month: number;
    positive: number;
    negative: number;
    unreplied: number;
    awaiting_attention: number;
    flagged: number;
    suspicious: number;
    drafts_pending: number;
    replies_sent_this_month: number;
    /** Phase 25a: replies Google is still reviewing (they count as replied). */
    replies_pending?: number;
    /** Phase 25a: replies Google rejected (they count as unanswered). */
    replies_rejected?: number;
    /** 2026-11-17 (G3): drafts updating a reply on Google (`GET …/reviews?reply_update=true`); not in `drafts_pending`. */
    reply_updates_pending?: number;
    /** Phase 25b: automatic replies on and paused by Google's answer or MyPageSEO (not by a person). */
    auto_reply_paused?: { reason: AutoReplyPauseReason; at: string } | null;
    last_review_at: string | null;
    updated_at: string | null;
  } | null;
  /** Phase 25a: the agency's reply authorization for this location (business organizations: not required). */
  reply_authorization?: ReplyAuthorization | null;
  /** Phase 25b: the location's automatic replies ("Automatic replies: on · 3 sent this week · 1 held"); details in `GET …/reviews/auto-reply`. */
  auto_reply?: { enabled: boolean; sent_7d: number; held_7d: number; paused: { reason: AutoReplyPauseReason; at: string } | null } | null;
  last_synced_at: string | null;
  last_refreshed_at: string | null;
  next_refresh_allowed_at: string | null;
  v4_enabled: boolean;
  gbp_connected: boolean;
  ai: {
    configured: boolean;
    /** Also true once the organization has spent its share of today's AI budget (`ai_org_budget_reached`). */
    paused_today: boolean;
    /** The plan's six AI prices (`post_topics` is gone since 2026-11-17). */
    token_costs: AiTokenCosts;
    token_balance: number;
    /** 2026-11-17: the location's AI replies and analyses left ("AI replies left: 4"). Older servers leave it out. */
    credits?: ReplyCredits;
    /** Phase 9.1: unreplied, non-suspicious reviews without a current draft (25a: stars-only 4–5★ left out). */
    draftable?: number;
    /**
     * Tokens to draft them all: since 2026-11-17 the blocks of 10 they need beyond `credits.replies_left`, times
     * `reply_drafts_per_10` (an upper bound for "Draft all" with its defaults).
     */
    draft_all_cost?: number;
    /** Reviews per drafts request and per "Draft all" call: 6 by default since Phase 25b, a server setting (1–50): read it, never hard-code it. */
    draft_all_max?: number;
    /** Phase 25a: stars-only 4–5★ reviews waiting for a draft (only with `include_stars_only`). */
    stars_only_draftable?: number;
    /** Phase 25a: how many stars-only reviews "Draft all" may still draft this week (at most 3 per 7 days). */
    stars_only_left?: number;
  };
};

export type ReviewsQuery = {
  rating?: string;
  /** `true` covers `sent` and (25a) `pending`; a `rejected` reply counts as unanswered. */
  replied?: boolean;
  reply_state?: ReplyState;
  flagged?: "any" | "suspicious" | "attention" | "none";
  has_draft?: boolean;
  /** Phase 25a: only the reviews deleted on Google (left out of the default list). */
  deleted_on_google?: boolean;
  /** 2026-11-17 (G3): `true` = the drafts updating a reply on Google ("Drafts to check"); `false` = every other review. */
  reply_update?: boolean;
  search?: string;
  sort?: "newest" | "oldest" | "rating_asc" | "rating_desc";
  page?: number;
  limit?: number;
};

export type ReviewsList = { reviews: Review[]; page: number; limit: number; total: number; attribution?: Attribution };

/** `GET …/reviews/:reviewId` (2026-11-17, G5): the list's review object, also for one deleted on Google. 404 `review_not_found`. */
export type ReviewDetail = { review: Review; attribution?: Attribution };

export type ReviewsInsights = {
  generated_at: string;
  ai_model?: string;
  basis: { reviews_total: number; reviews_sent: number; from: string | null; to: string | null };
  insight: {
    themes: { theme: string; mentions: number; sentiment: string }[];
    praise: string[];
    complaints: string[];
    observations: string[];
  };
  tokens_spent?: number;
};

/* -------------------------------------------------------------------------- */
/* Sending, "Change it" and "Draft all" (Phase 25a shapes)                      */
/* -------------------------------------------------------------------------- */

/** A reply on Google the app didn't show (409 `reply_changed_on_google`): stored and returned, nothing sent. */
export type GoogleReply = { comment: string | null; update_time: string | null };

/**
 * Why a review in a send of several was skipped: `not_found`, `no_draft`, `deleted_on_google`, and (25a)
 * `checks_failed` (a hard finding), `needs_review` (a warning: send it on its own) or
 * `reply_changed_on_google` (+ `google_reply`); 2026-11-17: `replaces_published_reply` (a draft over a reply on
 * Google: "Send updates one at a time") and `deadline` (not sent yet: "Send the rest" sends these ids again).
 */
export type SendSkipReason =
  | "not_found"
  | "no_draft"
  | "deleted_on_google"
  | "checks_failed"
  | "needs_review"
  | "reply_changed_on_google"
  | "replaces_published_reply"
  | "deadline";

export type SendResult = {
  review_id: string;
  status: "sent" | "failed" | "skipped";
  /** A skip's reason, or a failure's message to show. */
  reason: SendSkipReason | (string & {}) | null;
  /** 2026-11-17 (G4), a failed result: what kind of failure (what to offer). */
  code?: SendErrorCode | null;
  /** The hard and warn findings (shaped like `draft.checks`). */
  findings?: DraftCheck[];
  /** Moderation couldn't run on this text; it never holds a reply back by itself. */
  moderation_unavailable?: boolean;
  google_reply?: GoogleReply | null;
};

export type SendRepliesResponse = { results: SendResult[]; sent: number; failed: number };

/** A part of a "Change it" request the AI left out because it breaks the reply rules. */
export type DeclinedInstruction = {
  text: string;
  /** `offer`, `contact_details`; in restricted mode also `name`, `date`, `treatment`. */
  reason: "offer" | "contact_details" | "name" | "date" | "treatment" | (string & {});
};

export type ReviseDraftResponse = {
  review: Review;
  draft: ReviewDraft;
  declined_instructions: DeclinedInstruction[];
  /** The tokens of the blocks this request bought and kept (usually 0). */
  tokens_spent: number;
  /** 2026-11-17: the location's AI replies left after it ("Change it" uses one). */
  replies_left?: number;
};

/** `POST …/reviews/:reviewId/draft/swap` ("Try the other version", free): the replaced text becomes the new `alternative`. */
export type SwapDraftResponse = { review: Review; draft: ReviewDraft };

/**
 * Why a review got no draft: `already_replied`, `flagged`, `no_rating`, `not_found`, `deleted_on_google`; Phase
 * 25b the AI's reason when others got theirs (`ai_failed`, `ai_budget_reached`, `ai_org_budget_reached`,
 * `ai_not_configured`), `draft_changed` (a person changed the draft meanwhile: theirs is kept) and `deadline`
 * (not written in time: "Draft it again"; nothing spent). `insufficient_tokens` is no longer one (2026-11-17).
 */
export type DraftSkipReason =
  | "already_replied"
  | "flagged"
  | "no_rating"
  | "not_found"
  | "deleted_on_google"
  | "ai_failed"
  | "ai_budget_reached"
  | "ai_org_budget_reached"
  | "ai_not_configured"
  | "draft_changed"
  | "deadline";

export type DraftSkip = { review_id: string; reason: DraftSkipReason | (string & {}) };

/** `POST …/reviews/drafts` (at most `ai.draft_all_max` ids, 6 by default; more is 400 `invalid_input`). */
export type GenerateDraftsResponse = {
  drafts: Review[];
  generated: number;
  reused: number;
  skipped: DraftSkip[];
  /** The tokens of the blocks this request bought and kept (usually 0). */
  tokens_spent: number;
  /** 2026-11-17: the location's AI replies left after it: write it into the cached summary. */
  replies_left?: number;
};

/** `POST …/reviews/analyze` (at most `ai.draft_all_max` ids). */
export type AnalyzeReviewsResponse = {
  reviews: Review[];
  analyzed: number;
  reused: number;
  /** `no_text`, `not_found`, `deleted_on_google`, and the AI reasons of a call that failed while another answered. */
  skipped: { review_id: string; reason: string }[];
  tokens_spent: number;
  /** 2026-11-17: the location's AI analyses left after it. */
  analyses_left?: number;
};

/**
 * The 402 `insufficient_tokens` body of the AI reply routes (2026-11-17), before anything is held or spent:
 * `cost` (the tokens for the blocks missing), `balance`, `reviews` (how many the click needs) and
 * `replies_left` (Analyze: `analyses_left`). Message: `src/lib/reviews/reply-credits.ts`.
 */
export type InsufficientCreditsData = {
  reason: "insufficient_tokens";
  cost: number;
  balance: number;
  reviews?: number;
  replies_left?: number;
  analyses_left?: number;
};

export type DraftAllRequest = {
  /** Redraft reviews that already have an AI draft (drafts the user wrote or edited are kept otherwise). */
  regenerate?: boolean;
  /** The previous answer's `next_cursor` (Phase 25a), so "Continue" progresses instead of redrafting the same reviews. */
  cursor?: string | null;
  /** Phase 25a: include stars-only 4–5★ reviews (at most `stars_only_left` this week). */
  include_stars_only?: boolean;
};

export type DraftAllResponse = {
  drafted: number;
  /**
   * What later calls would draft (stars-only reviews only with `include_stars_only`, within `stars_only_left`).
   * 2026-11-17: reviews skipped as `deadline` count again, and `next_cursor` ends just before the first of them
   * (except with `regenerate`), so "Continue" drafts them again.
   */
  remaining: number;
  /** Send back as `cursor` on "Continue"; null = nothing left. A position: it never expires. */
  next_cursor: string | null;
  tokens_spent: number;
  /** 2026-11-17: the location's AI replies left after this page. */
  replies_left?: number;
  /** Phase 25b: the page's reviews that got no draft (behind the cursor, except `deadline`). */
  skipped?: DraftSkip[];
  drafts: Review[];
};

/* -------------------------------------------------------------------------- */
/* Automatic replies to 4–5★ reviews (Phase 25b; behind a rollout switch)       */
/* -------------------------------------------------------------------------- */

/** How the caller may consent: `owner` (a Business organization's owner), `client` (a client user of the location's client), `owner_attestation` (the agency owner). */
export type AutoReplyConsentMethod = "owner" | "client" | "owner_attestation";

/**
 * A pause: `resume` says who may lift it: `write` (whoever may switch off), `consent` (whoever may switch on,
 * with its checks) or `admin` (only MyPageSEO: "Paused by MyPageSEO"; `detail` is MyPageSEO's note; for
 * `google_rejected` it is Google's reason).
 */
export type AutoReplyPause = {
  reason: AutoReplyPauseReason;
  at: string;
  detail: string | null;
  resume: "write" | "consent" | "admin";
};

/** `GET/PUT …/reviews/auto-reply`. Show the settings card only when `feature` is `on`. */
export type AutoReplySettings = {
  feature: AiFeatureState;
  /** Only while a consent holds. */
  enabled: boolean;
  /** `[5]` or `[4, 5]`. */
  ratings: number[];
  stars_only: boolean;
  /** Automatic replies per 24 h, 1 to `daily_cap_max` (20); 5 by default. */
  daily_cap: number;
  daily_cap_max: number;
  paused: AutoReplyPause | null;
  /** Who agreed (`user_name`: by name; null for a deleted or unnamed account, or hidden from a client user: "Your agency"). */
  consent: {
    method: AutoReplyConsentMethod;
    user_id: string;
    user_name?: string | null;
    consent_version: string;
    at: string;
    client_id: string | null;
  } | null;
  /** How the caller may switch on or widen; null: they can't (a member: "Ask the account owner or your client"). */
  consent_method: AutoReplyConsentMethod | null;
  /** The text to show the caller before switching on or widening (null when they can't). */
  consent_text: string | null;
  /** Send it back with a widening change. */
  consent_version: string;
  /** An agency needs the client's reply authorization first (the Reviews page's banner). */
  reply_authorization_required: boolean;
  gbp_connected: boolean;
  sent_7d: number;
  held_7d: number;
  scheduled: number;
};

/**
 * `PUT …/reviews/auto-reply`: the fields that change (absent = kept), with `consent_version` when switching on or
 * widening (adding 4★, stars only on, a higher cap); or `{ paused: true | false }` alone. Switching off, narrowing
 * and pausing need no consent.
 */
export type AutoReplyUpdate =
  | { enabled?: boolean; ratings?: [5] | [4, 5]; stars_only?: boolean; daily_cap?: number; consent_version?: string }
  | { paused: boolean };

/** `POST /public/reviews/weekly-email/opt-out`: "You won't get these weekly emails for <organization_name> any more". */
export type WeeklyEmailOptOutResult = { opted_out: boolean; organization_name: string };
