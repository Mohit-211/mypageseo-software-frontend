import { useSearchParams } from "react-router-dom";
import type { GbpRange } from "@/api";
import { useLocationRoute, type LocationRouteValue } from "@/lib/locations/location-route-context";
import { setParam, useSearchUpdater } from "@/lib/url-state";

/** What every GBP, reputation and AI page gets: the location of the page (loaded once by the location layout). */
export type GbpContext = LocationRouteValue;

/** The location of the page. Only call it from pages under `/locations/:locationId/*`. */
export function useGbpContext(): GbpContext {
  return useLocationRoute();
}

const RANGES: GbpRange[] = ["28d", "90d", "12m"];

/** The performance window (`?range=`), 28 days by default. */
export function useRangeParam(): [GbpRange, (range: GbpRange) => void] {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const raw = params.get("range");
  const range = RANGES.includes(raw as GbpRange) ? (raw as GbpRange) : "28d";
  // Replaces the history entry and keeps the scroll position and `#section`.
  const setRange = (next: GbpRange) => updateSearch((search) => setParam(search, "range", next === "28d" ? null : next));
  return [range, setRange];
}
