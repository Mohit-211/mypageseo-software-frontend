import { useQuery } from "@tanstack/react-query";
import { getReports } from "@/api";

/** Under `["reports", "list"]`, so creating or archiving a report (which invalidates it) refreshes the count. */
export const REPORTS_LIST_KEY = ["reports", "list"] as const;

/**
 * How many PDF reports are ready to download, for summaries (`GET reports?status=ready&limit=1`
 * → `total`). Optionally for one client or location.
 */
export function useReadyReportCount(scope: { clientId?: string | null; locationId?: string | null } = {}) {
  const query = {
    status: "ready",
    limit: 1,
    ...(scope.clientId ? { client_id: scope.clientId } : {}),
    ...(scope.locationId ? { location_id: scope.locationId } : {}),
  };
  return useQuery({
    queryKey: [...REPORTS_LIST_KEY, "ready-count", query],
    queryFn: async ({ signal }) => (await getReports(query, signal)).total,
    staleTime: 30_000,
    retry: false,
  });
}
