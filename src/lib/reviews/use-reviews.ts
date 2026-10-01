import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getReviewInsights, getReviews, getReviewsSummary, isApiError, type ReviewsQuery } from "@/api";

export const reviewsKey = (locationId: string) => ["locations", locationId, "reviews"] as const;

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

export function useReviewsSummary(locationId: string) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "summary"],
    queryFn: ({ signal }) => getReviewsSummary(locationId, signal),
    retry,
  });
}

export function useReviewsList(locationId: string, query: ReviewsQuery) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "list", query],
    queryFn: ({ signal }) => getReviews(locationId, query, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useReviewInsights(locationId: string) {
  return useQuery({
    queryKey: [...reviewsKey(locationId), "insights"],
    queryFn: ({ signal }) => getReviewInsights(locationId, signal),
    retry,
  });
}
