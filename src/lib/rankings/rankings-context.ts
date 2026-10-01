import { useOutletContext, useSearchParams } from "react-router-dom";
import type { LocationHeader } from "@/api";

/** What the rankings layout hands to each ranking page. */
export type RankingsContext = { location: LocationHeader };

export function useRankingsContext(): RankingsContext {
  return useOutletContext<RankingsContext>();
}

/**
 * The selected run (`?run=`), shared by every ranking page so switching tabs keeps it.
 * Undefined = the latest done or partial run.
 */
export function useRunParam(): [string | undefined, (runId: string | undefined) => void] {
  const [params, setParams] = useSearchParams();
  const runId = params.get("run") ?? undefined;
  const setRunId = (next: string | undefined) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set("run", next);
        else updated.delete("run");
        return updated;
      },
      { replace: true },
    );
  };
  return [runId, setRunId];
}

/** The keyword group filter (`?group=`), shared by the Rank Tracker, Keywords and grid pages. */
export function useGroupParam(): [string | undefined, (groupId: string | undefined) => void] {
  const [params, setParams] = useSearchParams();
  const group = params.get("group") ?? undefined;
  const setGroup = (next: string | undefined) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next) updated.set("group", next);
        else updated.delete("group");
        return updated;
      },
      { replace: true },
    );
  };
  return [group, setGroup];
}
