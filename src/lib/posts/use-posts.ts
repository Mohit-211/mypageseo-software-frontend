import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getBillingSummary, getPostSeries, getPosts, getPostsCalendar, getPostsSummary, isApiError, type PostsListQuery } from "@/api";

export const postsKey = (locationId: string) => ["locations", locationId, "posts"] as const;

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

export function usePostsSummary(locationId: string) {
  return useQuery({ queryKey: [...postsKey(locationId), "summary"], queryFn: ({ signal }) => getPostsSummary(locationId, signal), retry });
}

export function usePostsList(locationId: string, query: PostsListQuery) {
  return useQuery({
    queryKey: [...postsKey(locationId), "list", query],
    queryFn: ({ signal }) => getPosts(locationId, query, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function usePostsCalendar(locationId: string, from: string, to: string) {
  return useQuery({
    queryKey: [...postsKey(locationId), "calendar", from, to],
    queryFn: ({ signal }) => getPostsCalendar(locationId, from, to, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function usePostSeries(locationId: string) {
  return useQuery({ queryKey: [...postsKey(locationId), "series"], queryFn: ({ signal }) => getPostSeries(locationId, signal), retry });
}

/** Token costs of the post AI actions (`GET billing` → `tokens.ai_costs`), with the documented defaults. */
export function usePostAiCosts() {
  const billing = useQuery({
    queryKey: ["billing", "summary"],
    queryFn: ({ signal }) => getBillingSummary(signal),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const costs = billing.data?.tokens.ai_costs ?? {};
  return { draft: costs.post_draft ?? 1, image: costs.post_image ?? 3, balance: billing.data?.tokens.balance ?? null };
}
