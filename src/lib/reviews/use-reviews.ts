import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAutoReply, getReviewInsights, getReviews, getReviewsSummary, isApiError, type ReplyCredits, type ReviewsQuery, type ReviewsSummary } from "@/api";
import { keepPreviousForLocation } from "@/lib/query-placeholder";
import { DEFAULT_BLOCK_SIZE, draftBatchSize } from "./reply-credits";
import { reviewMomentum } from "./review-metrics";

export const reviewsKey = (locationId: string) => ["locations", locationId, "reviews"] as const;

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

export const reviewsSummaryQuery = (locationId: string) =>
  queryOptions({
    queryKey: [...reviewsKey(locationId), "summary"],
    queryFn: ({ signal }) => getReviewsSummary(locationId, signal),
    retry,
  });

export function useReviewsSummary(locationId: string) {
  return useQuery(reviewsSummaryQuery(locationId));
}

/** What a location's AI reply buttons need from the summary: its credits and how many reviews one request may carry. */
export type ReplyAiLimits = {
  /** `ai.credits` (2026-11-17), null on an older server or before the summary loads. */
  credits: ReplyCredits | null;
  /** `ai.draft_all_max`: the most ids per drafts or Analyze request (6 by default). */
  batchSize: number;
  /** `credits.block_size` (10). */
  blockSize: number;
};

const selectLimits = (summary: ReviewsSummary): ReplyAiLimits => ({
  credits: summary.ai?.credits ?? null,
  batchSize: draftBatchSize(summary),
  blockSize: summary.ai?.credits?.block_size ?? DEFAULT_BLOCK_SIZE,
});

const NO_LIMITS: ReplyAiLimits = { credits: null, batchSize: draftBatchSize(null), blockSize: DEFAULT_BLOCK_SIZE };

/** The location's AI reply credits and request size, from the shared summary (cards, the selection bar, Draft all). */
export function useReplyAiLimits(locationId: string): ReplyAiLimits {
  const query = useQuery({ ...reviewsSummaryQuery(locationId), select: selectLimits });
  return query.data ?? NO_LIMITS;
}

/**
 * `GET …/reviews/auto-reply` (Phase 25b), read for its `feature` only: the server's switch for automatic replies
 * (show anything about them only when it is `on`; it stays `switched_off` until the grading round). A switch changes
 * with a release, not with a review, so this read has its own root outside `reviewsKey` and isn't repeated after
 * every draft or send. The settings themselves (AI Settings' card, which changes them) are read with
 * `autoReplyQuery` in `src/lib/ai-settings/use-auto-reply.ts`, whose key sits under the reviews.
 */
export const autoReplyFeatureKey = (locationId: string) => ["locations", locationId, "auto-reply-feature"] as const;

export const autoReplyFeatureQuery = (locationId: string) =>
  queryOptions({
    queryKey: autoReplyFeatureKey(locationId),
    queryFn: ({ signal }) => getAutoReply(locationId, signal),
    retry,
    staleTime: 5 * 60_000,
  });

export function useReviewsList(locationId: string, query: ReviewsQuery, enabled = true) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "list", query],
    queryFn: ({ signal }) => getReviews(locationId, query, signal),
    retry,
    placeholderData: keepPreviousForLocation(locationId),
    enabled,
  });
}

/** 404 `no_insights` before the first run; check with `isNoInsights(error)`. */
export function useReviewInsights(locationId: string, enabled = true) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "insights"],
    queryFn: ({ signal }) => getReviewInsights(locationId, signal),
    retry,
    enabled,
  });
}

/** True when the insights request failed only because none were generated yet. */
export function isNoInsights(error: unknown): boolean {
  return isApiError(error) && (error.reason === "no_insights" || error.status === 404);
}

/**
 * How many reviews match a filter: one review is fetched and `total` is the count. For filters the
 * summary can't count (e.g. failed sends), so chips can show real numbers.
 */
export function useReviewCount(locationId: string, query: Omit<ReviewsQuery, "page" | "limit" | "sort">, enabled = true) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "count", query],
    queryFn: async ({ signal }) => (await getReviews(locationId, { ...query, page: 1, limit: 1 }, signal)).total,
    retry,
    enabled,
  });
}

/** Reviews read to count the last 30 days and the 30 before (the API's page limit). */
const MOMENTUM_SAMPLE = 100;

/** New reviews in the last 30 days and the 30 days before, from the newest 100 (one request). */
export function useReviewMomentum(locationId: string, enabled = true) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "momentum"],
    // The clock is read when the answer arrives, never during render.
    queryFn: async ({ signal }) => reviewMomentum(await getReviews(locationId, { sort: "newest", page: 1, limit: MOMENTUM_SAMPLE }, signal), Date.now()),
    retry,
    enabled,
  });
}
