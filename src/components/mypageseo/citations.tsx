import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, ExternalLink, Info } from "lucide-react";
import { MetricCard, Panel, SectionHeader, StatusBadge, type StatusTone } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CITATIONS_PAGE_SIZE,
  CITATION_CAMPAIGN_LABEL,
  CITATION_STATE_LABEL,
  type Citation,
  type CitationState,
  type CitationsData,
} from "@/lib/mypageseo/citations";
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
} from "@/components/mypageseo/table";
import { NoCitationsEmpty, NoResultsEmpty } from "@/components/mypageseo/empty-states";

const stateTone: Record<CitationState, StatusTone> = {
  correct: "success",
  inconsistent: "warning",
  missing: "critical",
  duplicate: "critical",
  pending: "info",
  unknown: "neutral",
};

export function CitationsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading citations">
      <MetricSkeletonGrid count={5} />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

type SortKey = "directory" | "state" | "authority" | "lastChecked";

export function CitationsContent({ data, locationId, onRetry }: { data: CitationsData; locationId: string; onRetry: () => void }) {
  const [state, setState] = useState<"all" | CitationState>("all");
  const [directoryType, setDirectoryType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("directory");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Citation | null>(null);

  const types = useMemo(
    () => Array.from(new Set(data.citations.map((item) => item.directoryType).filter((value): value is string => Boolean(value)))),
    [data.citations],
  );

  const filtered = useMemo(() => {
    const rows = data.citations.filter((citation) => {
      if (state !== "all" && citation.state !== state) return false;
      if (directoryType !== "all" && citation.directoryType !== directoryType) return false;
      if (data.capabilities.canSearch && search.trim()) {
        if (!citation.directory.toLowerCase().includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      const direction = descending ? -1 : 1;
      if (sort === "authority") return ((a.authority ?? -1) - (b.authority ?? -1)) * direction;
      if (sort === "state") return a.state.localeCompare(b.state) * direction;
      if (sort === "lastChecked") return (a.lastChecked ?? "").localeCompare(b.lastChecked ?? "") * direction;
      return a.directory.localeCompare(b.directory) * direction;
    });
  }, [data.citations, data.capabilities.canSearch, state, directoryType, search, sort, descending]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CITATIONS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * CITATIONS_PAGE_SIZE, current * CITATIONS_PAGE_SIZE);
  const hasFilters = state !== "all" || directoryType !== "all" || search.trim() !== "";

  if (data.status === "loading") return <CitationsLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Citation data could not be loaded"
        description="We couldn't load citation information for this location. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "not_scanned" || data.citations.length === 0) {
    return (
      <div className="space-y-6">
        <CitationsSummaryBand data={data} />
        <NoCitationsEmpty
          className="min-h-64"
          {...(data.capabilities.canScan ? { action: <Button size="sm">Run citation scan</Button> } : {})}
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
      <CitationsSummaryBand data={data} />

      {data.issues.length > 0 ? (
        <Panel title="Citation issues" description="Problems detected in the most recent scan">
          <ul className="divide-y divide-border">
            {data.issues.map((issue) => {
              const Icon = issue.severity === "critical" ? AlertCircle : issue.severity === "warning" ? AlertTriangle : Info;
              return (
                <li key={issue.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", issue.severity === "critical" ? "text-critical" : issue.severity === "warning" ? "text-warning" : "text-info")} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{issue.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{issue.detail}</p>
                  </div>
                  {issue.citationId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(data.citations.find((item) => item.id === issue.citationId) ?? null)}
                    >
                      Review listing
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={state} onValueChange={(value) => { setState(value as CitationState | "all"); setPage(1); }}>
            <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Citation status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["correct", "inconsistent", "missing", "duplicate", "pending"] as CitationState[]).map((value) => (
                <SelectItem key={value} value={value}>{CITATION_STATE_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {types.length > 0 ? (
            <Select value={directoryType} onValueChange={(value) => { setDirectoryType(value); setPage(1); }}>
              <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Directory type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directory types</SelectItem>
                {types.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={!hasFilters}
            onClick={() => { setState("all"); setDirectoryType("all"); setSearch(""); setPage(1); }}
          >
            <RotateCcw aria-hidden /> Reset
          </Button>
        </div>
        {data.capabilities.canSearch ? (
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search directories"
            aria-label="Search directories"
            className="h-9 w-full text-sm lg:w-64"
          />
        ) : null}
      </div>

      <Panel title="Directory listings" description={`${filtered.length.toLocaleString()} of ${data.citations.length.toLocaleString()} listings`}>
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No listings match the current filters.</p>
        ) : (
          <div className="-mx-4">
            <TableScroll minWidth={1040} label="Citations">
              <TableHead>
                <SortableTh label="Directory" value="directory" active={sort} order={order} onSort={toggleSort} className="min-w-[200px]" />
                <Th>Type</Th>
                <SortableTh label="Status" value="state" active={sort} order={order} onSort={toggleSort} />
                <Th className="min-w-[220px]">NAP</Th>
                <SortableTh label="Authority" value="authority" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Last checked" value="lastChecked" active={sort} order={order} onSort={toggleSort} />
                <Th align="right">Actions</Th>
              </TableHead>
              <TableBody>
                {visible.map((citation) => (
                  <TableRow key={citation.id}>
                    <td className={tdClass}>
                      <span className="font-medium text-foreground">{citation.directory}</span>
                      {citation.priority ? <span className="ml-2 text-xs text-muted-foreground">{citation.priority} priority</span> : null}
                    </td>
                    <td className={tdMutedClass}>{citation.directoryType ?? "—"}</td>
                    <td className={tdClass}>
                      <StatusBadge tone={stateTone[citation.state]}>{CITATION_STATE_LABEL[citation.state]}</StatusBadge>
                      {citation.campaignState ? <span className="ml-2 text-xs text-muted-foreground">{CITATION_CAMPAIGN_LABEL[citation.campaignState]}</span> : null}
                    </td>
                    <td className={cn(tdMutedClass, "max-w-[260px] truncate")}>
                      {[citation.nap.name, citation.nap.address, citation.nap.phone].filter(Boolean).join(" · ") || "Unavailable"}
                    </td>
                    <td className={cn(tdClass, "tabular")}>{citation.authority ?? "—"}</td>
                    <td className={tdMutedClass}>{citation.lastChecked ?? "—"}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(citation)}>Preview</Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/locations/${locationId}/citations/${citation.id}`}>Details</Link>
                        </Button>
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
              pageSize={CITATIONS_PAGE_SIZE}
              itemLabel="listings"
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </Panel>

      <CitationDetail citation={selected} data={data} onClose={() => setSelected(null)} />
    </div>
  );
}


function CitationsSummaryBand({ data }: { data: CitationsData }) {
  const { summary } = data;
  const value = (input: number | null) => (input === null ? "—" : input.toLocaleString());
  return (
    <section aria-labelledby="citations-summary">
      <SectionHeader title="Citation health" description="Coverage and consistency across checked directories" />
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border">
        <MetricCard accent="brand" label="Checked" value={value(summary.checked)} caption={summary.checked === null ? "Not scanned yet" : "Directories checked"} />
        <MetricCard accent="green" label="Correct" value={value(summary.correct)} caption={summary.correct === null ? "Unavailable" : "Consistent listings"} />
        <MetricCard accent="amber" label="Inconsistent" value={value(summary.inconsistent)} caption={summary.inconsistent === null ? "Unavailable" : "NAP mismatches"} />
        <MetricCard accent="red" label="Missing" value={value(summary.missing)} caption={summary.missing === null ? "Unavailable" : "Listings not found"} />
        <MetricCard accent="clay" label="Duplicates" value={value(summary.duplicate)} caption={summary.recentlyChanged === null ? "Unavailable" : `${summary.recentlyChanged} recently changed`} />
      </div>
    </section>
  );
}

function CitationDetail({ citation, data, onClose }: { citation: Citation | null; data: CitationsData; onClose: () => void }) {
  return (
    <Sheet open={citation !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {citation ? (
          <>
            <SheetHeader>
              <SheetTitle>{citation.directory}</SheetTitle>
              <SheetDescription>{citation.directoryType ?? "Directory type unavailable"}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={stateTone[citation.state]}>{CITATION_STATE_LABEL[citation.state]}</StatusBadge>
                {citation.campaignState ? <StatusBadge tone="info">{CITATION_CAMPAIGN_LABEL[citation.campaignState]}</StatusBadge> : null}
                <span className="text-xs text-muted-foreground">{citation.lastChecked ? `Last checked ${citation.lastChecked}` : "Last checked unavailable"}</span>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Listing information</p>
                <dl className="mt-2 divide-y divide-border">
                  {([["Name", citation.nap.name], ["Address", citation.nap.address], ["Phone", citation.nap.phone], ["Website", citation.nap.website]] as const).map(([label, item]) => (
                    <div key={label} className="grid gap-1 py-2 sm:grid-cols-[100px_1fr]">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-sm text-foreground">{item ?? "Unavailable"}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Detected discrepancies</p>
                {citation.discrepancies.length === 0 ? (
                  <p className="mt-1.5 text-sm text-muted-foreground">No discrepancies were reported for this listing.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {citation.discrepancies.map((item) => (
                      <li key={item.field} className="rounded-md border border-border p-2.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.field}</p>
                        <p className="mt-1 text-sm text-foreground">Found: {item.found ?? "Unavailable"}</p>
                        <p className="text-sm text-muted-foreground">Expected: {item.expected ?? "Unavailable"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {citation.listingUrl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={citation.listingUrl} target="_blank" rel="noreferrer">Open listing <ExternalLink className="size-3.5" aria-hidden /></a>
                  </Button>
                ) : null}
                {data.capabilities.canFixListing ? <Button variant="accent" size="sm">Request correction</Button> : null}
                {data.capabilities.canRunCampaign ? <Button size="sm">Add to campaign</Button> : null}
              </div>

              {!data.capabilities.canFixListing && !data.capabilities.canRunCampaign ? (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Citation correction and campaign submission are not available in the current product integration, so this listing can only be reviewed here.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
