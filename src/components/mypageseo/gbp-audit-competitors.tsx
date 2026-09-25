import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, StatusBadge } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GbpAuditCompetitorEntity, GbpAuditCompetitorOrder, GbpAuditCompetitorSort, GbpAuditCompetitorsData } from "@/lib/mypageseo/gbp-audit-competitors";
import { cn } from "@/lib/utils";

const headers: Array<{ key: GbpAuditCompetitorSort; label: string }> = [
  { key: "local_pack_position", label: "Local Pack" },
  { key: "reviews", label: "Reviews" },
  { key: "rating", label: "Rating" },
  { key: "citations", label: "Citations" },
  { key: "photos", label: "Photos" },
  { key: "authority", label: "Website authority" },
];

export function GbpAuditCompetitorsLoading() {
  return <div role="status" aria-live="polite" className="space-y-5" aria-label="Loading GBP audit competitor analysis"><MetricSkeletonGrid count={4} /><TableSkeleton rows={6} columns={8} /></div>;
}

export function GbpAuditCompetitorsContent({ data, locationId, sort, order, onSort, onContextChange, onRetry }: { data: GbpAuditCompetitorsData; locationId: string; sort: GbpAuditCompetitorSort; order: GbpAuditCompetitorOrder; onSort: (sort: GbpAuditCompetitorSort) => void; onContextChange: (contextId: string) => void; onRetry: () => void }) {
  if (data.status === "loading") return <GbpAuditCompetitorsLoading />;
  if (data.status === "error") return <ErrorState title="Competitor analysis could not be loaded" description="The selected location is still available. Retry this analysis without leaving the GBP audit." onRetry={onRetry} className="min-h-80" />;
  if (data.status === "disconnected") return <EmptyState title="Connect Google Business Profile to compare competitors" description="This analysis requires a connected profile and supported local competitor data. Neither is currently available for this location." className="min-h-80" />;
  if (data.status === "no_competitors") return <EmptyState title="No audit competitors are available" description="Mypageseo does not currently have backend-provided Local Pack competitors or a supported discovery action for this location, so no comparison can be shown." action={<Button asChild variant="outline"><Link to={`/locations/${locationId}/rankings/competitors`}>Open ranking competitors <ExternalLink aria-hidden /></Link></Button>} className="min-h-80" />;
  if (data.status === "no_data") return <EmptyState title="No comparable competitor data is available" description="Competitors may exist, but no supported GBP or local SEO metrics are available for this search context." className="min-h-80" />;

  return <div className="space-y-6">
    {data.status === "partial" ? <div className="flex items-start gap-3 rounded-md border border-warning/35 bg-warning-surface px-4 py-3"><StatusBadge tone="warning">Partial data</StatusBadge><p className="text-sm text-warning-foreground">Only metrics returned by the current analysis are shown. Blank cells were not estimated.</p></div> : null}
    {data.contexts.length > 1 ? <section aria-label="Search context" className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-foreground">Search context</h2><p className="text-xs text-muted-foreground">The tracked search used to identify this comparison set.</p></div><Select {...(data.selectedContextId ? { value: data.selectedContextId } : {})} onValueChange={onContextChange}><SelectTrigger className="w-full bg-background sm:w-72" aria-label="Search context"><SelectValue placeholder="Select a search context" /></SelectTrigger><SelectContent>{data.contexts.map((context) => <SelectItem key={context.id} value={context.id}>{context.label}</SelectItem>)}</SelectContent></Select></section> : data.searchContext ? <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border pb-3 text-xs text-muted-foreground"><span>Keyword: <strong className="font-medium text-foreground">{data.searchContext.keyword ?? "Unavailable"}</strong></span><span>Area: <strong className="font-medium text-foreground">{data.searchContext.area ?? "Unavailable"}</strong></span><span>Result: <strong className="font-medium text-foreground">{data.searchContext.resultType ?? "Unavailable"}</strong></span></div> : null}

    <section aria-labelledby="audit-competitor-table" className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3"><h2 id="audit-competitor-table" className="text-sm font-semibold text-foreground">GBP and local signal comparison</h2><p className="text-xs text-muted-foreground">Selected location is shown first. Missing metrics remain unavailable.</p></div>
      <div role="region" aria-label="Competitor profile comparison" tabIndex={0} className="data-grid-scroll relative w-full min-w-0 max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"><table className="w-full border-collapse text-left text-sm" style={{ minWidth: 480 + headers.length * 150 }}><thead className="bg-surface-strong"><tr className="border-b border-border"><SortableHeader label="Business" value="name" active={sort} order={order} onSort={onSort} className="sticky left-0 z-20 min-w-60 bg-surface-strong" />{headers.map((header) => <SortableHeader key={header.key} label={header.label} value={header.key} active={sort} order={order} onSort={onSort} />)}<th className="min-w-48 px-4 py-3 text-xs font-medium text-muted-foreground">Primary category</th></tr></thead><tbody className="divide-y divide-border">{data.entities.map((entity) => <ComparisonRow key={entity.id} entity={entity} />)}</tbody></table></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Competitive gaps" description="Observed differences from available comparison data">{data.findings.length === 0 ? <p className="text-sm text-muted-foreground">No measurable competitive gaps are available for this analysis.</p> : <ul className="divide-y divide-border">{data.findings.map((finding) => <li key={finding.id} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-semibold text-foreground">{finding.title}</p><p className="mt-1 text-sm text-muted-foreground">{finding.observation}</p><p className="mt-1 text-xs text-muted-foreground">Your location: {finding.locationValue} · {finding.competitorName}: {finding.competitorValue}</p></li>)}</ul>}</Panel>
      <Panel title="Ranking context" description="Concise keyword evidence from this audit comparison" actions={<Button asChild variant="outline" size="sm"><Link to={`/locations/${locationId}/rankings/competitors`}>Full ranking analysis <ExternalLink aria-hidden /></Link></Button>}>{data.rankingComparison.length === 0 ? <p className="text-sm text-muted-foreground">No keyword ranking comparison is available for this audit.</p> : <div className="divide-y divide-border">{data.rankingComparison.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{row.keyword}</p><p className="text-xs text-muted-foreground">{row.businessName} · {row.resultType ?? "Result type unavailable"}</p></div><span className="font-semibold tabular text-foreground">{row.currentPosition ?? "—"}</span></div>)}</div>}</Panel>
    </div>
  </div>;
}

function SortableHeader({ label, value, active, order, onSort, className }: { label: string; value: GbpAuditCompetitorSort; active: GbpAuditCompetitorSort; order: GbpAuditCompetitorOrder; onSort: (value: GbpAuditCompetitorSort) => void; className?: string }) {
  const Icon = order === "asc" ? ArrowUp : ArrowDown;
  return <th className={cn("min-w-32 px-4 py-3", className)}><Button variant="ghost" size="sm" onClick={() => onSort(value)} className="-ml-3 h-7 px-3 text-xs font-medium text-muted-foreground">{label}{active === value ? <Icon className="size-3" aria-hidden /> : null}</Button></th>;
}

function ComparisonRow({ entity }: { entity: GbpAuditCompetitorEntity }) {
  return <tr className={cn("hover:bg-muted/35", entity.isSelectedLocation && "bg-accent/45")}><td className={cn("sticky left-0 z-10 px-4 py-3", entity.isSelectedLocation ? "bg-accent" : "bg-surface")}><div className="flex items-center gap-2"><span className="font-medium text-foreground">{entity.name}</span>{entity.isSelectedLocation ? <StatusBadge tone="info">Your location</StatusBadge> : null}</div></td><MetricCell value={entity.localPackPosition.value} /><MetricCell value={entity.reviewCount.value} /><MetricCell value={entity.starRating.value} /><MetricCell value={entity.citations.value} /><MetricCell value={entity.photos.value} /><MetricCell value={entity.websiteAuthority.value} /><td className="px-4 py-3 text-foreground">{entity.primaryCategory ?? <Unavailable />}</td></tr>;
}

function MetricCell({ value }: { value: number | string | null }) { return <td className="px-4 py-3 font-medium tabular text-foreground">{value ?? <Unavailable />}</td>; }
function Unavailable() { return <span className="font-normal text-muted-foreground"><span className="sr-only">Unavailable</span><span aria-hidden>—</span></span>; }