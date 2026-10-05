import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { MetricCard, Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  COMPETITORS_PAGE_SIZE,
  COMPETITOR_SOURCE_LABEL,
  type CompetitorRow,
  type CompetitorsData,
} from "@/lib/competitors/competitors";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import {
  SortableTh,
  TableBody,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  tdMutedClass,
} from "@/components/layout/shared/data-table";
import { NoCompetitorsEmpty } from "@/components/layout/shared/feedback/empty-states";

export function CompetitorsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading competitors">
      <MetricSkeletonGrid count={4} />
      <TableSkeleton rows={8} columns={7} />
    </div>
  );
}

type SortKey = "businessName" | "averagePosition" | "visibility" | "reviewCount" | "rating" | "citationCoverage" | "gbpHealth";

const numberOrDash = (value: number | null, suffix = "") => (value === null ? "—" : `${value.toLocaleString()}${suffix}`);

export function CompetitorsContent({ data, locationId, onRetry }: { data: CompetitorsData; locationId: string; onRetry: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<SortKey>("averagePosition");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CompetitorRow | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(data.competitors.map((item) => item.category).filter((value): value is string => Boolean(value)))),
    [data.competitors],
  );
  const hasSourceInfo = useMemo(() => data.competitors.some((item) => item.source !== null), [data.competitors]);

  const filtered = useMemo(() => {
    const rows = data.competitors.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (source !== "all" && row.source !== source) return false;
      if (data.capabilities.canSearch && search.trim()) {
        if (!row.businessName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      // Keep the selected business pinned at the top for comparison.
      if (a.isSelectedBusiness !== b.isSelectedBusiness) return a.isSelectedBusiness ? -1 : 1;
      const direction = descending ? -1 : 1;
      if (sort === "businessName") return a.businessName.localeCompare(b.businessName) * direction;
      const left = a[sort] ?? Number.POSITIVE_INFINITY;
      const right = b[sort] ?? Number.POSITIVE_INFINITY;
      return (Number(left) - Number(right)) * direction;
    });
  }, [data.competitors, data.capabilities.canSearch, category, source, search, sort, descending]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / COMPETITORS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * COMPETITORS_PAGE_SIZE, current * COMPETITORS_PAGE_SIZE);
  const hasFilters = category !== "all" || source !== "all" || search.trim() !== "";

  if (data.status === "loading") return <CompetitorsLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Competitor data could not be loaded"
        description="We couldn't load competitor information for this location. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "no_competitors" || data.competitors.length === 0) {
    return (
      <div className="space-y-6">
        <CompetitorsSummaryBand data={data} />
        <NoCompetitorsEmpty
          className="min-h-64"
          {...(data.capabilities.canTrackCompetitors ? { action: <Button size="sm">Add competitor</Button> } : {})}
        />
      </div>
    );
  }

  const order = descending ? "desc" : "asc";

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDescending((value) => !value);
    else { setSort(key); setDescending(false); }
  };

  return (
    <div className="space-y-6">
      <CompetitorsSummaryBand data={data} />

      {data.insights.length > 0 ? (
        <Panel title="Competitive observations" description="Differences visible in the available competitor data">
          <ul className="divide-y divide-border">
            {data.insights.map((insight) => (
              <li key={insight.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    insight.tone === "gap" ? "bg-critical" : insight.tone === "advantage" ? "bg-success" : "bg-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{insight.detail}</p>
                </div>
                {insight.competitorId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(data.competitors.find((item) => item.id === insight.competitorId) ?? null)}
                  >
                    View competitor
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {data.capabilities.canFilterByCategory && categories.length > 0 ? (
            <Select value={category} onValueChange={(value) => { setCategory(value); setPage(1); }}>
              <SelectTrigger className="h-9 w-[190px] text-xs" aria-label="Primary category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {hasSourceInfo ? (
            <Select value={source} onValueChange={(value) => { setSource(value); setPage(1); }}>
              <SelectTrigger className="h-9 w-[210px] text-xs" aria-label="Competitor source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All competitors</SelectItem>
                <SelectItem value="tracked">Manually tracked</SelectItem>
                <SelectItem value="discovered">Discovered from local search</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={!hasFilters}
            onClick={() => { setCategory("all"); setSource("all"); setSearch(""); setPage(1); }}
          >
            <RotateCcw aria-hidden /> Reset
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {data.capabilities.canSearch ? (
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search competitors"
              aria-label="Search competitors"
              className="h-9 w-full text-sm lg:w-64"
            />
          ) : null}
          {data.capabilities.canTrackCompetitors ? <Button size="sm">Add competitor</Button> : null}
        </div>
      </div>

      <Panel
        title="Competitor comparison"
        description={`${filtered.length.toLocaleString()} of ${data.competitors.length.toLocaleString()} businesses`}
      >
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No competitors match the current filters.</p>
        ) : (
          <div className="-mx-4">
            <TableScroll minWidth={980} label="Competitors">
              <TableHead>
                <SortableTh label="Business" value="businessName" active={sort} order={order} onSort={toggleSort} className="min-w-[220px]" />
                <Th>Category</Th>
                <Th>Area</Th>
                <SortableTh label="Avg. position" value="averagePosition" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Visibility" value="visibility" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Reviews" value="reviewCount" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Rating" value="rating" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Citations" value="citationCoverage" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="GBP" value="gbpHealth" active={sort} order={order} onSort={toggleSort} />
                <Th align="right">Actions</Th>
              </TableHead>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id} className={cn(row.isSelectedBusiness && "bg-brand-tint/40")}>
                    <td className={tdClass}>
                      <span className="font-medium text-foreground">{row.businessName}</span>
                      {row.isSelectedBusiness ? <StatusBadge tone="info" className="ml-2">Your business</StatusBadge> : null}
                      {row.source ? <span className="ml-2 text-xs text-muted-foreground">{COMPETITOR_SOURCE_LABEL[row.source]}</span> : null}
                    </td>
                    <td className={tdMutedClass}>{row.category ?? "—"}</td>
                    <td className={tdMutedClass}>{row.area ?? "—"}</td>
                    <td className={cn(tdClass, "tabular")}>{numberOrDash(row.averagePosition)}</td>
                    <td className={cn(tdClass, "tabular")}>{numberOrDash(row.visibility, "%")}</td>
                    <td className={cn(tdClass, "tabular")}>{numberOrDash(row.reviewCount)}</td>
                    <td className={cn(tdClass, "tabular")}>{row.rating === null ? "—" : row.rating.toFixed(1)}</td>
                    <td className={cn(tdClass, "tabular")}>{numberOrDash(row.citationCoverage, "%")}</td>
                    <td className={cn(tdClass, "tabular")}>{numberOrDash(row.gbpHealth)}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>Preview</Button>
                        {!row.isSelectedBusiness && data.capabilities.hasDetailView ? (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/locations/${locationId}/competitors/${row.id}`}>Analysis</Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
          </div>
        )}

        {visible.length > 0 ? (
          <div className="-mx-4 -mb-4 mt-4">
            <TablePagination
              page={current}
              pageCount={totalPages}
              totalItems={filtered.length}
              pageSize={COMPETITORS_PAGE_SIZE}
              itemLabel="competitors"
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </Panel>

      <CompetitorDetail competitor={selected} data={data} onClose={() => setSelected(null)} />
    </div>
  );
}


function CompetitorsSummaryBand({ data }: { data: CompetitorsData }) {
  const { summary } = data;
  return (
    <section aria-labelledby="competitors-summary">
      <SectionHeader title="Competitive position" description="How this location compares with the competitors available to the workspace" />
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard
          accent="brand"
          label="Tracked competitors"
          value={numberOrDash(summary.trackedCompetitors)}
          caption={summary.trackedCompetitors === null ? "No competitor data" : "Businesses compared"}
        />
        <MetricCard
          accent="clay"
          label="Your average position"
          value={numberOrDash(summary.yourAveragePosition)}
          caption={summary.yourAveragePosition === null ? "Unavailable" : "Across tracked keywords"}
        />
        <MetricCard
          accent="amber"
          label="Competitor average position"
          value={numberOrDash(summary.averageCompetitorPosition)}
          caption={summary.averageCompetitorPosition === null ? "Unavailable" : "Lower is better"}
        />
        <MetricCard
          accent="green"
          label="Review comparison"
          value={numberOrDash(summary.yourReviewCount)}
          caption={
            summary.averageCompetitorReviewCount === null
              ? "Unavailable"
              : `Competitor average ${summary.averageCompetitorReviewCount.toLocaleString()}`
          }
        />
      </div>
    </section>
  );
}

function CompetitorDetail({ competitor, data, onClose }: { competitor: CompetitorRow | null; data: CompetitorsData; onClose: () => void }) {
  return (
    <Sheet open={competitor !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {competitor ? (
          <>
            <SheetHeader>
              <SheetTitle>{competitor.businessName}</SheetTitle>
              <SheetDescription>{competitor.category ?? "Primary category unavailable"}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {competitor.isSelectedBusiness ? <StatusBadge tone="info">Your business</StatusBadge> : null}
                {competitor.source ? <StatusBadge tone="neutral">{COMPETITOR_SOURCE_LABEL[competitor.source]}</StatusBadge> : null}
                <span className="text-xs text-muted-foreground">{competitor.area ?? "Service area unavailable"}</span>
              </div>

              <dl className="divide-y divide-border">
                {([
                  ["Average position", numberOrDash(competitor.averagePosition)],
                  ["Visibility", numberOrDash(competitor.visibility, "%")],
                  ["Reviews", numberOrDash(competitor.reviewCount)],
                  ["Rating", competitor.rating === null ? "—" : competitor.rating.toFixed(1)],
                  ["Citation coverage", numberOrDash(competitor.citationCoverage, "%")],
                  ["GBP health", numberOrDash(competitor.gbpHealth)],
                ] as const).map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-2 sm:grid-cols-[150px_1fr]">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>

              {data.capabilities.canRemoveCompetitors ? (
                <Button variant="accent" size="sm">Stop tracking competitor</Button>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Competitor tracking management is not available in the current product integration, so competitors can only be reviewed here.
                </p>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
