import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRankRun, getRankRuns, getRefreshState, type RankRun, type RefreshState } from "@/api";
import { gbpReportKey } from "@/lib/gbp/use-gbp-report";
import { LOCATIONS_QUERY_KEY } from "@/lib/locations/use-locations";
import { rankingsKey } from "./use-rankings";

/** The GBP report is built about 2 minutes after the run (and sync) finish. */
export const REPORT_DELAY_MS = 2 * 60_000;
/** The bar never shows full until the run is really done. */
const PROGRESS_CAP = 0.95;

const ACTIVE = new Set(["queued", "running"]);

export type FirstDataState = {
  refresh: RefreshState | undefined;
  /** The run being watched: the active one, the one given (Finish step), else the latest. */
  run: RankRun | undefined;
  active: boolean;
  failed: boolean;
  reportPending: boolean;
  /** Expected finish (started_at, or run_at while queued, + expected_duration_ms), rounded to the minute. */
  readyAt: Date | null;
  minutesLeft: number | null;
  /** 0–0.95 while running; 1 when done. */
  progress: number | null;
  /** Running past its estimate (the server fails a stuck run after about twice the estimate). */
  overdue: boolean;
  isPending: boolean;
};

function roundToMinute(time: number): Date {
  return new Date(Math.round(time / 60_000) * 60_000);
}

/**
 * A new location's first data: the first ranking run and the GBP report built after it.
 * Polls `GET refresh` (30 s while a run is active, 10 s while the report is pending) and the
 * run (30 s while active); React Query pauses intervals while the tab is hidden. When the run
 * or the report finishes, the location's pages reload their data once.
 */
export function useFirstData(locationId: string, now: number, runIdHint?: string | null): FirstDataState {
  const queryClient = useQueryClient();
  const refresh = useQuery({
    queryKey: [...rankingsKey(locationId), "refresh"],
    queryFn: ({ signal }) => getRefreshState(locationId, signal),
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.report?.pending) return 10_000;
      if (data?.rankings.active_run) return 30_000;
      return false;
    },
  });
  const activeRunId = refresh.data?.rankings.active_run?.run_id ?? null;
  // Without an active run or a hint, the latest run says whether the first one failed.
  const latest = useQuery({
    queryKey: [...rankingsKey(locationId), "runs", 1],
    queryFn: ({ signal }) => getRankRuns(locationId, { limit: 1 }, signal),
    enabled: refresh.isSuccess && !activeRunId && !runIdHint,
    retry: false,
  });
  const runId = activeRunId ?? runIdHint ?? latest.data?.runs[0]?.run_id ?? null;
  const run = useQuery({
    queryKey: [...rankingsKey(locationId), "run", runId],
    queryFn: ({ signal }) => getRankRun(locationId, runId!, signal),
    enabled: Boolean(runId),
    retry: false,
    refetchInterval: (query) => (!query.state.data || ACTIVE.has(query.state.data.status) ? 30_000 : false),
  });

  const status = run.data?.status;
  const active = Boolean(activeRunId) || (status !== undefined && ACTIVE.has(status));
  const reportPending = Boolean(refresh.data?.report?.pending);

  // Reload the location's data once when the run finishes, and again when the report is built.
  const wasActive = useRef(active);
  const wasPending = useRef(reportPending);
  useEffect(() => {
    if (wasActive.current && !active) {
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId] });
    }
    if (wasPending.current && !reportPending) {
      void queryClient.invalidateQueries({ queryKey: gbpReportKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, "overview", locationId] });
    }
    wasActive.current = active;
    wasPending.current = reportPending;
  }, [active, reportPending, locationId, queryClient]);

  const expected = run.data?.expected_duration_ms ?? null;
  const startedAt = run.data ? new Date(run.data.started_at ?? run.data.run_at).getTime() : null;
  const readyTime = startedAt !== null && expected ? startedAt + expected : null;
  const elapsed = startedAt !== null ? Math.max(0, now - startedAt) : null;

  return {
    refresh: refresh.data,
    run: run.data,
    active,
    failed: status === "failed",
    reportPending,
    readyAt: readyTime ? roundToMinute(readyTime) : null,
    minutesLeft: readyTime ? Math.max(0, Math.round((readyTime - now) / 60_000)) : null,
    progress:
      status === "done" || status === "partial"
        ? 1
        : active && expected && elapsed !== null
          ? Math.min(PROGRESS_CAP, elapsed / expected)
          : null,
    overdue: active && readyTime !== null && now > readyTime,
    isPending: refresh.isPending || (Boolean(runId) && run.isPending),
  };
}

/*
 * Which locations currently show the first-run card, so the background-activity banner
 * doesn't repeat "Ranking run in progress" / "Preparing the GBP report" above it.
 */
const cardCounts = new Map<string, number>();
const cardListeners = new Set<() => void>();
const emitCards = () => {
  for (const listener of cardListeners) listener();
};

/** Registers the card while `shown` is true. */
export function useFirstRunCard(locationId: string, shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    cardCounts.set(locationId, (cardCounts.get(locationId) ?? 0) + 1);
    emitCards();
    return () => {
      const next = (cardCounts.get(locationId) ?? 1) - 1;
      if (next <= 0) cardCounts.delete(locationId);
      else cardCounts.set(locationId, next);
      emitCards();
    };
  }, [locationId, shown]);
}

/** True while a first-run card is on screen for the location. */
export function useFirstRunCardShown(locationId: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      cardListeners.add(listener);
      return () => cardListeners.delete(listener);
    },
    () => cardCounts.has(locationId),
  );
}
