import { api, unwrapData } from "../client";
import type {
  DraftAllRequest,
  DraftAllResponse,
  ReplyAuthorization,
  Review,
  ReviewsInsights,
  ReviewsList,
  ReviewsQuery,
  ReviewsSummary,
  ReviewReportStatus,
  ReviseDraftResponse,
  SendRepliesResponse,
} from "../types/reviews";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/reviews`;
const one = (locationId: string, reviewId: string) => `${base(locationId)}/${encodeURIComponent(reviewId)}`;

/**
 * AI calls wait for the model: up to 60 s per call plus a retry on the backend, and several batches
 * for a selection. Giving up sooner would show "that took too long" while the work (and its charge)
 * still completes.
 */
const AI_TIMEOUT = { timeoutMs: 90_000 } as const;

/** Stat cards, refresh timing and AI availability/costs. No AI. */
export async function getReviewsSummary(locationId: string, signal?: AbortSignal): Promise<ReviewsSummary> {
  return unwrapData(await api.get(`${base(locationId)}/summary`, signal ? { signal } : {}));
}

export async function getReviews(locationId: string, query: ReviewsQuery, signal?: AbortSignal): Promise<ReviewsList> {
  return unwrapData(await api.get(base(locationId), { query, ...(signal ? { signal } : {}) }));
}

/** "Refresh Reviews": new and changed reviews from Google. 429 `rate_limited` (+ `next_allowed_at`), once per 15 min. */
export async function refreshReviews(locationId: string): Promise<{ new_reviews: number; updated_reviews: number; refreshed_at: string }> {
  return unwrapData(await api.post(`${base(locationId)}/refresh`));
}

/** AI reply drafts for unreplied, non-suspicious reviews of any rating (1–20 ids); others come back in `skipped`. */
export async function generateReplyDrafts(
  locationId: string,
  reviewIds: string[],
  regenerate = false,
): Promise<{ drafts: Review[]; generated: number; reused: number; skipped: { review_id: string; reason: string }[]; tokens_spent: number }> {
  return unwrapData(await api.post(`${base(locationId)}/drafts`, { review_ids: reviewIds, regenerate }, AI_TIMEOUT));
}

/**
 * "Draft all unreplied": up to `ai.draft_all_max` per call (20 since Phase 25a), oldest first. Call
 * again while `remaining > 0`, sending the previous answer's `next_cursor` back as `cursor` (Phase 25a:
 * without it, `regenerate` would draft the same reviews again). Stars-only 4–5★ reviews only with
 * `include_stars_only`. 402 `insufficient_tokens` { cost, balance, reviews } comes before anything is
 * spent; an invalid cursor is 400 `invalid_input`.
 *
 * A boolean second argument is the old `regenerate` flag.
 */
export async function draftAllReviews(locationId: string, options: DraftAllRequest | boolean = {}): Promise<DraftAllResponse> {
  const request: DraftAllRequest = typeof options === "boolean" ? { regenerate: options } : options;
  const body = {
    regenerate: request.regenerate ?? false,
    ...(request.cursor ? { cursor: request.cursor } : {}),
    ...(request.include_stars_only ? { include_stars_only: true } : {}),
  };
  const answer = unwrapData<DraftAllResponse>(await api.post(`${base(locationId)}/drafts/all`, body, AI_TIMEOUT));
  // Older servers don't send a cursor: treat it as "nothing to continue from".
  return { ...answer, next_cursor: answer.next_cursor ?? null };
}

/**
 * Saves a reply the user wrote or edited (any rating): 1 to 4,096 bytes of UTF-8 (Google's limit; an
 * emoji counts 4). Phase 25a: the reply checks run again on the saved text, so re-render `draft.checks`
 * from the answer. 400 `invalid_input` over the limit.
 */
export async function saveReplyDraft(locationId: string, reviewId: string, text: string): Promise<Review> {
  return unwrapData(await api.put(`${one(locationId, reviewId)}/draft`, { text }));
}

/**
 * "Change it" (Phase 25a): the AI rewrites the review's current draft as asked (1–500 characters),
 * charged as one reply draft and refunded if it fails. Parts of the request that break the reply rules
 * come back in `declined_instructions` ("We left out: …").
 * 400 `instructions_declined` (every part left out; nothing spent), `no_draft`, `not_eligible`,
 * `deleted_on_google`; 409 `revision_in_progress`, `draft_changed` (refunded: reload); the AI errors.
 */
export async function reviseReplyDraft(locationId: string, reviewId: string, instructions: string): Promise<ReviseDraftResponse> {
  return unwrapData(await api.post(`${one(locationId, reviewId)}/draft/revise`, { instructions }, AI_TIMEOUT));
}

/** Deletes the review's draft. The answer is `{ deleted, review_id }`, not the review: reload the list to show it. */
export async function deleteReplyDraft(locationId: string, reviewId: string): Promise<{ deleted: boolean; review_id: string }> {
  return unwrapData(await api.delete(`${one(locationId, reviewId)}/draft`));
}

/**
 * Publishes each review's draft on Google (no AI; free moderation since Phase 25a). Every reply check
 * runs again on the text sent:
 * - one review: 422 `checks_failed` (+ `review_id`, `findings`: fix the text), 409
 *   `confirm_warnings_required` (+ `findings`: send again with `confirmWarnings`), 409
 *   `reply_changed_on_google` (+ `google_reply`, `review`: Google already has a reply; send again to
 *   replace it, or delete the draft);
 * - several: each result says it (`skipped` with `checks_failed`, `needs_review`, `reply_changed_on_google`,
 *   `deleted_on_google`, `no_draft`, `not_found`); `confirmWarnings` is ignored for several;
 * - an agency organization: 409 `reply_authorization_required` (+ `reply_authorization`) until the
 *   client's authorization is recorded.
 * A sent reply is `reply_state: "pending"` until Google publishes (`sent`) or rejects it (`rejected`).
 */
export async function sendReplies(
  locationId: string,
  reviewIds: string[],
  options: { confirmWarnings?: boolean } = {},
): Promise<SendRepliesResponse> {
  // Up to 100 ids per call.
  const totals: SendRepliesResponse = { results: [], sent: 0, failed: 0 };
  const confirm = options.confirmWarnings && reviewIds.length === 1 ? { confirm_warnings: true } : {};
  for (let i = 0; i < reviewIds.length; i += SEND_BATCH) {
    const part = unwrapData<SendRepliesResponse>(
      await api.post(`${base(locationId)}/send`, { review_ids: reviewIds.slice(i, i + SEND_BATCH), ...confirm }),
    );
    totals.results.push(...part.results);
    totals.sent += part.sent;
    totals.failed += part.failed;
  }
  return totals;
}

/**
 * Phase 25a, agency organizations: records (or with `granted: false` revokes) the client's
 * authorization to reply for this location. A client user of the location's client grants it
 * (`grant_method: "client"`), the owner attests to it (`owner_attestation`); a member can't (403
 * `client_or_owner_only`). `consent_version` is the version of the consent text shown (1–40 characters).
 * 400 `reply_authorization_not_required` (a business organization), 409 `client_changed` (reload).
 */
export async function setReplyAuthorization(
  locationId: string,
  body: { granted: true; consent_version: string } | { granted: false },
): Promise<ReplyAuthorization> {
  return unwrapData(await api.put(`${base(locationId)}/reply-authorization`, body));
}

const SEND_BATCH = 100;

/** Removes a published reply from Google. 400 `no_reply`. The answer is `{ deleted, review_id }`: reload to show it. */
export async function deleteReply(locationId: string, reviewId: string): Promise<{ deleted: boolean; review_id: string }> {
  return unwrapData(await api.delete(`${one(locationId, reviewId)}/reply`));
}

/** AI analysis: sentiment, severity, suspicious indicators, recommended action. */
export async function analyzeReviews(
  locationId: string,
  reviewIds: string[],
  regenerate = false,
): Promise<{ reviews: Review[]; analyzed: number; reused: number; skipped: { review_id: string; reason: string }[]; tokens_spent: number }> {
  return unwrapData(await api.post(`${base(locationId)}/analyze`, { review_ids: reviewIds, regenerate }, AI_TIMEOUT));
}

/** AI draft of a removal request to paste into Google's tool (`report_url`). 400 `not_eligible`. */
export async function draftAppeal(
  locationId: string,
  reviewId: string,
): Promise<{ review: Review; appeal: NonNullable<Review["appeal"]>; report_url: string; tokens_spent: number }> {
  return unwrapData(await api.post(`${one(locationId, reviewId)}/appeal-draft`, undefined, AI_TIMEOUT));
}

/** Records what the user did on Google. */
export async function setReportStatus(locationId: string, reviewId: string, status: ReviewReportStatus): Promise<Review> {
  return unwrapData(await api.patch(`${one(locationId, reviewId)}/report-status`, { status }));
}

/** The stored insights; 404 `no_insights` before the first run. */
export async function getReviewInsights(locationId: string, signal?: AbortSignal): Promise<ReviewsInsights> {
  return unwrapData(await api.get(`${base(locationId)}/insights`, signal ? { signal } : {}));
}

/**
 * AI insights over the reviews (stored until regenerated). Every run is charged, even one this
 * page stopped waiting for, so a timeout should re-read the stored insights rather than run again.
 */
export async function generateReviewInsights(locationId: string): Promise<ReviewsInsights> {
  return unwrapData(await api.post(`${base(locationId)}/insights`, undefined, AI_TIMEOUT));
}
