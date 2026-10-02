import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  apiErrorData,
  getKeywordGroups,
  getKeywordHistory,
  getTracking,
  getGrid,
  type RefreshState,
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

export function useRankTracker(locationId: string, runId: string | undefined, group?: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "tracker", runId ?? "latest", group ?? "all"],
    queryFn: ({ signal }) =>
      getRankTracker(locationId, { ...(runId ? { runId } : {}), ...(group ? { group } : {}) }, signal),
    retry,
    placeholderData: keepPreviousData,
  });
}

export function useGrid(locationId: string, runId: string | undefined, group?: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "grid", runId ?? "latest", group ?? "all"],
    queryFn: ({ signal }) => getGrid(locationId, { ...(runId ? { runId } : {}), ...(group ? { group } : {}) }, signal),
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

/** True while anything runs in the background for the location (ranking run, Google sync incl. reviews, GBP report). */
export function hasBackgroundWork(state: RefreshState | undefined): boolean {
  return Boolean(state?.rankings.active_run || state?.gbp?.active_sync || state?.report?.pending || state?.reviews?.in_progress);
}

/**
 * Refresh-button state and background work. Polled while work is running; `watch`
 * keeps polling for a while even when nothing is running yet (e.g. right after setup,
 * before the queued jobs have started).
 */
export function useRefreshState(locationId: string, watch = false) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "refresh"],
    queryFn: ({ signal }) => getRefreshState(locationId, signal),
    retry,
    refetchInterval: (query) => (watch || hasBackgroundWork(query.state.data) ? 15_000 : false),
  });
}

/** Tracking settings (keywords, competitors with names, grid). */
export function useTracking(locationId: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "tracking"],
    queryFn: ({ signal }) => getTracking(locationId, signal),
    retry,
  });
}

export function useKeywordGroups(locationId: string) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "groups"],
    queryFn: ({ signal }) => getKeywordGroups(locationId, signal),
    retry,
  });
}

export function useKeywordHistory(locationId: string, keyword: string | null) {
  return useQuery({
    queryKey: [...rankingsKey(locationId), "history", keyword],
    queryFn: ({ signal }) => getKeywordHistory(locationId, keyword!, 12, signal),
    enabled: Boolean(keyword),
    retry,
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
  | { kind: "group_not_found" }
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
    case "group_not_found":
      return { kind: "group_not_found" };
    case "point_not_in_run":
      return { kind: "point_not_in_run", available: Array.isArray(data.available) ? (data.available as string[]) : [] };
    default:
      // A location that isn't yours is a 404 *without* a reason.
      return err.status === 404 && !err.reason ? { kind: "location_not_found" } : { kind: "failed" };
  }
}
