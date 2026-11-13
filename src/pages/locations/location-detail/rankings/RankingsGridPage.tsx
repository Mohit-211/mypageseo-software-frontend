import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LayoutGrid, Map as MapIcon, Tags } from "lucide-react";
import type { GridResponse } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { EmptyState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { AvgRankPill, BucketLegend, RankCellView, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { GridMap } from "@/components/ranking/rank-map";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { sameKeyword } from "@/lib/keywords/keywords";
import { keywordsPath } from "@/lib/keywords/paths";
import { BUCKET_LABEL, formatRate, targetLabel } from "@/lib/rankings/format";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useGrid } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";
import { useSearchUpdater } from "@/lib/url-state";
import { cn } from "@/lib/utils";

type View = "map" | "squares";

/** Local Search Grid: one keyword's rank at every grid point, for one business. */
function RankingsGridPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  // All keywords come in one call, so switching keyword or business needs no request.
  const grid = useGrid(location.location_id, runId, group);

  // Picking a keyword or a business replaces the history entry and keeps the page where it is.
  const setParam = (key: string, value: string | undefined) =>
    updateSearch((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        title="Local Search Grid"
        description="How your rank changes across the area: each point is one Google Maps search, with north at the top."
        run={grid.data?.run}
        scope={grid.data?.scope?.description}
        groupFilter
      />
      {grid.isPending ? (
        <PageSkeleton header={false} metrics={0} rows={8} columns={4} />
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
          locationId={location.location_id}
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
  locationId,
  selfName,
  keyword,
  target,
  onKeyword,
  onTarget,
}: {
  data: GridResponse;
  locationId: string;
  selfName: string;
  keyword: string | null;
  target: string;
  onKeyword: (keyword: string) => void;
  onTarget: (target: string) => void;
}) {
  const [view, setView] = useState<View>("map");
  const canEdit = useCanEdit();
  const keywords = sortRows(data.keywords, byText((entry) => entry.keyword));
  const selected = (keyword ? keywords.find((entry) => sameKeyword(entry.keyword, keyword)) : undefined) ?? keywords[0];
  const targets = [
    ...data.targets.filter((entry) => entry.key === "self"),
    ...sortRows(
      data.targets.filter((entry) => entry.key !== "self"),
      byText((entry) => targetLabel(entry.key, selfName, entry.name)),
    ),
  ];
  const targetKey = data.targets.some((entry) => entry.key === target) ? target : "self";
  if (!selected) {
    return (
      <EmptyState
        icon={Tags}
        tone="keywords"
        title="This run has no keywords"
        description={
          canEdit
            ? "Add keywords on the Keywords page; they're measured from the next ranking run."
            : "Keywords your agency adds are measured from the next ranking run."
        }
        action={
          <Button asChild variant={canEdit ? "default" : "outline"}>
            <Link to={keywordsPath(locationId)}>{canEdit ? "Manage keywords" : "See keywords"}</Link>
          </Button>
        }
      />
    );
  }

  const size = data.grid.size;
  const center = (size - 1) / 2;
  const byPosition = new Map(selected.points.map((point) => [`${point.row}:${point.col}`, point]));
  const summary = selected.summary[targetKey];
  const targetName = targetLabel(targetKey, selfName, data.targets.find((entry) => entry.key === targetKey)?.name);
  const mapPoints = selected.points.flatMap((point) => {
    const cell = point.byTarget[targetKey];
    if (!cell) return [];
    const text = cell.status === "error" ? "–" : cell.status === "not_found" ? "60+" : cell.display;
    return [{ key: `${point.row}:${point.col}`, lat: point.lat, lng: point.lng, text, bucket: cell.bucket, title: `${text} · ${BUCKET_LABEL[cell.bucket]}` }];
  });
  // How many points fall in each bucket, for the summary.
  const counts = { top3: 0, top10: 0, total: 0 };
  for (const point of selected.points) {
    const cell = point.byTarget[targetKey];
    if (!cell || cell.status === "error") continue;
    counts.total += 1;
    if (cell.bucket === "pack") counts.top3 += 1;
    if (cell.bucket === "pack" || cell.bucket === "visible") counts.top10 += 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="grid-keyword">Keyword</Label>
          <Select value={selected.keyword} onValueChange={onKeyword}>
            <SelectTrigger id="grid-keyword" className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {keywords.map((entry) => (
                <SelectItem key={entry.keyword} value={entry.keyword}>
                  {entry.keyword}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data.targets.length > 1 ? (
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="grid-target">Business</Label>
            <Select value={targetKey} onValueChange={onTarget}>
              <SelectTrigger id="grid-target" className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((entry) => (
                  <SelectItem key={entry.key} value={entry.key}>
                    {/* "You" first, so a long name can't push it out of the trigger. */}
                    {entry.key === "self" ? `You · ${selfName}` : targetLabel(entry.key, selfName, entry.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <SegmentedControl<View>
          aria-label="View"
          size="md"
          className="sm:ml-auto"
          value={view}
          onValueChange={setView}
          options={[
            { value: "map", label: "Map", icon: MapIcon },
            { value: "squares", label: "Squares", icon: LayoutGrid },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel
          title={`${selected.keyword} · ${targetKey === "self" ? "you" : targetName}`}
          description={`${size}×${size} points, ${data.grid.spacing_km} km apart. The ringed point is the business center.`}
        >
          {view === "map" ? (
            <GridMap points={mapPoints} center={data.run.center} className="h-[460px] w-full sm:h-[520px]" />
          ) : (
            <div className="space-y-3">
              <div
                className="mx-auto grid max-w-lg gap-1.5"
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
                    <div key={index} role="gridcell" className={cn("flex aspect-square items-center justify-center rounded-md", isCenter && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                      <RankCellView cell={cell} className="size-full min-w-0 text-sm" />
                    </div>
                  );
                })}
              </div>
              <BucketLegend className="justify-center" />
            </div>
          )}
        </Panel>
        <Panel title="Summary" description={targetKey === "self" ? "You, across the whole grid." : `${targetName}, across the whole grid.`}>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1 text-muted-foreground">
                Average rank <InfoTip label="About the average rank">{GLOSSARY.avgRank}</InfoTip>
              </dt>
              <dd>
                <AvgRankPill value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={data.status_text} />
              </dd>
            </div>
            <SummaryBar label="In the top 3" tip={GLOSSARY.top3} value={summary?.top3Rate ?? null} detail={`${counts.top3} of ${counts.total} points`} fill="bg-success" />
            <SummaryBar label="In the top 10" value={counts.total ? counts.top10 / counts.total : null} detail={`${counts.top10} of ${counts.total} points`} fill="bg-info" />
            <SummaryBar label="Found in the top 60" tip={GLOSSARY.found} value={summary?.foundRate ?? null} fill="bg-chart-1" />
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Not found counts as 61; failed searches are left out.</p>
          <Button asChild variant="outline" size="sm" className="mt-3 w-full">
            <Link to={keywordsPath(locationId, { keyword: selected.keyword })}>
              <Tags aria-hidden /> Keyword details
            </Link>
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function SummaryBar({ label, tip, value, detail, fill }: { label: string; tip?: string; value: number | null; detail?: string; fill: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        {tip ? <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip> : null}
      </dt>
      <dd className="font-semibold tabular-nums text-foreground">{formatRate(value)}</dd>
      <dd className="col-span-2">
        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", fill)} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
        </span>
        {detail ? <span className="mt-1 block text-xs text-muted-foreground">{detail}</span> : null}
      </dd>
    </div>
  );
}

export default RankingsGridPage;
