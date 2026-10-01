import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getClients,
  getLocation,
  getLocationOverview,
  getLocationsList,
  isApiError,
  type LocationsListParams,
} from "@/api";

/** Prefix of every location query; invalidate it after add, bind, unbind, delete or a client change. */
export const LOCATIONS_QUERY_KEY = ["locations"] as const;
export const CLIENTS_QUERY_KEY = ["clients"] as const;

/** `GET locations` for one table page (also carries `pending_gbp`). */
export function useLocationsList(params: LocationsListParams) {
  return useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "list", params],
    queryFn: ({ signal }) => getLocationsList(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useLocation(locationId: string) {
  return useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "detail", locationId],
    queryFn: ({ signal }) => getLocation(locationId, signal),
  });
}

export function useLocationOverview(locationId: string) {
  return useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId],
    queryFn: ({ signal }) => getLocationOverview(locationId, signal),
  });
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
        return (await getClients(signal)).clients;
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
