import { useSearchParams } from "react-router-dom";
import type { MapRankingResponse, TrackerPointLabel } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { PinsMap, type MapPin } from "@/components/ranking/rank-map";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { targetLabel } from "@/lib/rankings/format";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useMapRanking } from "@/lib/rankings/use-rankings";
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

/** Local Map Ranking: who ranks in the top 20 at one search point, per keyword. */
function LocationMapRankingsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [params, setParams] = useSearchParams();
  const point = POINTS.includes(params.get("point") as TrackerPointLabel) ? (params.get("point") as TrackerPointLabel) : "C";
  const map = useMapRanking(location.location_id, runId, point);

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
        view="map"
        title="Map Rankings"
        description="The top 20 Google Maps results at a search point, with your business and tracked competitors marked."
        run={map.data?.run}
      />
      {map.isPending ? (
        <PageSkeleton />
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
  selfName,
  keyword,
  point,
  onKeyword,
  onPoint,
}: {
  data: MapRankingResponse;
  selfName: string;
  keyword: string | null;
  point: TrackerPointLabel;
  onKeyword: (keyword: string) => void;
  onPoint: (point: string) => void;
}) {
  const selected = data.keywords.find((entry) => entry.keyword === keyword) ?? data.keywords[0];
  if (!selected) return <Panel><p className="text-sm text-muted-foreground">This run has no keywords.</p></Panel>;
  const selfRank = selected.results.find((result) => result.is_self)?.rank ?? null;
  // Runs before map pins (Phase 17) have no coordinates: no map for those.
  const pins: MapPin[] = selected.results.flatMap((result) =>
    result.lat != null && result.lng != null
      ? [{
          key: `${result.rank}-${result.place_id}`,
          lat: result.lat,
          lng: result.lng,
          rank: result.rank,
          name: result.name ?? "Unnamed business",
          kind: result.is_self ? ("self" as const) : result.target_key ? ("competitor" as const) : ("other" as const),
        }]
      : [],
  );
  const searchPoint = searchPointFor(selected.point, data.run.center, data.run.config.tracker_offset_km);
  const available = data.points_available.length > 0 ? data.points_available : (["C"] as TrackerPointLabel[]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="map-keyword">Keyword</Label>
          <Select value={selected.keyword} onValueChange={onKeyword}>
            <SelectTrigger id="map-keyword" className="w-full bg-background sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.keywords.map((entry) => <SelectItem key={entry.keyword} value={entry.keyword}>{entry.keyword}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="map-point">Search point</Label>
          <Select value={point} onValueChange={onPoint}>
            <SelectTrigger id="map-point" className="w-full bg-background sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POINTS.map((value) => (
                <SelectItem key={value} value={value} disabled={!available.includes(value)}>
                  {POINT_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pins.length > 0 ? (
        <Panel title="Map" description="Numbers are the Google Maps rank from this search point. Yours is highlighted; tracked competitors are blue.">
          <PinsMap pins={pins} searchPoint={searchPoint} />
        </Panel>
      ) : null}

      <Panel
        title={`${selected.keyword} · ${POINT_LABEL[selected.point] ?? selected.point}`}
        description={selfRank ? `${selfName} is #${selfRank} here.` : `${selfName} isn't in the top 20 here.`}
      >
        <ol className="-m-4 divide-y divide-border">
          {selected.results.map((result) => (
            <li
              key={`${result.rank}-${result.place_id}`}
              className={cn("flex items-center gap-3 px-4 py-2.5", result.is_self && "bg-brand-tint font-semibold")}
            >
              <span className="w-7 shrink-0 text-right text-sm tabular text-muted-foreground">{result.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">
                  {result.name ?? <span className="text-muted-foreground">Name not stored</span>}
                </span>
                {result.address ? <span className="block truncate text-xs font-normal text-muted-foreground">{result.address}</span> : null}
              </span>
              {result.is_self ? (
                <StatusBadge tone="brand">You</StatusBadge>
              ) : result.target_key ? (
                <StatusBadge tone="info">{targetLabel(result.target_key, selfName, data.targets?.find((t) => t.key === result.target_key)?.name)}</StatusBadge>
              ) : null}
            </li>
          ))}
        </ol>
      </Panel>
      {!data.names_stored ? <p className="text-xs text-muted-foreground">Business names aren't stored for this run.</p> : null}
      {data.attribution ? <p className="text-[11px] text-muted-foreground">{data.attribution.text}</p> : null}
    </div>
  );
}

export default LocationMapRankingsPage;
