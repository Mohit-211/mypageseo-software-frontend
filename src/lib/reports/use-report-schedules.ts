import { useQuery } from "@tanstack/react-query";
import { getReportSchedules } from "@/api";

export const SCHEDULES_QUERY_KEY = ["reports", "schedules"] as const;

/** `GET /report-schedules`, optionally for one client (`client_id`) or location. */
export function useReportSchedules(query: { client_id?: string; location_id?: string } = {}) {
  return useQuery({
    queryKey: [...SCHEDULES_QUERY_KEY, query],
    queryFn: ({ signal }) => getReportSchedules(query, signal),
    retry: false,
  });
}
