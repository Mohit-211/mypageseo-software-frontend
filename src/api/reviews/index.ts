import { api, unwrapData } from "../client";
import type {
  AnalyzeReviewsResponse,
  AutoReplySettings,
  AutoReplyUpdate,
  DraftAllRequest,
  DraftAllResponse,
  GenerateDraftsResponse,
  ReplyAuthorization,
  Review,
  ReviewDetail,
  ReviewsInsights,
  ReviewsList,
  ReviewsQuery,
  ReviewsSummary,
  ReviewReportStatus,
  ReviseDraftResponse,
  SendRepliesResponse,
  SwapDraftResponse,
  WeeklyEmailOptOutResult,
} from "../types/reviews";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/reviews`;
const one = (locationId: string, reviewId: string) => `${base(locationId)}/${encodeURIComponent(reviewId)}`;

/**
 * AI calls wait for the model. Since 2026-11-17 drafts, "Draft all" and "Change it" end their AI work within
 * 75 s of the request, strictly (the guide: keep the request's timeout above 90 s); Analyze, an appeal draft and
 * insights take about 65 s at most. Giving up sooner would show "that took too long" while the work (and its
 * charge) still completes.
 */
const AI_TIMEOUT = { timeoutMs: 100_000 } as const;

/** A send of several reviews: no new send starts 40 s in, and a send already made always finishes (about 81 s at most). */
const SEND_TIMEOUT = { timeoutMs: 100_000 } as const;

/** "Refresh Reviews": no page of Google's list starts 45 s after it began (about 76 s at most). */
const REFRESH_TIMEOUT = { timeoutMs: 90_000 } as const;

/** Stat cards, refresh timing and AI availability/costs. No AI. */
export async function getReviewsSummary(locationId: string, signal?: AbortSignal): Promise<ReviewsSummary> {
  return unwrapData(await api.get(`${base(locationId)}/summary`, signal ? { signal } : {}));
}

/** 2026-11-17: `reply_update: true` lists the drafts updating a reply on Google ("Drafts to check"). */
export async function getReviews(locationId: string, query: ReviewsQuery, signal?: AbortSignal): Promise<ReviewsList> {
  return unwrapData(await api.get(base(locationId), { query, ...(signal ? { signal } : {}) }));
}

/**
 * One review by its id (2026-11-17, G5), for `?review=<id>` instead of scanning the lists: the list's object,
 * also for a review deleted on Google. Every member reads it, client users too. 404 `review_not_found`.
 */
export async function getReview(locationId: string, reviewId: string, signal?: AbortSignal): Promise<ReviewDetail> {
  return unwrapData(await api.get(one(locationId, reviewId), signal ? { signal } : {}));
}

/** "Refresh Reviews": new and changed reviews from Google. 429 `rate_limited` (+ `next_allowed_at`), once per 15 min. */
export async function refreshReviews(locationId: string): Promise<{ new_reviews: number; updated_reviews: number; refreshed_at: string }> {
  return unwrapData(await api.post(`${base(locationId)}/refresh`, undefined, REFRESH_TIMEOUT));
}

/**
 * AI reply drafts for unreplied, non-suspicious reviews of any rating: at most `ai.draft_all_max` ids per call (6
 * by default since Phase 25b, a server setting; more is 400 `invalid_input`), so loop a bigger selection in
 * chunks. Others come back in `skipped` (`deadline`: "Draft it again"). 2026-11-17: each review uses one of the
 * location's AI replies (blocks of 10); the answer's `replies_left` is what remains. 503 `ai_*` and 402
 * `insufficient_tokens` `{ cost, balance, reviews, replies_left }` come before anything is held or spent; 502
 * `ai_failed` when every review was cut (nothing spent); 404 `location_not_found` (removed meanwhile).
 */
export async function generateReplyDrafts(locationId: string, reviewIds: string[], regenerate = false): Promise<GenerateDraftsResponse> {
  const answer = unwrapData<GenerateDraftsResponse>(await api.post(`${base(locationId)}/drafts`, { review_ids: reviewIds, regenerate }, AI_TIMEOUT));
  return { ...answer, skipped: answer.skipped ?? [] };
}

/**
 * "Draft all unreplied": up to `ai.draft_all_max` per call (6 by default since Phase 25b), oldest first. Call
 * again while `remaining > 0`, sending the previous answer's `next_cursor` back as `cursor` (Phase 25a:
 * without it, `regenerate` would draft the same reviews again). Stars-only 4–5★ reviews only with
 * `include_stars_only`. 402 `insufficient_tokens` { cost, balance, reviews, replies_left } comes before anything
 * is held or spent; an invalid cursor is 400 `invalid_input`. 2026-11-17: reviews skipped as `deadline` are
 * drafted again by "Continue" (the cursor stops before them, except with `regenerate`); `replies_left` is what
 * the location has after the page.
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
 * from the answer. 400 `invalid_input` over the limit. 2026-11-17 (G3): saving while the review has a reply on
 * Google makes the draft an update (`replaces_reply: true`); "Replace it with my draft" after
 * `reply_changed_on_google` / `draft_predates_reply` saves first, then sends.
 */
export async function saveReplyDraft(locationId: string, reviewId: string, text: string): Promise<Review> {
  return unwrapData(await api.put(`${one(locationId, reviewId)}/draft`, { text }));
}

/**
 * "Change it" (Phase 25a): the AI rewrites the review's current draft as asked (1–500 characters). Since
 * 2026-11-17 it uses one of the location's AI replies (the 402 `{ cost, balance, reviews: 1, replies_left }`
 * comes first, before anything is locked or spent), given back if it fails. Parts of the request that break the
 * reply rules come back in `declined_instructions` ("We left out: …"). A change while the review has a reply on
 * Google makes the draft an update (`replaces_reply`).
 * 400 `instructions_declined` (every part left out; nothing spent), `no_draft`, `not_eligible`,
 * `deleted_on_google`; 409 `revision_in_progress`, `draft_changed` (reload); 502 `ai_failed`; the AI errors.
 */
export async function reviseReplyDraft(locationId: string, reviewId: string, instructions: string): Promise<ReviseDraftResponse> {
  return unwrapData(await api.post(`${one(locationId, reviewId)}/draft/revise`, { instructions }, AI_TIMEOUT));
}

/**
 * "Try the other version" (Phase 25b, free): the draft's `alternative` becomes the draft and the replaced text
 * the new `alternative`, so the same button switches back. 409 `draft_edited` (the user edited the draft: confirm
 * "Your edits will be lost", then send again with `discardEdits`), `draft_changed` (reload); 400 `no_alternative`,
 * `deleted_on_google`; 403 `read_only` (a client user).
 */
export async function swapReplyDraft(locationId: string, reviewId: string, options: { discardEdits?: boolean } = {}): Promise<SwapDraftResponse> {
  return unwrapData(await api.post(`${one(locationId, reviewId)}/draft/swap`, options.discardEdits ? { discard_edits: true } : {}));
}

/**
 * Deletes the review's draft. The answer is `{ deleted, review_id }`, not the review: read the review again (and
 * the summary, whose counts change). Without its draft a review is `none` (`rejected` if Google rejected its
 * reply); one with a reply on Google keeps `sent` or `pending`. 404 `review_not_found`.
 */
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
 *   `deleted_on_google`, `no_draft`, `not_found`, and since 2026-11-17 `replaces_published_reply` (send updates
 *   one at a time) and `deadline` (not sent yet: "Send the rest")); `confirmWarnings` is ignored for several;
 * - an agency organization: 409 `reply_authorization_required` (+ `reply_authorization`) until the
 *   client's authorization is recorded.
 * 2026-11-17: a failed result has `code` (`reconnect_required`, `google_unavailable`, `google_rejected_request`,
 * `not_configured`, `send_failed`) next to `reason` (the message); one review whose draft was written before the
 * reply on Google answers 409 `draft_predates_reply` (+ `google_reply`): save it again (it becomes an update) or
 * delete it; a law firm's `no_public_reply` draft answers 409 `confirm_warnings_required` ("Send anyway").
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
      await api.post(`${base(locationId)}/send`, { review_ids: reviewIds.slice(i, i + SEND_BATCH), ...confirm }, SEND_TIMEOUT),
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

/**
 * AI analysis: sentiment, severity, suspicious indicators, recommended action, and (Phase 25b, v2) what the
 * reviewer mentioned (with quotes), risks, emotion, a question. At most `ai.draft_all_max` ids. 2026-11-17:
 * analyses come in blocks of 10 per location (`analysis_per_10`); the answer's `analyses_left` is what remains;
 * 402 `{ cost, balance, reviews, analyses_left }` comes first. A current analysis the drafts made is reused free.
 */
export async function analyzeReviews(locationId: string, reviewIds: string[], regenerate = false): Promise<AnalyzeReviewsResponse> {
  return unwrapData(await api.post(`${base(locationId)}/analyze`, { review_ids: reviewIds, regenerate }, AI_TIMEOUT));
}

/* -------------------------------------------------------------------------- */
/* Automatic replies to 4–5★ reviews (Phase 25b)                                */
/* -------------------------------------------------------------------------- */

/** The location's automatic replies. Show the settings only when `feature` is `on`. */
export async function getAutoReply(locationId: string, signal?: AbortSignal): Promise<AutoReplySettings> {
  return unwrapData(await api.get(`${base(locationId)}/auto-reply`, signal ? { signal } : {}));
}

/**
 * Changes them: switching on or widening needs `consent_version` (the caller's `consent_method` decides who may);
 * switching off, narrowing and pausing (`{ paused }` alone) need none. 400 `consent_required`, `consent_outdated`
 * (+ `consent_version`: show the new text), `gbp_not_connected`, `auto_reply_off`, `invalid_input`; 402
 * `subscription_required`; 403 `auto_reply_not_available` (+ `feature`), `owner_only`, `client_or_owner_only`,
 * `admin_paused`, `read_only`, `organization_suspended`; 409 `reply_authorization_required` (+
 * `reply_authorization`), `auto_reply_changed` (reload).
 */
export async function updateAutoReply(locationId: string, update: AutoReplyUpdate): Promise<AutoReplySettings> {
  return unwrapData(await api.put(`${base(locationId)}/auto-reply`, update));
}

/**
 * The weekly automatic-replies email's opt-out (`/email/opt-out?list=auto-replies&token=…`), public: post it on a
 * click, never on load. `optOut: false` is the page's Undo. 400 `invalid_token` / `invalid_input` ("This link
 * doesn't work any more"); 429 `rate_limited` (try again later).
 */
export async function setWeeklyReplyEmailOptOut(token: string, optOut = true): Promise<WeeklyEmailOptOutResult> {
  return unwrapData(await api.post("public/reviews/weekly-email/opt-out", { token, opt_out: optOut }, { auth: false }));
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
