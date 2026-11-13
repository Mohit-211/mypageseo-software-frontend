import { useSearchParams } from "react-router-dom";
import { useLocationRoute, type LocationRouteValue } from "@/lib/locations/location-route-context";
import { setParam, useSearchUpdater } from "@/lib/url-state";

/** What every ranking page gets: the location of the page (loaded once by the location layout). */
export type RankingsContext = LocationRouteValue;

/** The location of the ranking page. Only call it from pages under `/locations/:locationId/*`. */
export function useRankingsContext(): RankingsContext {
  return useLocationRoute();
}

/**
 * The selected run (`?run=`), read by every ranking page. Undefined = the latest done or
 * partial run.
 */
export function useRunParam(): [string | undefined, (runId: string | undefined) => void] {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const runId = params.get("run") ?? undefined;
  // Replaces the history entry and keeps the scroll position and `#section`.
  const setRunId = (next: string | undefined) => updateSearch((search) => setParam(search, "run", next));
  return [runId, setRunId];
}

/**
 * The keyword group filter (`?group=`), shared by Rank Overview, Rank Tracker and the Local Search
 * Grid. The Keywords page reads the same parameter for its table, so group links work everywhere.
 */
export function useGroupParam(): [string | undefined, (groupId: string | undefined) => void] {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const group = params.get("group") ?? undefined;
  const setGroup = (next: string | undefined) => updateSearch((search) => setParam(search, "group", next));
  return [group, setGroup];
}
