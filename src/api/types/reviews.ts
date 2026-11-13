/** Reviews (Phase 18): `/locations/:id/reviews`. AI routes spend MyPageSEO tokens. */
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
  | "verifier";

/** One reply-check finding, on `draft.checks` or in a send's `findings`. */
export type DraftCheck = {
  rule: DraftCheckRule | (string & {});
  kind: string;
  severity: DraftCheckSeverity;
  /** Where in the text: UTF-16 offsets (as JavaScript counts); null = the whole text (e.g. its length). */
  span: { start: number; end: number; text: string } | null;
  /** What's wrong, in words. The backend allows null; show it through `checkDetailText`. */
  detail: string | null;
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
};

/** Google's moderation of the reply as last read (Phase 25a). `reason` is Google's, for a rejection only. */
export type ReplyModeration = { state: "pending" | "published" | "rejected"; reason: string | null; checked_at: string | null };

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

export type ReviewTokenCosts = { reply_drafts_per_10: number; analysis_per_10: number; appeal: number; insights: number };

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
    last_review_at: string | null;
    updated_at: string | null;
  } | null;
  /** Phase 25a: the agency's reply authorization for this location (business organizations: not required). */
  reply_authorization?: ReplyAuthorization | null;
  last_synced_at: string | null;
  last_refreshed_at: string | null;
  next_refresh_allowed_at: string | null;
  v4_enabled: boolean;
  gbp_connected: boolean;
  ai: {
    configured: boolean;
    paused_today: boolean;
    token_costs: ReviewTokenCosts;
    token_balance: number;
    /** Phase 9.1: unreplied, non-suspicious reviews without a current draft (25a: stars-only 4–5★ left out), and the tokens to draft them all. */
    draftable?: number;
    draft_all_cost?: number;
    /** Reviews drafted per "Draft all" call (20 since Phase 25a; was 50). */
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
  search?: string;
  sort?: "newest" | "oldest" | "rating_asc" | "rating_desc";
  page?: number;
  limit?: number;
};

export type ReviewsList = { reviews: Review[]; page: number; limit: number; total: number; attribution?: Attribution };

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
 * `reply_changed_on_google` (+ `google_reply`).
 */
export type SendSkipReason =
  | "not_found"
  | "no_draft"
  | "deleted_on_google"
  | "checks_failed"
  | "needs_review"
  | "reply_changed_on_google";

export type SendResult = {
  review_id: string;
  status: "sent" | "failed" | "skipped";
  reason: SendSkipReason | (string & {}) | null;
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
  tokens_spent: number;
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
  remaining: number;
  /** Send back as `cursor` on "Continue"; null = nothing left. */
  next_cursor: string | null;
  tokens_spent: number;
  drafts: Review[];
};
