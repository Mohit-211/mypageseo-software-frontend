import { Link, useSearchParams } from "react-router-dom";
import { Crosshair, ListOrdered, MapPinned, Tags, type LucideIcon } from "lucide-react";
import type { MapRankingResponse, TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { EmptyState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { RankCellView, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { PinsMap, type MapPin } from "@/components/ranking/rank-map";
import { TrackCompetitorButton } from "@/components/ranking/track-competitor-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { sameKeyword } from "@/lib/keywords/keywords";
import { keywordsPath } from "@/lib/keywords/paths";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useMapRanking } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";
import { useSearchUpdater } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const POINT_LABEL: Record<TrackerPointLabel, string> = {
  C: "Center",
  N: "North",
  S: "South",
  E: "East",
  W: "West",
};
const POINTS = Object.keys(POINT_LABEL) as TrackerPointLabel[];

/** Where a tracker point lies: the center, or `offsetKm` north / south / east / west of it. */
function searchPointFor(point: TrackerPointLabel, center: { lat: number; lng: number }, offsetKm: number) {
  const dLat = offsetKm / 111.32;
  const dLng = offsetKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  switch (point) {
    case "N":
      return { lat: center.lat + dLat, lng: center.lng };
    case "S":
      return { lat: center.lat - dLat, lng: center.lng };
    case "E":
      return { lat: center.lat, lng: center.lng + dLng };
    case "W":
      return { lat: center.lat, lng: center.lng - dLng };
    default:
      return center;
  }
}

/** Map Rankings: who ranks in Google's top 20 at one search point, per keyword. */
function LocationMapRankingsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const point = POINTS.includes(params.get("point") as TrackerPointLabel) ? (params.get("point") as TrackerPointLabel) : "C";
  const map = useMapRanking(location.location_id, runId, point);

  // Picking a keyword or a point replaces the history entry and keeps the page where it is.
  const setParam = (key: string, value: string | undefined) =>
    updateSearch((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        title="Map Rankings"
        description="Who ranks at one search spot: Google's top 20 there, with you and your tracked competitors marked."
        run={map.data?.run}
      />
      {map.isPending ? (
        <PageSkeleton header={false} metrics={0} rows={8} columns={3} />
      ) : map.isError ? (
        <RankingsError
          error={map.error}
          locationId={location.location_id}
          onRetry={() => void map.refetch()}
          onLatest={() => setRunId(undefined)}
          onClearKeyword={() => setParam("keyword", undefined)}
          onPoint={(next) => setParam("point", next === "C" ? undefined : next)}
        />
      ) : (
        <MapContent
          data={map.data}
          locationId={location.location_id}
          selfName={location.name}
          keyword={params.get("keyword")}
          point={point}
          onKeyword={(value) => setParam("keyword", value)}
          onPoint={(value) => setParam("point", value === "C" ? undefined : value)}
        />
      )}
    </>
  );
}

function MapContent({
  data,
  locationId,
  selfName,
  keyword,
  point,
  onKeyword,
  onPoint,
}: {
  data: MapRankingResponse;
  locationId: string;
  selfName: string;
  keyword: string | null;
  point: TrackerPointLabel;
  onKeyword: (keyword: string) => void;
  onPoint: (point: TrackerPointLabel) => void;
}) {
  const canEdit = useCanEdit();
  const keywords = sortRows(data.keywords, byText((entry) => entry.keyword));
  const selected = (keyword ? keywords.find((entry) => sameKeyword(entry.keyword, keyword)) : undefined) ?? keywords[0];
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
  const selfRank = selected.self ? selected.self.list_rank : (selected.results.find((result) => result.is_self)?.rank ?? null);
  const trackerCell = selected.self?.tracker_cell ?? null;
  const pointText = selected.scope?.description ?? POINT_LABEL[selected.point] ?? selected.point;
  // Runs before map pins (Phase 17) have no coordinates: no map for those.
  const pins: MapPin[] = selected.results.flatMap((result) =>
    result.lat != null && result.lng != null
      ? [
          {
            key: `${result.rank}-${result.place_id}`,
            lat: result.lat,
            lng: result.lng,
            rank: result.rank,
            name: result.name ?? "Unnamed business",
            kind: result.is_self ? ("self" as const) : result.target_key ? ("competitor" as const) : ("other" as const),
          },
        ]
      : [],
  );
  const searchPoint = searchPointFor(selected.point, data.run.center, data.run.config.tracker_offset_km);
  const available = data.points_available.length > 0 ? data.points_available : (["C"] as TrackerPointLabel[]);
  const competitorsInList = selected.results.filter((result) => result.target_key && !result.is_self).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card md:flex-row md:flex-wrap md:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="map-keyword">Keyword</Label>
          <Select value={selected.keyword} onValueChange={onKeyword}>
            <SelectTrigger id="map-keyword" className="w-full md:w-72">
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
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-1 text-sm font-medium text-foreground">
            Search spot <InfoTip label="About search spots">{GLOSSARY.mapPoint}</InfoTip>
          </p>
          <SegmentedControl<TrackerPointLabel>
            aria-label="Search spot"
            size="md"
            value={point}
            onValueChange={onPoint}
            options={POINTS.map((value) => ({ value, label: POINT_LABEL[value], disabled: !available.includes(value) }))}
          />
        </div>
      </div>

      <section aria-label="You at this spot" className="grid gap-3 sm:grid-cols-3">
        <Fact icon={ListOrdered} label="Your place in this top 20">
          {selfRank ? <span className="text-2xl font-semibold tabular-nums text-foreground">#{selfRank}</span> : <span className="text-sm font-medium text-foreground">Not in the top 20 here</span>}
        </Fact>
        <Fact icon={Crosshair} label="Rank Tracker at this spot" tip="The same spot in the Rank Tracker comes from a separate search made minutes apart, so the two can differ by a place or two.">
          {trackerCell ? <RankCellView cell={trackerCell} className="px-2.5 py-1 text-base" /> : <span className="text-sm text-muted-foreground">—</span>}
        </Fact>
        <Fact icon={MapPinned} label="Tracked competitors here">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{competitorsInList}</span>
          <span className="ml-1.5 text-sm text-muted-foreground">of {Math.max(0, (data.targets?.length ?? 1) - 1)}</span>
        </Fact>
      </section>

      <div className={cn("grid gap-4", pins.length > 0 && "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]")}>
        {pins.length > 0 ? (
          <Panel title="Map" description={`${selected.keyword} · ${pointText}`} className="xl:sticky xl:top-20 xl:self-start">
            <PinsMap pins={pins} searchPoint={searchPoint} className="h-[420px] w-full sm:h-[520px]" />
          </Panel>
        ) : null}

        <Panel
          title="Who ranks here"
          description={pins.length > 0 ? "Google's named top 20 at this spot." : `${selected.keyword} · ${pointText}`}
          className="overflow-hidden"
        >
          {/* One bleed wrapper, so the footer below the list sits inside the card edge to edge. */}
          <div className="-m-4">
            <ol className="divide-y divide-border">
              {selected.results.map((result) => {
                const competitor = Boolean(result.target_key) && !result.is_self;
                return (
                  <li
                    key={`${result.rank}-${result.place_id}`}
                    className={cn("flex items-center gap-3 px-4 py-2.5", result.is_self && "bg-brand-tint/70 shadow-[inset_3px_0_0_var(--color-primary)]")}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums",
                        result.is_self ? "border-primary bg-primary text-primary-foreground" : competitor ? "border-info bg-info text-info-foreground" : "border-border-strong bg-card text-foreground",
                      )}
                    >
                      {result.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm text-foreground", result.is_self && "font-semibold")}>
                        {result.name ?? (result.is_self ? selfName : <span className="text-muted-foreground">Name not stored</span>)}
                      </span>
                      {result.address ? <span className="block truncate text-xs text-muted-foreground">{result.address}</span> : null}
                    </span>
                    {result.is_self ? (
                      <StatusBadge tone="brand" size="sm">
                        You
                      </StatusBadge>
                    ) : competitor ? (
                      <StatusBadge tone="info" size="sm">
                        Tracked
                      </StatusBadge>
                    ) : (
                      <TrackCompetitorButton locationId={locationId} placeId={result.place_id} name={result.name} />
                    )}
                  </li>
                );
              })}
            </ol>
            {/* Google's attribution belongs next to the business names it credits (docs/API.md). */}
            {data.attribution || !data.names_stored ? (
              <p className="space-y-0.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                {data.attribution ? <span className="block">Business names and addresses: {data.attribution.text}</span> : null}
                {!data.names_stored ? <span className="block">Business names aren't stored for this run.</span> : null}
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, tip, children }: { icon: LucideIcon; label: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <IconChip icon={Icon} tone="rankings" size="md" />
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {label}
          {tip ? <InfoTip label={`About ${label.toLowerCase()}`}>{tip}</InfoTip> : null}
        </p>
        <div className="mt-1 flex items-baseline">{children}</div>
      </div>
    </div>
  );
}

export default LocationMapRankingsPage;
