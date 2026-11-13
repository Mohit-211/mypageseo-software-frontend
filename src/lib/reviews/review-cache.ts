/**
 * Writes what the reviews API answered straight into the cached lists and summary, so a review card
 * (and the authorization banner and Send buttons) update at once instead of after the next read.
 * Callers still invalidate `reviewsKey(locationId)` afterwards: counts and other filters catch up then.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { ReplyAuthorization, Review, ReviewsList, ReviewsSummary, SendResult } from "@/api";
import { asFailedSend, asSentReview, replyTextOf, withGoogleReply } from "./draft-view";
import { reviewLookupRoot } from "./review-spotlight";
import { reviewsKey, reviewsSummaryQuery } from "./use-reviews";

const isList = (data: unknown): data is ReviewsList => Boolean(data && typeof data === "object" && Array.isArray((data as ReviewsList).reviews));
const isReview = (data: unknown): data is Review => Boolean(data && typeof data === "object" && typeof (data as Review).review_id === "string");

/**
 * Applies `update` to the review wherever the location's cache holds it: every list (`GET reviews`)
 * and every review looked up by id (`reviewLookupKey`: the one a `?review=` link pins above the list,
 * a card kept on screen while it's worked on). Only those entries are written: a write marks an entry
 * fresh (`dataUpdatedAt`), and `useAiStatus` weighs the summary's age against what AI calls said, so
 * the summary, counts and other shapes are left alone.
 */
export function updateReviewInCache(queryClient: QueryClient, locationId: string, reviewId: string, update: (review: Review) => Review): void {
  for (const root of [reviewsKey(locationId), reviewLookupRoot(locationId)]) {
    for (const [queryKey, data] of queryClient.getQueriesData<unknown>({ queryKey: root })) {
      if (isList(data)) {
        if (!data.reviews.some((item) => item.review_id === reviewId)) continue;
        queryClient.setQueryData<ReviewsList>(queryKey, { ...data, reviews: data.reviews.map((item) => (item.review_id === reviewId ? update(item) : item)) });
      } else if (isReview(data) && data.review_id === reviewId) {
        queryClient.setQueryData<Review>(queryKey, update(data));
      }
    }
  }
}

/** Puts a review the API returned (save, "Change it", a new AI draft, an analysis, a blocked send) wherever the cache shows it. */
export function putReviewInCache(queryClient: QueryClient, locationId: string, review: Review | null | undefined): void {
  if (!review?.review_id) return;
  updateReviewInCache(queryClient, locationId, review.review_id, () => review);
}

/**
 * What a send of several did, written into the cached reviews at once (the lists are read again
 * after): a sent reply waits for Google, a failed one keeps its draft with the error, a reply found on
 * Google is shown over the draft. A review opened above the list, or kept on screen, stays current
 * without being looked up again.
 */
export function putSendResultsInCache(queryClient: QueryClient, locationId: string, results: readonly SendResult[]): void {
  for (const result of results) {
    if (result.status === "sent") {
      updateReviewInCache(queryClient, locationId, result.review_id, (review) => asSentReview(review, review.draft?.text ?? replyTextOf(review.reply) ?? ""));
    } else if (result.status === "failed") {
      updateReviewInCache(queryClient, locationId, result.review_id, (review) => asFailedSend(review, result.reason ?? null));
    } else if (result.reason === "reply_changed_on_google" && result.google_reply) {
      const googleReply = result.google_reply;
      updateReviewInCache(queryClient, locationId, result.review_id, (review) => withGoogleReply(review, googleReply));
    }
  }
}

/**
 * The one place that writes the summary's `reply_authorization` (a grant or a withdrawal answered, a
 * 409 `reply_authorization_required` carried it, an organization that needs none), so the banner and
 * every Send button update at once. `next` may derive from the cached value; null leaves it as it is.
 * The summary keeps its age: `useAiStatus` weighs it against what AI calls said, and this says nothing
 * about AI. Callers read the summary again when they need to.
 */
export function setCachedReplyAuthorization(
  queryClient: QueryClient,
  locationId: string,
  next: ReplyAuthorization | null | ((current: ReplyAuthorization | null) => ReplyAuthorization | null),
): void {
  const key = reviewsSummaryQuery(locationId).queryKey;
  const summary = queryClient.getQueryData<ReviewsSummary>(key);
  if (!summary) return;
  const value = typeof next === "function" ? next(summary.reply_authorization ?? null) : next;
  if (!value) return;
  const updatedAt = queryClient.getQueryState(key)?.dataUpdatedAt;
  queryClient.setQueryData<ReviewsSummary>(key, { ...summary, reply_authorization: value }, updatedAt ? { updatedAt } : undefined);
}
