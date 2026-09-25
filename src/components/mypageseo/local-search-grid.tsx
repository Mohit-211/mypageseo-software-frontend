import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, MetricSkeletonGrid } from "@/components/layout/shared/feedback/states";
import { MetricCard, Panel, TrendIndicator } from "@/components/layout/shared/data-display";
import type { GridMetric, GridPoint, GridSearchType, LocalSearchGridData } from "@/lib/mypageseo/local-search-grid";
import { cn } from "@/lib/utils";

export type LocalGridFilters = { keyword: string; gridSize: string; radius: string; searchType: string; scanDate: string; compare: string };

export function LocalGridFilterBar({ data, values, onChange }: { data: LocalSearchGridData; values: LocalGridFilters; onChange: (field: keyof LocalGridFilters, value: string) => void }) {
  if (data.status !== "ready") return null;
  return <div role="group" className="grid gap-3 rounded-lg border border-border bg-surface p-3 shadow-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Local Search Grid filters">
    <GridFilter label="Keyword" value={values.keyword} options={data.keywords.map((item) => ({ value: item.id, label: item.label }))} onChange={(value) => onChange("keyword", value)} />
    <GridFilter label="Grid size" value={values.gridSize} options={data.gridSizes.map(option)} onChange={(value) => onChange("gridSize", value)} />
    <GridFilter label="Radius" value={values.radius} options={data.radii.map(option)} onChange={(value) => onChange("radius", value)} />
    <GridFilter label="Search type" value={values.searchType} options={data.searchTypes.map((item) => ({ value: item, label: searchTypeLabel(item) }))} onChange={(value) => onChange("searchType", value)} />
    <GridFilter label="Scan date" value={values.scanDate} options={data.scanDates.map(option)} onChange={(value) => onChange("scanDate", value)} />
    <GridFilter label="Compare with" value={values.compare} options={data.comparisonDates.map(option)} onChange={(value) => onChange("compare", value)} placeholder="No comparison" />
  </div>;
}

function option(value: string) { return { value, label: value }; }
function GridFilter({ label, value, options, onChange, placeholder }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="min-w-0 text-xs font-medium text-muted-foreground"><span className="mb-1.5 block">{label}</span><Select {...(value ? { value } : {})} onValueChange={onChange} disabled={options.length === 0}><SelectTrigger className="w-full bg-background" aria-label={label}><SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></label>;
}

export function LocalSearchGridContent({ data, onRetry }: { data: LocalSearchGridData; onRetry: () => void }) {
  if (data.status === "loading") return <LocalSearchGridLoading />;
  if (data.status === "error") return <ErrorState title="Local Search Grid could not be loaded" description="We couldn't load the geographic scan for this location. Try again without leaving this page." onRetry={onRetry} className="min-h-80" />;
  if (data.status === "no_keywords") return <EmptyState title="Set up keywords to use Local Search Grid" description="This location has no configured keywords. A geographic grid can be scanned after tracked keywords are available." className="min-h-80" />;
  if (data.status === "grid_data_unavailable") return <EmptyState title="Geographic grid data is not available" description="Local Search Grid requires real geographic search points that are not currently available for this location." className="min-h-80" />;
  if (data.status === "no_scans") return <EmptyState title="No grid scans yet" description="A completed geographic scan is required before Local Search Grid results can be displayed." className="min-h-80" />;
  return <div className="space-y-6"><GridMetrics data={data} /><div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.8fr)]"><GeographicGrid data={data} /><div className="space-y-6"><GridContext data={data} /><GridDistribution data={data} /></div></div></div>;
}

function GridMetrics({ data }: { data: LocalSearchGridData }) {
  const { averageRank, visibility, coverage } = data.metrics;
  if (!averageRank || !visibility || !coverage) return null;
  return <section aria-labelledby="grid-summary"><h2 id="grid-summary" className="mb-3 text-sm font-semibold text-foreground">Scan summary</h2><div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-3 sm:divide-x sm:divide-border"><MetricCard label="Average Rank" value={averageRank.value.toFixed(1)} trend={<MetricChange metric={averageRank} lowerIsBetter />} caption="Average position across ranked points" /><MetricCard label="Visibility" value={`${visibility.value}%`} trend={<MetricChange metric={visibility} />} caption="Points meeting the recorded visibility threshold" /><MetricCard label="Coverage" value={`${coverage.value}%`} trend={<MetricChange metric={coverage} />} caption="Grid points where the business ranked" /></div></section>;
}
function MetricChange({ metric, lowerIsBetter = false }: { metric: GridMetric; lowerIsBetter?: boolean }) {
  if (metric.change === null) return null;
  const direction = metric.change > 0 ? "up" : metric.change < 0 ? "down" : "flat";
  return <TrendIndicator direction={direction} positive={lowerIsBetter ? metric.change < 0 : metric.change > 0} value={metric.change === 0 ? "Unchanged" : Math.abs(metric.change).toFixed(1)} />;
}

function GeographicGrid({ data }: { data: LocalSearchGridData }) {
  const [selectedPoint, setSelectedPoint] = useState<GridPoint | null>(null);
  return <Panel title="Geographic ranking grid" description="Each numbered point is a search performed at that geographic coordinate."><div className="overflow-x-auto pb-1"><div className="mx-auto grid min-w-[360px] max-w-[680px] gap-3 rounded-md border border-border bg-muted p-5" role="group" style={{ gridTemplateColumns: `repeat(${data.columns}, minmax(42px, 1fr))` }} aria-label={`Local ranking grid with ${data.points.length} search points`}>{data.points.map((point) => <GridPointControl key={point.id} point={point} selected={selectedPoint?.id === point.id} onSelect={() => setSelectedPoint(point)} />)}</div></div><GridLegend />{selectedPoint ? <PointDetail point={selectedPoint} /> : <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">Select a numbered point to inspect its coordinate and recorded rank.</p>}</Panel>;
}
function GridPointControl({ point, selected, onSelect }: { point: GridPoint; selected: boolean; onSelect: () => void }) {
  const tone = point.rank === null ? "border-border bg-surface text-muted-foreground" : point.rank <= 3 ? "border-success/35 bg-success-surface text-success" : point.rank <= 10 ? "border-warning/40 bg-warning-surface text-warning-foreground" : "border-critical/25 bg-critical-surface text-critical";
  return <Button type="button" variant="outline" size="icon" onClick={onSelect} aria-label={`Search point row ${point.row + 1}, column ${point.column + 1}: ${point.rank === null ? "not ranked" : `rank ${point.rank}`}`} aria-pressed={selected} className={cn("aspect-square size-auto min-h-11 rounded-full text-xs font-semibold tabular", tone, selected && "ring-2 ring-primary ring-offset-2")}>{point.rank ?? "—"}</Button>;
}
function GridLegend() {
  const items = [{ label: "1–3", tone: "bg-success-surface border-success/35" }, { label: "4–10", tone: "bg-warning-surface border-warning/40" }, { label: "11+", tone: "bg-critical-surface border-critical/25" }, { label: "Not ranked", tone: "bg-surface border-border" }];
  return <div role="group" className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Rank range legend">{items.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-full border", item.tone)} />{item.label}</span>)}</div>;
}
function PointDetail({ point }: { point: GridPoint }) {
  return <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3"><Detail label="Grid point" value={`Row ${point.row + 1}, column ${point.column + 1}`} /><Detail label="Coordinate" value={`${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`} /><Detail label="Recorded rank" value={point.rank === null ? "Not ranked" : String(point.rank)} /></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium tabular">{value}</p></div>; }

function GridContext({ data }: { data: LocalSearchGridData }) {
  return <Panel title="Scan context" description="What every point in this grid represents"><dl className="divide-y divide-border text-sm"><ContextRow label="Keyword" value={data.selectedKeyword?.label ?? "—"} /><ContextRow label="Search type" value={data.searchType ? searchTypeLabel(data.searchType) : "—"} /><ContextRow label="Scan date" value={data.scanDate ?? "—"} /><ContextRow label="Area" value={data.geographicContext ?? "—"} /><ContextRow label="Grid" value={data.gridSize ?? `${data.rows} × ${data.columns}`} /><ContextRow label="Radius" value={data.radius ?? "—"} /></dl></Panel>;
}
function ContextRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>; }
function GridDistribution({ data }: { data: LocalSearchGridData }) {
  const total = data.distribution.reduce((sum, item) => sum + item.count, 0);
  return <Panel title="Ranking distribution" description="Grid points by recorded position range"><div className="space-y-4">{data.distribution.map((bucket) => <div key={bucket.label}><div className="flex justify-between gap-3 text-sm"><span>{bucket.label}</span><span className="font-semibold tabular">{bucket.count}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", bucket.range === "strong" ? "bg-success" : bucket.range === "visible" ? "bg-warning" : bucket.range === "weak" ? "bg-critical" : "bg-muted-foreground")} style={{ width: `${total ? (bucket.count / total) * 100 : 0}%` }} /></div></div>)}</div></Panel>;
}
function searchTypeLabel(type: GridSearchType) { return type === "google_maps" ? "Google Maps" : "Local Finder"; }
export function LocalSearchGridLoading() { return <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading Local Search Grid"><div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index}><Skeleton className="mb-2 h-3 w-20" /><Skeleton className="h-9 w-full" /></div>)}</div><MetricSkeletonGrid count={3} /><div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.8fr)]"><Skeleton className="aspect-square max-h-[680px] min-h-96 w-full" /><div className="space-y-6"><Skeleton className="h-72 w-full" /><Skeleton className="h-64 w-full" /></div></div></div>; }