import { ArrowDown, ArrowRight, ArrowUp, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Panel, StatusBadge, TrendIndicator } from "@/components/layout/shared/data-display";
import type { MapRankingData, MapRankingPoint, MapRankingResultType } from "@/lib/mypageseo/map-rankings";
import { cn } from "@/lib/utils";

export type MapRankingFilters = {
  keyword: string;
  searchContext: string;
  date: string;
  compare: string;
  resultType: string;
};

export function MapRankingFilterBar({
  data,
  values,
  onChange,
}: {
  data: MapRankingData;
  values: MapRankingFilters;
  onChange: (field: keyof MapRankingFilters, value: string) => void;
}) {
  if (data.status !== "ready") return null;
  return (
    <div role="group" className="grid gap-3 rounded-lg border border-border bg-surface p-3 shadow-card sm:grid-cols-2 xl:grid-cols-5" aria-label="Map ranking filters">
      <MapFilter label="Tracked keyword" value={values.keyword} onChange={(value) => onChange("keyword", value)} options={data.keywords.map((item) => ({ value: item.id, label: item.label }))} />
      <MapFilter label="Search location" value={values.searchContext} onChange={(value) => onChange("searchContext", value)} options={data.searchContexts.map((item) => ({ value: item.id, label: item.label }))} />
      <MapFilter label="Result type" value={values.resultType} onChange={(value) => onChange("resultType", value)} options={data.resultTypes.map((item) => ({ value: item, label: resultTypeLabel(item) }))} />
      <MapFilter label="Result date" value={values.date} onChange={(value) => onChange("date", value)} options={data.dates.map((item) => ({ value: item, label: item }))} />
      <MapFilter label="Compare with" value={values.compare} onChange={(value) => onChange("compare", value)} options={data.comparisonDates.map((item) => ({ value: item, label: item }))} placeholder="No comparison" />
    </div>
  );
}

function MapFilter({ label, value, options, onChange, placeholder }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="min-w-0 text-xs font-medium text-muted-foreground">
      <span className="mb-1.5 block">{label}</span>
      <Select {...(value ? { value } : {})} onValueChange={onChange} disabled={options.length === 0}>
        <SelectTrigger className="w-full bg-background" aria-label={label}><SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  );
}

export function MapRankingContent({ data, onRetry }: { data: MapRankingData; onRetry: () => void }) {
  if (data.status === "loading") return <MapRankingsLoading />;
  if (data.status === "error") return <ErrorState title="Map rankings could not be loaded" description="We couldn't load geographic ranking information for this location. Try again without leaving this page." onRetry={onRetry} className="min-h-80" />;
  if (data.status === "no_keywords") return <EmptyState title="Set up keywords to view Map Rankings" description="This location has no configured keywords. Geographic ranking results can appear after tracked keywords are available and map ranking collection begins." className="min-h-80" />;
  if (data.status === "geographic_data_unavailable") return <EmptyState title="Geographic ranking data is not available" description="Map Rankings requires geographic search results that are not currently available for this location." className="min-h-80" />;
  if (data.status === "keyword_no_data") return <EmptyState title="No map results for this keyword" description="The selected keyword has no geographic ranking result for this search location and date. Choose another available context." className="min-h-80" />;

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
      <MapVisualization points={data.points} contextLabel={data.selectedSearchContext?.label ?? "Selected search area"} />
      <RankingSummary data={data} />
      <div className="min-w-0 xl:col-span-2"><MapRankingResults data={data} /></div>
    </div>
  );
}

function MapVisualization({ points, contextLabel }: { points: MapRankingPoint[]; contextLabel: string }) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const latMin = Math.min(...latitudes);
  const latMax = Math.max(...latitudes);
  const lngMin = Math.min(...longitudes);
  const lngMax = Math.max(...longitudes);
  const position = (point: MapRankingPoint) => ({
    left: `${10 + ((point.longitude - lngMin) / Math.max(lngMax - lngMin, 0.0001)) * 80}%`,
    top: `${10 + ((latMax - point.latitude) / Math.max(latMax - latMin, 0.0001)) * 80}%`,
  });
  return (
    <Panel title="Geographic ranking result" description={contextLabel}>
      <div className="relative aspect-[4/3] w-full min-w-0 min-h-80 overflow-hidden rounded-md border border-border bg-muted" aria-label={`Ranking points around ${contextLabel}`}>
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        {points.map((point) => <MapPoint key={point.id} point={point} style={position(point)} />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary" />Selected business</span><span>Marker number is the recorded rank at that search point.</span></div>
    </Panel>
  );
}

function MapPoint({ point, style }: { point: MapRankingPoint; style: { left: string; top: string } }) {
  return <span style={style} className={cn("absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface text-xs font-semibold shadow-raised", point.isSelectedBusiness ? "bg-primary text-primary-foreground" : "bg-surface text-foreground")} title={point.rank === null ? "Not ranked" : `Rank ${point.rank}`}>{point.rank ?? "—"}</span>;
}

function RankingSummary({ data }: { data: MapRankingData }) {
  const movement = data.currentRank !== null && data.previousRank !== null ? data.previousRank - data.currentRank : null;
  return (
    <Panel title="Ranking summary" description="Context for the result shown on the map">
      <dl className="divide-y divide-border text-sm">
        <SummaryRow label="Keyword" value={data.selectedKeyword?.label ?? "—"} />
        <SummaryRow label="Search location" value={data.selectedSearchContext?.label ?? "—"} />
        <SummaryRow label="Result type" value={data.resultType ? resultTypeLabel(data.resultType) : "—"} />
        <SummaryRow label="Result date" value={data.selectedDate ?? "—"} />
        <SummaryRow label="Current rank" value={data.currentRank ?? "Not ranked"} strong />
        <SummaryRow label="Previous rank" value={data.previousRank ?? "No comparison"} />
      </dl>
      {movement !== null ? <div className="mt-4 border-t border-border pt-4"><p className="text-xs font-medium text-muted-foreground">Movement</p><TrendIndicator direction={movement > 0 ? "up" : movement < 0 ? "down" : "flat"} positive={movement > 0} value={movement === 0 ? "Unchanged" : `${Math.abs(movement)} positions ${movement > 0 ? "improved" : "declined"}`} className="mt-1" /></div> : null}
    </Panel>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className={cn("text-right tabular text-foreground", strong && "text-lg font-semibold")}>{value}</dd></div>;
}

function MapRankingResults({ data }: { data: MapRankingData }) {
  return (
    <Panel title="Ranking results" description="Businesses returned for the selected keyword and search context">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-2 font-medium">Position</th><th className="pb-2 font-medium">Business</th><th className="pb-2 font-medium">Previous</th><th className="pb-2 font-medium">Movement</th><th className="pb-2 font-medium">Context</th></tr></thead>
          <tbody className="divide-y divide-border">{data.results.map((row) => {
            const movement = row.previousPosition === null ? null : row.previousPosition - row.position;
            return <tr key={row.id} className={row.isSelectedBusiness ? "bg-accent/60" : undefined}><td className="py-3 font-semibold tabular text-foreground">{row.position}</td><td className="py-3 font-medium text-foreground">{row.businessName}</td><td className="py-3 tabular text-muted-foreground">{row.previousPosition ?? "—"}</td><td className="py-3"><MovementStatus movement={movement} /></td><td className="py-3">{row.isSelectedBusiness ? <StatusBadge tone="info"><MapPin aria-hidden />Selected business</StatusBadge> : <span className="text-muted-foreground">Competitor</span>}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </Panel>
  );
}

function MovementStatus({ movement }: { movement: number | null }) {
  if (movement === null || movement === 0) return <StatusBadge>{movement === null ? "No comparison" : <><ArrowRight aria-hidden /> Unchanged</>}</StatusBadge>;
  return <StatusBadge tone={movement > 0 ? "success" : "critical"}>{movement > 0 ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}{Math.abs(movement)} {movement > 0 ? "improved" : "declined"}</StatusBadge>;
}

function resultTypeLabel(resultType: MapRankingResultType) {
  return resultType === "google_maps" ? "Google Maps" : "Local Finder";
}

export function MapRankingsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading Map Rankings">
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index}><Skeleton className="mb-2 h-3 w-20" /><Skeleton className="h-9 w-full" /></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]"><Skeleton className="aspect-[4/3] min-h-80 w-full" /><Skeleton className="min-h-80 w-full" /></div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}