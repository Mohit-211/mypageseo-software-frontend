import { useOutletContext, useSearchParams } from "react-router-dom";
import type { GbpRange, LocationHeader } from "@/api";

/** What the GBP layout hands to each GBP page. */
export type GbpContext = { location: LocationHeader };

export function useGbpContext(): GbpContext {
  return useOutletContext<GbpContext>();
}

const RANGES: GbpRange[] = ["28d", "90d", "12m"];

/** The performance window (`?range=`), 28 days by default. */
export function useRangeParam(): [GbpRange, (range: GbpRange) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("range");
  const range = RANGES.includes(raw as GbpRange) ? (raw as GbpRange) : "28d";
  const setRange = (next: GbpRange) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "28d") updated.delete("range");
        else updated.set("range", next);
        return updated;
      },
      { replace: true },
    );
  return [range, setRange];
}
