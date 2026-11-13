import { queryOptions, useQuery } from "@tanstack/react-query";
import { getReviewInsights, getReviews, getReviewsSummary, isApiError, type ReviewsQuery } from "@/api";
import { keepPreviousForLocation } from "@/lib/query-placeholder";
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
