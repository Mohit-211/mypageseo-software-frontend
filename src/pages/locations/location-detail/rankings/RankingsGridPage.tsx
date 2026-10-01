import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { GridResponse } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { AvgRank, BucketLegend, RankCellView, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { GridMap } from "@/components/ranking/rank-map";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUCKET_LABEL, formatRate, targetLabel } from "@/lib/rankings/format";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useGrid } from "@/lib/rankings/use-rankings";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { cn } from "@/lib/utils";

/** Local Search Grid: one keyword's rank at every grid point, for one business. */
function RankingsGridPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const [params, setParams] = useSearchParams();
  // All keywords come in one call, so switching keyword or business needs no request.
  const grid = useGrid(location.location_id, runId, group);

  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="grid"
        title="Local Search Grid"
        description="Where the business ranks across the area: each square is one search point (north at the top)."
        run={grid.data?.run}
        groupFilter
      />
      {grid.isPending ? (
        <PageSkeleton />
      ) : grid.isError ? (
        <RankingsError
          error={grid.error}
          locationId={location.location_id}
          onRetry={() => void grid.refetch()}
          onLatest={() => setRunId(undefined)}
          onClearKeyword={() => setParam("keyword", undefined)}
          onClearGroup={() => setGroup(undefined)}
        />
      ) : (
        <GridContent
          data={grid.data}
          selfName={location.name}
          keyword={params.get("keyword")}
          target={params.get("target") ?? "self"}
          onKeyword={(value) => setParam("keyword", value)}
          onTarget={(value) => setParam("target", value === "self" ? undefined : value)}
        />
      )}
    </>
  );
}

function GridContent({
  data,
  selfName,
  keyword,
  target,
  onKeyword,
  onTarget,
}: {
  data: GridResponse;
  selfName: string;
  keyword: string | null;
  target: string;
  onKeyword: (keyword: string) => void;
  onTarget: (target: string) => void;
}) {
  const [view, setView] = useState<"map" | "squares">("map");
  const selected = data.keywords.find((entry) => entry.keyword === keyword) ?? data.keywords[0];
  const targetKey = data.targets.some((entry) => entry.key === target) ? target : "self";
  if (!selected) return <Panel><p className="text-sm text-muted-foreground">This run has no keywords.</p></Panel>;

  const size = data.grid.size;
  const center = (size - 1) / 2;
  const byPosition = new Map(selected.points.map((point) => [`${point.row}:${point.col}`, point]));
  const summary = selected.summary[targetKey];
  const targetName = targetLabel(targetKey, selfName, data.targets.find((entry) => entry.key === targetKey)?.name);
  const mapPoints = selected.points.flatMap((point) => {
    const cell = point.byTarget[targetKey];
    if (!cell) return [];
    const text = cell.status === "error" ? "—" : cell.status === "not_found" ? "60+" : cell.display;
    return [{ key: `${point.row}:${point.col}`, lat: point.lat, lng: point.lng, text, bucket: cell.bucket, title: `${text} · ${BUCKET_LABEL[cell.bucket]}` }];
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="grid-keyword">Keyword</Label>
          <Select value={selected.keyword} onValueChange={onKeyword}>
            <SelectTrigger id="grid-keyword" className="w-full bg-background sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.keywords.map((entry) => <SelectItem key={entry.keyword} value={entry.keyword}>{entry.keyword}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {data.targets.length > 1 ? (
          <div className="space-y-1.5">
            <Label htmlFor="grid-target">Business</Label>
            <Select value={targetKey} onValueChange={onTarget}>
              <SelectTrigger id="grid-target" className="w-full bg-background sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {data.targets.map((entry) => <SelectItem key={entry.key} value={entry.key}>{targetLabel(entry.key, selfName, entry.name)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Panel
          title={`${selected.keyword} · ${targetName}`}
          description={`${size}×${size} points, ${data.grid.spacing_km} km apart. The outlined point is the business center.`}
          actions={
            <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="View">
              {(["map", "squares"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={cn("rounded px-2.5 py-1 text-xs font-medium capitalize", view === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {mode}
                </button>
              ))}
            </div>
          }
        >
          {view === "map" ? (
            <GridMap points={mapPoints} center={data.run.center} />
          ) : (
          <div
            className="mx-auto grid max-w-md gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            role="grid"
            aria-label={`Rank grid for ${selected.keyword}, north at the top`}
          >
            {Array.from({ length: size * size }, (_, index) => {
              const row = Math.floor(index / size);
              const col = index % size;
              const cell = byPosition.get(`${row}:${col}`)?.byTarget[targetKey];
              const isCenter = row === center && col === center;
              return (
                <div key={index} role="gridcell" className={cn("flex aspect-square items-center justify-center rounded-md", isCenter && "ring-2 ring-primary ring-offset-1")}>
                  <RankCellView cell={cell} className="size-full text-sm" />
                </div>
              );
            })}
          </div>
          )}
        </Panel>
        <Panel title="Summary">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground"><TermWithTip term="Average rank">{GLOSSARY.avgRank}</TermWithTip></dt><dd><AvgRank value={summary?.avgRank} /></dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground"><TermWithTip term="Found in top 60">{GLOSSARY.found}</TermWithTip></dt><dd className="tabular">{formatRate(summary?.foundRate)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground"><TermWithTip term="In the top 3">{GLOSSARY.top3}</TermWithTip></dt><dd className="tabular">{formatRate(summary?.top3Rate)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Not found counts as 61; failed searches are left out.</p>
        </Panel>
      </div>
      <BucketLegend />
    </div>
  );
}

export default RankingsGridPage;
