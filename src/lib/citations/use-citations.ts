import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCitationChanges, getCitations, isApiError } from "@/api";

export const citationsKey = (locationId: string) => ["locations", locationId, "citations"] as const;

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

/** The whole list; the status chips filter it in place (the counts always cover every listing). */
export function useCitations(locationId: string) {
  return useQuery({
    queryKey: [...citationsKey(locationId), "list"],
    queryFn: ({ signal }) => getCitations(locationId, undefined, signal),
    retry,
  });
}

export function useCitationChanges(locationId: string, page: number, limit: number) {
  return useQuery({
    queryKey: [...citationsKey(locationId), "changes", page, limit],
    queryFn: ({ signal }) => getCitationChanges(locationId, { page, limit }, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}
