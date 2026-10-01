import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  GridResponse,
  KeywordGroup,
  KeywordHistory,
  MapRankingResponse,
  RankRunsResponse,
  RankTrackerResponse,
  RefreshResult,
  RefreshState,
} from "../types/rankings";

type Query = Record<string, string | number | undefined>;
const opts = (query: Query, signal?: AbortSignal) => ({ query, ...(signal ? { signal } : {}) });

/**
 * The latest done/partial run, or `runId`; `group` limits the keywords to a keyword group.
 * 404 `no_completed_run` before the first run finishes; 404 `group_not_found`.
 */
export async function getRankTracker(
  locationId: string,
  params: { runId?: string; group?: string },
  signal?: AbortSignal,
): Promise<RankTrackerResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.rankTracker(locationId), opts(params, signal)));
}

/** Every keyword's heatmap, or one `keyword` (404 `keyword_not_in_run`). */
export async function getGrid(
  locationId: string,
  params: { keyword?: string; runId?: string; group?: string },
  signal?: AbortSignal,
): Promise<GridResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.grid(locationId), opts(params, signal)));
}

/** Top 20 at one point (`C` default). 404 `point_not_in_run` with `available`. */
export async function getMapRanking(
  locationId: string,
  params: { keyword?: string; runId?: string; point?: string },
  signal?: AbortSignal,
): Promise<MapRankingResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.mapRanking(locationId), opts(params, signal)));
}

/** Run history, newest first (limit ≤ 100). */
export async function getRankRuns(
  locationId: string,
  params: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<RankRunsResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.rankRuns(locationId), opts(params, signal)));
}

export async function getRefreshState(locationId: string, signal?: AbortSignal): Promise<RefreshState> {
  return unwrapData(await api.get(ENDPOINTS.locations.refresh(locationId), signal ? { signal } : {}));
}

/** Manual refresh: 202; 402 `insufficient_tokens`; 429 inside the 24 h window (body has `next_allowed_at`). */
export async function refreshLocation(locationId: string, types: ("rankings" | "gbp")[]): Promise<RefreshResult> {
  return unwrapData(await api.post(ENDPOINTS.locations.refresh(locationId), { types }));
}

/** One keyword across finished runs, oldest first. 404 `keyword_not_tracked`. */
export async function getKeywordHistory(
  locationId: string,
  keyword: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<KeywordHistory> {
  return unwrapData(await api.get(ENDPOINTS.locations.keywordHistory(locationId), opts({ keyword, limit }, signal)));
}

export async function getKeywordGroups(locationId: string, signal?: AbortSignal): Promise<{ groups: KeywordGroup[]; limit: number }> {
  return unwrapData(await api.get(ENDPOINTS.locations.keywordGroups(locationId), signal ? { signal } : {}));
}

/** 400 `unknown_keyword` / `too_many_groups`; 409 `group_name_taken`. */
export async function createKeywordGroup(locationId: string, body: { name: string; keywords: string[] }): Promise<KeywordGroup> {
  return unwrapData(await api.post(ENDPOINTS.locations.keywordGroups(locationId), body));
}

/** `keywords` replaces the list. 404 `group_not_found`. */
export async function updateKeywordGroup(
  locationId: string,
  groupId: string,
  body: { name?: string; keywords?: string[] },
): Promise<KeywordGroup> {
  return unwrapData(await api.patch(ENDPOINTS.locations.keywordGroup(locationId, groupId), body));
}

export async function deleteKeywordGroup(locationId: string, groupId: string): Promise<{ deleted: boolean }> {
  return unwrapData(await api.delete(ENDPOINTS.locations.keywordGroup(locationId, groupId)));
}
