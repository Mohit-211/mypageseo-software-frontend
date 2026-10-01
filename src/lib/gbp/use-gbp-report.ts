import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getGbpReport, isApiError, type GbpRange } from "@/api";

export const gbpReportKey = (locationId: string) => ["locations", locationId, "gbp-report"] as const;

/** 4xx answers are states (no report yet), not failures to retry. */
const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

/**
 * The stored GBP report. While a new one is being generated (after a sync or a refresh)
 * it is polled until `generated_at` changes.
 */
export function useGbpReport(locationId: string, range: GbpRange) {
  return useQuery({
    queryKey: [...gbpReportKey(locationId), range],
    queryFn: ({ signal }) => getGbpReport(locationId, range, signal),
    retry,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.generation?.pending ? 20_000 : false),
  });
}

/** 404 before the first report exists. */
export function isNoReportYet(err: unknown): boolean {
  return isApiError(err) && err.status === 404;
}
