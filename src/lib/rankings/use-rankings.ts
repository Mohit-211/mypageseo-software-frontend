import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  apiErrorData,
  getGrid,
  getMapRanking,
  getRankRuns,
  getRankTracker,
  getRefreshState,
  isApiError,
} from "@/api";

/** Prefix of one location's ranking queries; invalidate it when a run finishes or a refresh starts. */
export const rankingsKey = (locationId: string) => ["locations", locationId, "rankings"] as const;

/** 4xx answers are states (no run yet, unknown keyword…), not failures to retry. */
const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

export function useRankTracker(locationId: string, runId: string | undefined) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "tracker", runId ?? "latest"],
    queryFn: ({ signal }) => getRankTracker(locationId, runId, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useGrid(locationId: string, runId: string | undefined) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "grid", runId ?? "latest"],
    queryFn: ({ signal }) => getGrid(locationId, { ...(runId ? { runId } : {}) }, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useMapRanking(locationId: string, runId: string | undefined, point: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "map", runId ?? "latest", point],
    queryFn: ({ signal }) => getMapRanking(locationId, { point, ...(runId ? { runId } : {}) }, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useRankRuns(locationId: string, limit = 15, pollMs?: number) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "runs", limit],
    queryFn: ({ signal }) => getRankRuns(locationId, { limit }, signal),
    retry,
    ...(pollMs ? { refetchInterval: pollMs } : {}),
  });
}

export function useRefreshState(locationId: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "refresh"],
    queryFn: ({ signal }) => getRefreshState(locationId, signal),
    retry,
    // While a run is active, keep the button state current.
    refetchInterval: (query) => (query.state.data?.rankings.active_run ? 15_000 : false),
  });
}

/** What a ranking page shows for an error, decided by `data.reason`. */
export type RankingErrorState =
  | { kind: "no_completed_run" }
  | { kind: "location_not_found" }
  | { kind: "run_not_found" }
  | { kind: "run_not_finished"; status: string | null }
  | { kind: "keyword_not_in_run" }
  | { kind: "point_not_in_run"; available: string[] }
  | { kind: "failed" };

export function rankingErrorState(err: unknown): RankingErrorState {
  if (!isApiError(err)) return { kind: "failed" };
  const data = apiErrorData(err);
  switch (err.reason) {
    case "no_completed_run":
      return { kind: "no_completed_run" };
    case "run_not_found":
      return { kind: "run_not_found" };
    case "run_not_finished":
      return { kind: "run_not_finished", status: typeof data.status === "string" ? data.status : null };
    case "keyword_not_in_run":
      return { kind: "keyword_not_in_run" };
    case "point_not_in_run":
      return { kind: "point_not_in_run", available: Array.isArray(data.available) ? (data.available as string[]) : [] };
    default:
      // A location that isn't yours is a 404 *without* a reason.
      return err.status === 404 && !err.reason ? { kind: "location_not_found" } : { kind: "failed" };
  }
}
