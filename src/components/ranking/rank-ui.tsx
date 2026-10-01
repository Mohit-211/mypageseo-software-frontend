import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LoaderCircle, RefreshCw } from "lucide-react";
import { apiErrorData, isApiError, refreshLocation, type ChangeLabel, type OverallRank, type RankCell } from "@/api";
import { PageHeader, TrendIndicator } from "@/components/layout/shared/data-display";
import { RankingsNavigation } from "@/components/location/location-workspace";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BUCKET_CLASS,
  BUCKET_LABEL,
  CHANGE_LABEL_TEXT,
  RANKINGS_SOURCE_NOTE,
  comparableNote,
  formatAvgRank,
  formatDistance,
  formatRunDate,
} from "@/lib/rankings/format";
import { GridSettingsButton } from "@/components/ranking/grid-settings-dialog";
import { GroupFilter } from "@/components/ranking/keyword-controls";
import type { RankBucket } from "@/api";
import { locationSetupPath } from "@/lib/locations/location-actions";
import {
  rankingErrorState,
  rankingsKey,
  useRankRuns,
  useRefreshState,
} from "@/lib/rankings/use-rankings";
import { useRunParam } from "@/lib/rankings/rankings-context";
import type { RunMeta } from "@/api";
import { cn } from "@/lib/utils";


function cellTitle(cell: RankCell) {
  const parts = [BUCKET_LABEL[cell.bucket] ?? cell.bucket];
  if (cell.samples && cell.samples.length > 1) {
    const samples = cell.samples.map((value) => (value == null ? "failed" : value === 61 ? "60+" : String(value)));
    parts.push(`samples ${samples.join(", ")}${cell.spread != null ? ` (spread ${cell.spread})` : ""}`);
  }
  return parts.join(" · ");
}

/** One rank, coloured by bucket. A failed search shows "—", never "60+". */
export function RankCellView({ cell, className }: { cell: RankCell | undefined; className?: string }) {
  if (!cell) return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  const text = cell.status === "error" ? "—" : cell.status === "not_found" ? "60+" : cell.display;
  return (
    <span
      title={cellTitle(cell)}
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded border px-1.5 py-0.5 text-xs font-semibold tabular",
        BUCKET_CLASS[cell.bucket] ?? BUCKET_CLASS.error,
        className,
      )}
    >
      {text}
      {cell.status === "error" ? <span className="sr-only">search failed</span> : null}
    </span>
  );
}

export function BucketLegend() {
  const buckets: RankBucket[] = ["pack", "visible", "low", "invisible", "not_found", "error"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Rank colours">
      {buckets.map((bucket) => (
        <li key={bucket} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-3 rounded-sm border", BUCKET_CLASS[bucket])} />
          {BUCKET_LABEL[bucket]}
        </li>
      ))}
    </ul>
  );
}

/** `change` is previous − current: positive means improved. Null = no comparable earlier run. */
export function RankChange({ change, label }: { change: number | null | undefined; label?: ChangeLabel | null | undefined }) {
  if (label === "entered_top_60" || label === "dropped_out_of_top_60") {
    return (
      <span className={cn("text-xs font-medium", label === "entered_top_60" ? "text-success" : "text-critical")}>
        {CHANGE_LABEL_TEXT[label]}
      </span>
    );
  }
  if (change == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <TrendIndicator
      direction={change > 0 ? "up" : change < 0 ? "down" : "flat"}
      value={Math.abs(change).toFixed(1)}
      positive={change > 0}
    />
  );
}

/** Overall change, noting when it covers only some keywords (after keyword edits). */
export function OverallChange({ overall }: { overall: OverallRank | undefined }) {
  if (!overall || overall.comparable_keywords === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const note = comparableNote(overall.comparable_keywords, overall.keywords_total);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <RankChange change={overall.change} />
      {note && overall.change != null ? <span className="text-xs text-muted-foreground">({note})</span> : null}
    </span>
  );
}

export function AvgRank({ value }: { value: number | null | undefined }) {
  return <span className="font-semibold tabular text-foreground">{formatAvgRank(value)}</span>;
}

/**
 * The error states shared by the ranking pages, chosen by `data.reason`. While the
 * first run is in progress it polls the run history and reloads once a run is done.
 */
export function RankingsError({
  error,
  locationId,
  onRetry,
  onLatest,
  onClearKeyword,
  onClearGroup,
  onPoint,
}: {
  error: unknown;
  locationId: string;
  onRetry: () => void;
  onLatest: () => void;
  onClearKeyword?: () => void;
  onClearGroup?: () => void;
  onPoint?: (point: string) => void;
}) {
  const state = rankingErrorState(error);
  switch (state.kind) {
    case "no_completed_run":
      return <FirstRunPending locationId={locationId} />;
    case "location_not_found":
      return (
        <EmptyState
          title="Location not found"
          description="It may have been deleted, or it isn't in this organization."
          action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
        />
      );
    case "run_not_found":
      return (
        <EmptyState
          title="Run not found"
          description="That ranking run doesn't exist for this location."
          action={<Button variant="outline" onClick={onLatest}>Show the latest results</Button>}
        />
      );
    case "run_not_finished":
      return (
        <EmptyState
          title="This run hasn't finished"
          description={`The selected run is ${state.status ?? "still in progress"}. Its results appear once it's done.`}
          action={<Button variant="outline" onClick={onLatest}>Show the latest results</Button>}
        />
      );
    case "group_not_found":
      return (
        <EmptyState
          title="Keyword group not found"
          description="It may have been deleted. Showing all keywords instead is one click away."
          action={onClearGroup ? <Button variant="outline" onClick={onClearGroup}>Show all keywords</Button> : undefined}
        />
      );
    case "keyword_not_in_run":
      return (
        <EmptyState
          title="Keyword not in this run"
          description="The keyword was added or removed after this run. Choose another keyword or run."
          action={onClearKeyword ? <Button variant="outline" onClick={onClearKeyword}>Show all keywords</Button> : undefined}
        />
      );
    case "point_not_in_run":
      return (
        <EmptyState
          title="This point wasn't searched in this run"
          description={state.available.length > 0 ? `Available points: ${state.available.join(", ")}.` : "Older runs only have the center point."}
          action={onPoint && state.available[0] ? <Button variant="outline" onClick={() => onPoint(state.available[0]!)}>Show {state.available[0]}</Button> : undefined}
        />
      );
    default:
      return <ErrorState description="Rankings couldn't be loaded. Try again." onRetry={onRetry} />;
  }
}

function FirstRunPending({ locationId }: { locationId: string }) {
  const queryClient = useQueryClient();
  const runs = useRankRuns(locationId, 1, 15_000);
  const latest = runs.data?.runs[0];
  const finished = latest?.status === "done" || latest?.status === "partial";

  useEffect(() => {
    if (finished) void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
  }, [finished, locationId, queryClient]);

  if (runs.isSuccess && !latest) {
    return (
      <EmptyState
        title="No ranking run yet"
        description="Finish this location's setup (keywords and competitors) to start the first ranking run."
        action={<Button asChild><Link to={locationSetupPath(locationId)}>Continue setup</Link></Button>}
      />
    );
  }
  if (latest?.status === "failed") {
    return (
      <EmptyState
        title="The first ranking run failed"
        description="Nothing was charged. Start a new run with Refresh, or wait for the next monthly refresh."
        action={<RefreshRankingsButton locationId={locationId} />}
      />
    );
  }
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center shadow-card">
      <LoaderCircle aria-hidden className="size-6 animate-spin text-primary" />
      <p className="text-sm font-semibold text-foreground">First ranking run in progress</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {latest ? `Status: ${latest.status}. ` : ""}A run takes a few minutes. This page updates on its own.
      </p>
    </div>
  );
}

/** "Latest" or an older done/partial run from `GET rank-runs`. */
export function RunPicker({
  locationId,
  runId,
  onChange,
}: {
  locationId: string;
  runId: string | undefined;
  onChange: (runId: string | undefined) => void;
}) {
  const runs = useRankRuns(locationId);
  const list = runs.data?.runs ?? [];
  if (list.length <= 1 && !runId) return null;
  return (
    <Select value={runId ?? "latest"} onValueChange={(value) => onChange(value === "latest" ? undefined : value)}>
      <SelectTrigger className="w-full bg-background sm:w-64" aria-label="Ranking run">
        <SelectValue placeholder="Latest run" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="latest">Latest run</SelectItem>
        {list.map((run) => {
          const usable = run.status === "done" || run.status === "partial";
          return (
            <SelectItem key={run.run_id} value={run.run_id} disabled={!usable}>
              {formatRunDate(run.run_at, true)}
              {usable ? ` · avg ${formatAvgRank(run.overall.self?.overallAvgRank)}` : ` · ${run.status}`}
              {run.status === "partial" ? " (partial)" : ""}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** The current time, updated every minute, so time-based UI re-renders without reading the clock during render. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Manual rankings refresh: costs tokens, at most once per 24 h; the monthly refresh is free. */
export function RefreshRankingsButton({ locationId }: { locationId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const state = useRefreshState(locationId);
  const active = state.data?.rankings.active_run ?? null;
  const nextAllowed = state.data?.rankings.next_allowed_at ?? null;
  const now = useNow();
  const waiting = nextAllowed !== null && new Date(nextAllowed).getTime() > now;
  const cost = state.data?.tokens.cost.rankings;

  const run = async () => {
    try {
      const result = await refreshLocation(locationId, ["rankings"]);
      const rankings = result.rankings;
      if (rankings && "skipped" in rankings) {
        toast.message(`Rankings can be refreshed again ${formatRunDate(rankings.next_allowed_at, true)}.`);
      } else {
        toast.success(rankings?.existing ? "A ranking run is already in progress." : "Ranking run started. It takes a few minutes.");
      }
    } catch (err) {
      if (isApiError(err) && err.reason === "insufficient_tokens") {
        const data = apiErrorData(err);
        toast.error(`Not enough tokens: this refresh costs ${String(data.cost ?? cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`, {
          action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") },
        });
      } else if (isApiError(err) && err.reason === "read_only") {
        toast.error("Your access is read-only, so you can't start a refresh.");
      } else if (isApiError(err) && err.status === 429) {
        const next = (apiErrorData(err).rankings as { next_allowed_at?: string } | undefined)?.next_allowed_at ?? apiErrorData(err).next_allowed_at;
        toast.error(`Rankings were refreshed recently. Try again ${typeof next === "string" ? formatRunDate(next, true) : "in 24 hours"}.`);
      } else {
        toast.error(isApiError(err) && err.message ? err.message : "The refresh couldn't be started. Try again.");
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
    }
  };

  const label = active
    ? "Run in progress"
    : waiting
      ? `Next refresh ${formatRunDate(nextAllowed, true)}`
      : `Refresh rankings${cost != null ? ` (${cost} token${cost === 1 ? "" : "s"})` : ""}`;

  return (
    <Button variant="outline" size="sm" disabled={!state.data || Boolean(active) || waiting} onClick={() => void run()}>
      {active ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {label}
    </Button>
  );
}

/** Tabs, title, run picker, filters and actions shared by the ranking pages. */
export function RankingsPageHeader({
  locationId,
  view,
  title,
  description,
  run,
  actions,
  groupFilter = false,
}: {
  locationId: string;
  view: "overview" | "keywords" | "groups" | "map" | "grid" | "competitors";
  title: string;
  description: string;
  run?: RunMeta | undefined;
  actions?: ReactNode;
  /** Show the keyword-group filter (Rank Tracker, Keywords, grid). */
  groupFilter?: boolean;
}) {
  const [runId, setRunId] = useRunParam();
  const radius = run?.config.radius_km;
  return (
    <>
      <RankingsNavigation locationId={locationId} activeView={view} />
      <PageHeader
        title={title}
        description={description}
        meta={
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {run ? (
              <p>
                Run of {formatRunDate(run.run_at, true)}
                {run.status === "partial" ? " · partial: some searches failed" : ""} · {run.config.grid_size}×{run.config.grid_size} grid
                {radius ? `, ${formatDistance(radius)} from center to edge` : `, points ${run.config.spacing_km} km apart`}
              </p>
            ) : null}
            <p>{RANKINGS_SOURCE_NOTE}</p>
          </div>
        }
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {groupFilter ? <GroupFilter locationId={locationId} /> : null}
            <RunPicker locationId={locationId} runId={runId} onChange={setRunId} />
            <RefreshRankingsButton locationId={locationId} />
            <GridSettingsButton locationId={locationId} />
            {actions}
          </div>
        }
      />
    </>
  );
}
