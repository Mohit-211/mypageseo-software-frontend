import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import {
  getLocation,
  getLocationOverview,
  getLocationsList,
  isApiError,
  loadAllClients,
  type LocationsListParams,
} from "@/api";

/** Prefix of every location query; invalidate it after add, bind, unbind, delete or a client change. */
export const LOCATIONS_QUERY_KEY = ["locations"] as const;
export const CLIENTS_QUERY_KEY = ["clients"] as const;

/**
 * A deleted or foreign location (404 / 403) won't appear on a retry: answer at once instead of
 * after several seconds of skeleton. Network and server errors are still retried.
 */
export function retryUnlessClientError(failures: number, error: unknown): boolean {
  return !(isApiError(error) && error.status >= 400 && error.status < 500) && failures < 3;
}

/** `GET locations` for one table page (also carries `pending_gbp`). */
export function useLocationsList(params: LocationsListParams, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "list", params],
    queryFn: ({ signal }) => getLocationsList(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export const locationQuery = (locationId: string) =>
  queryOptions({
    queryKey: [...LOCATIONS_QUERY_KEY, "detail", locationId],
    queryFn: ({ signal }) => getLocation(locationId, signal),
    retry: retryUnlessClientError,
  });

export function useLocation(locationId: string) {
  return useQuery(locationQuery(locationId));
}

export const locationOverviewQuery = (locationId: string) =>
  queryOptions({
    queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId],
    queryFn: ({ signal }) => getLocationOverview(locationId, signal),
    retry: retryUnlessClientError,
  });

export function useLocationOverview(locationId: string) {
  return useQuery(locationOverviewQuery(locationId));
}

/**
 * The organization's clients (`GET clients`). Agency only: business organizations
 * skip the call, and a 403 `agency_only` is treated as "no clients".
 */
export function useClients(enabled: boolean) {
  const query = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        // Every page, so the client filter and "Move to client" offer every client.
        return (await loadAllClients(signal)).clients;
      } catch (err) {
        if (isApiError(err) && err.reason === "agency_only") return [];
        throw err;
      }
    },
    enabled,
    staleTime: 60_000,
  });
  return { ...query, clients: enabled ? (query.data ?? []) : [] };
}
