import { useState } from "react";
import { ArrowRight, ExternalLink, History, ListChecks } from "lucide-react";
import type { CitationChange, CitationRow, CitationStatus, CitationsResponse } from "@/api";
import { MetricCard, Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/layout/shared/feedback/states";
import {
  MobileListRow,
  TableBody,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  tdMutedClass,
} from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CITATION_STATUS_LABEL,
  CITATION_STATUS_ORDER,
  CITATION_STATUS_SHORT,
  CITATION_STATUS_TONE,
  coverageText,
  napIssueText,
} from "@/lib/citations/citations";
import { useCitationChanges } from "@/lib/citations/use-citations";
import { formatDate, formatShortDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

const HISTORY_PAGE_SIZE = 25;

export function CitationsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading citations">
      <MetricSkeletonGrid count={4} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

export function CitationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Citation data could not be loaded"
      description="We couldn't load citation information for this location. Try again without leaving the page."
      onRetry={onRetry}
    />
  );
}

/** Before the citation list exists: the team sets it up when onboarding completes. */
export function CitationsSettingUp() {
  return (
    <EmptyState
      icon={ListChecks}
      title="Our team is setting up your citation tracking"
      description="The MyPageSEO team picks the directories that fit your business and checks each listing by hand. Results show here as soon as the first listings are checked."
      className="min-h-64"
    />
  );
}

/**
 * The Citations page for one location (`GET locations/:id/citations`). Read-only: the
 * MyPageSEO team checks every listing, so there are no add, edit or "check now" actions.
 */
export function CitationsContent({ data, locationId }: { data: Extract<CitationsResponse, { available: true }>; locationId: string }) {
  const [status, setStatus] = useState<CitationStatus | "all">("all");
  const [historyOpen, setHistoryOpen] = useState(false);

  const rows = status === "all" ? data.citations : data.citations.filter((row) => row.status === status);
  const chips = CITATION_STATUS_ORDER.filter((value) => value !== "removed" || data.counts.removed > 0);

  return (
    <div className="space-y-6">
      <HealthBand data={data} />

      <Panel
        title="Directory listings"
        description="Checked by hand by the MyPageSEO team. Problems are listed first."
      >
        <div role="group" aria-label="Filter by status" className="-mt-1 mb-4 flex flex-wrap gap-2">
          <StatusChip label="All" count={data.health.total} active={status === "all"} onClick={() => setStatus("all")} />
          {chips.map((value) => (
            <StatusChip
              key={value}
              label={CITATION_STATUS_SHORT[value]}
              count={data.counts[value] ?? 0}
              active={status === value}
              onClick={() => setStatus(status === value ? "all" : value)}
            />
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No listings with this status.</p>
        ) : (
          <>
            <div className="-mx-4 hidden md:block">
              <TableScroll minWidth={900} label="Citations">
                <TableHead>
                  <Th className="min-w-[200px]">Directory</Th>
                  <Th>Status</Th>
                  <Th className="min-w-[280px]">Name, address and phone</Th>
                  <Th>Listing</Th>
                  <Th>Last checked</Th>
                </TableHead>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={`${row.directory.name}-${index}`}>
                      <td className={tdClass}>
                        <DirectoryName row={row} />
                      </td>
                      <td className={tdClass}>
                        <StatusBadge tone={CITATION_STATUS_TONE[row.status]}>{CITATION_STATUS_LABEL[row.status]}</StatusBadge>
                      </td>
                      <td className={cn(tdClass, "max-w-[360px]")}>
                        <NapIssues row={row} />
                      </td>
                      <td className={tdClass}>
                        <ListingLink row={row} />
                      </td>
                      <td className={tdMutedClass}>{formatDate(row.last_checked_at, "Not checked yet")}</td>
                    </TableRow>
                  ))}
                </TableBody>
              </TableScroll>
            </div>

            <div className="-mx-4 divide-y divide-border border-t border-border md:hidden">
              {rows.map((row, index) => (
                <MobileListRow key={`${row.directory.name}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <DirectoryName row={row} />
                    <StatusBadge tone={CITATION_STATUS_TONE[row.status]}>{CITATION_STATUS_SHORT[row.status]}</StatusBadge>
                  </div>
                  <div className="mt-2">
                    <NapIssues row={row} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Last checked {formatDate(row.last_checked_at, "—")}</span>
                    <ListingLink row={row} />
                  </div>
                </MobileListRow>
              ))}
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Recent changes"
        description="What the MyPageSEO team found or updated"
        actions={
          data.recent_changes.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden /> Full history
            </Button>
          ) : undefined
        }
      >
        {data.recent_changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <ChangeList changes={data.recent_changes} />
        )}
      </Panel>

      {historyOpen ? <HistoryDialog locationId={locationId} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  );
}

function HealthBand({ data }: { data: Extract<CitationsResponse, { available: true }> }) {
  const { health, counts } = data;
  const scored = health.score != null;
  return (
    <section aria-labelledby="citation-health">
      <SectionHeader
        title="Citation Health"
        description={data.last_checked_at ? `Last checked ${formatDate(data.last_checked_at)}` : "No listing has been checked yet"}
      />
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard
          accent="brand"
          label="Citation Health"
          value={
            scored ? (
              <span>
                {health.score}
                <span className="text-sm font-normal text-muted-foreground">/100</span>
                {health.grade ? <span className="ml-2 text-base font-medium text-muted-foreground">{health.grade}</span> : null}
              </span>
            ) : (
              <span className="text-base font-medium text-muted-foreground">Being checked by our team</span>
            )
          }
          caption={coverageText(health.coverage, health.total)}
        />
        <MetricCard accent="green" label="Live & correct" value={counts.live_correct ?? 0} caption="Listings with the right details" />
        <MetricCard accent="amber" label="Wrong NAP" value={counts.nap_wrong ?? 0} caption="Wrong name, address or phone" />
        <MetricCard accent="red" label="Not listed" value={counts.not_found ?? 0} caption="Directories without a listing" />
      </div>
    </section>
  );
}

function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:text-foreground",
        !active && count === 0 && "opacity-60",
      )}
    >
      {label}
      <span className={cn("tabular", active ? "text-primary-foreground/80" : "text-foreground")}>{count}</span>
    </button>
  );
}

function DirectoryName({ row }: { row: CitationRow }) {
  return (
    <div className="min-w-0">
      <span className="font-medium text-foreground">{row.directory.name}</span>
      {row.directory.type ? <span className="mt-0.5 block text-xs capitalize text-muted-foreground">{row.directory.type.replace(/_/g, " ")}</span> : null}
    </div>
  );
}

function NapIssues({ row }: { row: CitationRow }) {
  if (row.nap_issues.length > 0) {
    return (
      <ul className="space-y-1">
        {row.nap_issues.map((issue) => (
          <li key={issue.field} className="text-sm text-warning-foreground">{napIssueText(issue)}</li>
        ))}
      </ul>
    );
  }
  const text: Partial<Record<CitationStatus, string>> = {
    live_correct: "Matches your business details",
    not_found: "No listing on this directory",
    duplicate: "More than one listing for your business",
    submitted: "Listing submitted, waiting for the directory",
    pending: "Waiting for the directory to approve it",
    not_checked: "Not checked yet",
    removed: "The listing was taken down",
  };
  return <span className="text-sm text-muted-foreground">{text[row.status] ?? "—"}</span>;
}

function ListingLink({ row }: { row: CitationRow }) {
  if (!row.listing_url) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <a
      href={row.listing_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      View listing <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

/** "Not checked → Wrong NAP" for a status change; words for the other actions. */
function changeText(change: CitationChange) {
  switch (change.action) {
    case "status_changed":
      return null;
    case "added":
      return "Added to your citation list";
    case "checked":
      return "Checked, no change";
    case "removed_from_list":
      return "Taken off your citation list";
    case "restored":
      return "Back on your citation list";
    default: {
      const fields = change.changed_fields.map((field) => ({ nap_found: "listing details", listing_url: "listing link", status: "status" })[field] ?? field);
      return fields.length ? `Updated ${fields.join(" and ")}` : "Updated";
    }
  }
}

function ChangeList({ changes }: { changes: CitationChange[] }) {
  return (
    <ul className="divide-y divide-border">
      {changes.map((change, index) => {
        const text = changeText(change);
        return (
          <li key={`${change.at}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-sm">
            <span className="font-medium text-foreground">{change.directory.name}:</span>
            {text === null ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {change.from ? <StatusBadge tone={CITATION_STATUS_TONE[change.from]}>{CITATION_STATUS_SHORT[change.from]}</StatusBadge> : null}
                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
                {change.to ? <StatusBadge tone={CITATION_STATUS_TONE[change.to]}>{CITATION_STATUS_SHORT[change.to]}</StatusBadge> : null}
              </span>
            ) : (
              <span className="text-foreground">{text}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatShortDate(change.at)}, by {change.by}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HistoryDialog({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useCitationChanges(locationId, page, HISTORY_PAGE_SIZE);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Citation history</DialogTitle>
          <DialogDescription>Every change the MyPageSEO team recorded for this location, newest first.</DialogDescription>
        </DialogHeader>
        {history.isPending ? (
          <TableSkeleton rows={6} columns={2} />
        ) : history.isError ? (
          <CitationsError onRetry={() => void history.refetch()} />
        ) : history.data.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        ) : (
          <>
            <ChangeList changes={history.data.changes} />
            <TablePagination
              page={history.data.page}
              pageCount={Math.ceil(history.data.total / history.data.limit)}
              totalItems={history.data.total}
              pageSize={history.data.limit}
              itemLabel="changes"
              onPageChange={setPage}
              className="-mx-6 -mb-6 mt-2"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
