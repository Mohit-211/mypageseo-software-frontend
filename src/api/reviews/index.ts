import { api, unwrapData } from "../client";
import type { Review, ReviewsInsights, ReviewsList, ReviewsQuery, ReviewsSummary, ReviewReportStatus } from "../types/reviews";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/reviews`;
const one = (locationId: string, reviewId: string) => `${base(locationId)}/${encodeURIComponent(reviewId)}`;

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
  return unwrapData(await api.post(`${base(locationId)}/drafts`, { review_ids: reviewIds, regenerate }));
}

/**
 * "Draft all unreplied": up to 50 per call, oldest first (10–15 s). Call again while `remaining > 0`.
 * 402 `insufficient_tokens` { cost, balance, reviews } comes before anything is spent.
 */
export async function draftAllReviews(
  locationId: string,
  regenerate = false,
): Promise<{ drafted: number; remaining: number; tokens_spent: number; drafts: Review[] }> {
  return unwrapData(await api.post(`${base(locationId)}/drafts/all`, { regenerate }, { timeoutMs: 90_000 }));
}

/** Saves a reply the user wrote or edited (any rating). */
export async function saveReplyDraft(locationId: string, reviewId: string, text: string): Promise<Review> {
  return unwrapData(await api.put(`${one(locationId, reviewId)}/draft`, { text }));
}

export async function deleteReplyDraft(locationId: string, reviewId: string): Promise<Review> {
  return unwrapData(await api.delete(`${one(locationId, reviewId)}/draft`));
}

/** Publishes each review's draft on Google. No AI. */
export async function sendReplies(
  locationId: string,
  reviewIds: string[],
): Promise<{ results: { review_id: string; status: "sent" | "failed" | "skipped"; reason: string | null }[]; sent: number; failed: number }> {
  return unwrapData(await api.post(`${base(locationId)}/send`, { review_ids: reviewIds }));
}

/** Removes a published reply from Google. 400 `no_reply`. */
export async function deleteReply(locationId: string, reviewId: string): Promise<Review> {
  return unwrapData(await api.delete(`${one(locationId, reviewId)}/reply`));
}

/** AI analysis: sentiment, severity, suspicious indicators, recommended action. */
export async function analyzeReviews(
  locationId: string,
  reviewIds: string[],
  regenerate = false,
): Promise<{ reviews: Review[]; analyzed: number; reused: number; skipped: { review_id: string; reason: string }[]; tokens_spent: number }> {
  return unwrapData(await api.post(`${base(locationId)}/analyze`, { review_ids: reviewIds, regenerate }));
}

/** AI draft of a removal request to paste into Google's tool (`report_url`). 400 `not_eligible`. */
export async function draftAppeal(
  locationId: string,
  reviewId: string,
): Promise<{ review: Review; appeal: NonNullable<Review["appeal"]>; report_url: string; tokens_spent: number }> {
  return unwrapData(await api.post(`${one(locationId, reviewId)}/appeal-draft`));
}

/** Records what the user did on Google. */
export async function setReportStatus(locationId: string, reviewId: string, status: ReviewReportStatus): Promise<Review> {
  return unwrapData(await api.patch(`${one(locationId, reviewId)}/report-status`, { status }));
}

/** The stored insights; 404 `no_insights` before the first run. */
export async function getReviewInsights(locationId: string, signal?: AbortSignal): Promise<ReviewsInsights> {
  return unwrapData(await api.get(`${base(locationId)}/insights`, signal ? { signal } : {}));
}

/** AI insights over the reviews (stored until regenerated). */
export async function generateReviewInsights(locationId: string): Promise<ReviewsInsights> {
  return unwrapData(await api.post(`${base(locationId)}/insights`));
}
