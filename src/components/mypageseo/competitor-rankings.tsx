import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, TableSkeleton, FilterBarSkeleton } from "@/components/mypageseo/states";
import { StatusBadge } from "@/components/mypageseo/data-display";
import type { CompetitorPosition, CompetitorRankingOrder, CompetitorRankingRow, CompetitorRankingsData, CompetitorRankingSort } from "@/lib/mypageseo/competitor-rankings";
import { cn } from "@/lib/utils";

export type CompetitorFilterValues = { query: string; competitor: string; group: string; date: string; comparison: string; resultType: string; focus: string };

export function CompetitorRankingFilterBar({ data, values, onChange, onReset }: { data: CompetitorRankingsData; values: CompetitorFilterValues; onChange: (key: keyof CompetitorFilterValues, value: string) => void; onReset: () => void }) {
  if (data.status !== "ready") return null;
  const hasFilters = values.query !== "" || values.competitor !== "all" || values.group !== "all" || values.focus !== "all";
  return <section aria-label="Competitor ranking filters" className="rounded-lg border border-border bg-surface p-3 shadow-card">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_repeat(3,minmax(140px,auto))_auto]">
      <label className="relative min-w-0"><span className="sr-only">Search keywords</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden /><Input value={values.query} onChange={(event) => onChange("query", event.target.value)} placeholder="Search keywords" className="bg-background pl-9" /></label>
      <FilterSelect label="Competitor" value={values.competitor} onChange={(value) => onChange("competitor", value)} options={[{ value: "all", label: "All competitors" }, ...data.competitors.map((item) => ({ value: item.id, label: item.name }))]} />
      <FilterSelect label="Keyword group" value={values.group} onChange={(value) => onChange("group", value)} options={[{ value: "all", label: "All groups" }, ...data.groups.map((item) => ({ value: item, label: item }))]} />
      <FilterSelect label="Comparison focus" value={values.focus} onChange={(value) => onChange("focus", value)} options={[{ value: "all", label: "All keywords" }, { value: "outranked", label: "Competitors lead" }, { value: "leading", label: "Location leads" }, { value: "improved", label: "Improved" }, { value: "declined", label: "Declined" }]} />
      <Button type="button" variant="ghost" size="sm" disabled={!hasFilters} onClick={onReset}><RotateCcw aria-hidden /> Reset</Button>
    </div>
    <div className="mt-2 grid gap-2 border-t border-border pt-2 sm:grid-cols-3 lg:max-w-[620px]">
      <FilterSelect label="Ranking date" value={values.date} onChange={(value) => onChange("date", value)} options={data.dates.map(option)} />
      {data.comparisonAvailable ? <FilterSelect label="Compare with" value={values.comparison} onChange={(value) => onChange("comparison", value)} options={data.comparisonPeriods.map(option)} /> : null}
      <FilterSelect label="Result type" value={values.resultType} onChange={(value) => onChange("resultType", value)} options={data.resultTypes.map((item) => ({ value: item, label: item === "local_finder" ? "Local Finder" : "Google" }))} />
    </div>
  </section>;
}
function option(value: string) { return { value, label: value }; }
function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange} disabled={options.length === 0}><SelectTrigger aria-label={label} className="w-full bg-background"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger><SelectContent>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>;
}

export function CompetitorRankingsTable({ data, sort, order, page, pageCount, onSort, onPageChange, onClearFilters, onRetry }: { data: CompetitorRankingsData; sort: CompetitorRankingSort; order: CompetitorRankingOrder; page: number; pageCount: number; onSort: (sort: CompetitorRankingSort) => void; onPageChange: (page: number) => void; onClearFilters: () => void; onRetry: () => void }) {
  if (data.status === "loading") return <CompetitorRankingsLoading />;
  if (data.status === "error") return <ErrorState title="Competitor rankings could not be loaded" description="The location workspace is still available. Retry this comparison without leaving the page." onRetry={onRetry} className="min-h-80" />;
  if (data.status === "no_competitors") return <EmptyState title="No tracked competitors yet" description="Competitors must be configured before their keyword positions can be compared with this location. No competitor ranking data is currently available." className="min-h-80" />;
  if (data.status === "no_data") return <EmptyState title="Competitor ranking data has not been collected" description="Tracked competitors exist, but no comparable keyword positions are available for the selected ranking date." className="min-h-80" />;
  return <section aria-labelledby="comparison-table-title" className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 id="comparison-table-title" className="text-sm font-semibold text-foreground">Keyword ranking comparison</h2><p className="mt-0.5 text-xs text-muted-foreground">{data.total.toLocaleString()} keywords · selected location shown first</p></div></div>
    <div role="region" aria-label="Keyword ranking comparison" tabIndex={0} className="data-grid-scroll relative w-full min-w-0 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"><table className="w-full border-collapse text-left text-sm" style={{ minWidth: 560 + data.competitors.length * 170 }}><thead className="bg-surface-strong"><tr className="border-b border-border"><SortableHeader label="Keyword" value="keyword" active={sort} order={order} onSort={onSort} className="sticky left-0 z-20 min-w-[240px] bg-surface-strong" /><SortableHeader label={data.locationName ?? "Selected location"} value="location" active={sort} order={order} onSort={onSort} className="min-w-[180px] border-l border-primary/20 bg-accent" />{data.competitors.map((competitor) => <th key={competitor.id} className="min-w-[170px] px-4 py-3 text-xs font-medium text-muted-foreground">{competitor.name}</th>)}<SortableHeader label="Closest gap" value="gap" active={sort} order={order} onSort={onSort} className="min-w-[140px]" /></tr></thead><tbody className="divide-y divide-border">{data.rows.map((row) => <ComparisonRow key={row.id} row={row} competitors={data.competitors} />)}{data.rows.length === 0 ? <tr><td colSpan={data.competitors.length + 3} className="p-4"><EmptyState title="No ranking comparisons match these filters" description="Clear the current filters to return to all available keyword comparisons." action={<Button variant="outline" size="sm" onClick={onClearFilters}>Clear filters</Button>} className="border-0 py-14 shadow-none" /></td></tr> : null}</tbody></table></div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border bg-surface-strong px-4 py-3"><p className="truncate text-xs text-muted-foreground">Page {page} of {pageCount}</p><div className="flex gap-1"><Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft aria-hidden /></Button><Button variant="outline" size="icon" className="size-8" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight aria-hidden /></Button></div></div>
  </section>;
}

function SortableHeader({ label, value, active, order, onSort, className }: { label: string; value: CompetitorRankingSort; active: CompetitorRankingSort; order: CompetitorRankingOrder; onSort: (value: CompetitorRankingSort) => void; className?: string }) {
  const Icon = order === "asc" ? ArrowUp : ArrowDown;
  return <th className={cn("px-4 py-3", className)}><Button variant="ghost" size="sm" onClick={() => onSort(value)} className="-ml-3 h-7 max-w-full px-3 text-xs font-medium text-muted-foreground">{label}{active === value ? <Icon className="size-3" aria-hidden /> : null}</Button></th>;
}
function ComparisonRow({ row, competitors }: { row: CompetitorRankingRow; competitors: CompetitorRankingsData["competitors"] }) {
  const rankedCompetitors = row.competitorPositions.filter((item) => item.currentPosition !== null);
  const bestCompetitor = rankedCompetitors.sort((a, b) => (a.currentPosition ?? Infinity) - (b.currentPosition ?? Infinity))[0];
  const gap = row.locationPosition !== null && bestCompetitor?.currentPosition !== null && bestCompetitor?.currentPosition !== undefined ? row.locationPosition - bestCompetitor.currentPosition : null;
  return <tr className="hover:bg-muted/35"><td className="sticky left-0 z-10 bg-surface px-4 py-3"><p className="font-medium text-foreground">{row.keyword}</p><p className="text-xs text-muted-foreground">{row.group ?? "Ungrouped"}</p></td><td className="border-l border-primary/20 bg-accent/45 px-4 py-3"><Position value={row.locationPosition} movement={row.locationMovement} status={row.locationMovementStatus} /></td>{competitors.map((competitor) => <td key={competitor.id} className="px-4 py-3"><CompetitorCell position={row.competitorPositions.find((item) => item.competitorId === competitor.id)} /></td>)}<td className="px-4 py-3">{gap === null ? <span className="text-xs text-muted-foreground">No comparison</span> : gap > 0 ? <StatusBadge tone="critical">Outranked by {gap}</StatusBadge> : gap < 0 ? <StatusBadge tone="success">Leads by {Math.abs(gap)}</StatusBadge> : <StatusBadge>Level</StatusBadge>}</td></tr>;
}
function CompetitorCell({ position }: { position: CompetitorPosition | undefined }) { return position ? <Position value={position.currentPosition} movement={position.movement} status={position.movementStatus} /> : <span className="text-muted-foreground">—</span>; }
function Position({ value, movement, status }: { value: number | null; movement: number | null; status: CompetitorPosition["movementStatus"] }) { return <div className="flex items-center gap-2"><span className="font-semibold tabular text-foreground">{value ?? "—"}</span>{movement !== null && movement !== 0 ? <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular", status === "improved" ? "text-success" : "text-critical")}>{status === "improved" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}<span className="sr-only">{status === "improved" ? "Improved by " : "Dropped by "}</span>{Math.abs(movement)}</span> : null}</div>; }
export function CompetitorRankingsLoading() { return <div role="status" aria-live="polite" className="space-y-4" aria-label="Loading competitor rankings"><FilterBarSkeleton fields={5} /><TableSkeleton rows={8} columns={6} /></div>; }
function SkeletonBlock() { return <div><div className="mb-2 h-3 w-20 animate-pulse rounded bg-muted" /><div className="h-9 w-full animate-pulse rounded bg-muted" /></div>; }