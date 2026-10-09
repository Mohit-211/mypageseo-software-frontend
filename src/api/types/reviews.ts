/** Reviews (Phase 18): `/locations/:id/reviews`. AI routes spend MyPageSEO tokens. */
import type { Attribution } from "./locations";

export type ReplyState = "none" | "draft" | "sent" | "failed";
export type FlagLevel = "none" | "attention" | "suspicious";
export type ReviewReportStatus = "not_reported" | "reported" | "appeal_submitted" | "removed" | "kept";

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
  sent_at: string | null;
  send_error: string | null;
  draft: { text: string; source: "ai" | "user"; edited?: boolean; generated_at?: string | null; stale: boolean } | null;
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
  ai_reply_skip_reason: string | null;
  appeal_eligible: boolean;
  first_seen_at: string | null;
};

export type ReviewTokenCosts = { reply_drafts_per_10: number; analysis_per_10: number; appeal: number; insights: number };

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
    last_review_at: string | null;
    updated_at: string | null;
  } | null;
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
    /** Unreplied, non-suspicious reviews without a current draft (Phase 9.1). */
    draftable?: number;
    /** Tokens to draft all of them. */
    draft_all_cost?: number;
    /** Reviews drafted per "Draft all" call (50). */
    draft_all_max?: number;
  };
};

export type ReviewsQuery = {
  rating?: string;
  replied?: boolean;
  reply_state?: ReplyState;
  flagged?: "any" | "suspicious" | "attention" | "none";
  has_draft?: boolean;
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
