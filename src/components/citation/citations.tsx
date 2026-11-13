import { useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Hourglass,
  History,
  LifeBuoy,
  ListChecks,
  MinusCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { CitationChange, CitationRow, CitationStatus, CitationsResponse } from "@/api";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { STATUS_TONE_CLASSES, type StatusTone } from "@/components/layout/shared/module-tone";
import { ScoreRing } from "@/components/layout/shared/score-ring";
import { MobileListRow, TableBody, TableHead, TablePagination, TableRow, TableScroll, Th, tdClass, tdMutedClass } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CITATION_FILTER_ORDER,
  CITATION_IN_PROGRESS_STATUSES,
  CITATION_PROBLEM_STATUSES,
  CITATION_STATUS_LABEL,
  CITATION_STATUS_SHORT,
  CITATION_STATUS_TONE,
  citationFilterLabel,
  coverageText,
  matchesCitationFilter,
  napFieldLabel,
  parseCitationFilter,
  type CitationFilter,
} from "@/lib/citations/citations";
import { useCitationChanges } from "@/lib/citations/use-citations";
import { formatDate, formatShortDate } from "@/lib/datetime";
import { setParam, useSearchUpdater } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const HISTORY_PAGE_SIZE = 25;

type CitationsData = Extract<CitationsResponse, { available: true }>;

const STATUS_ICON: Record<CitationStatus, LucideIcon> = {
  live_correct: CheckCircle2,
  nap_wrong: AlertTriangle,
  not_found: XCircle,
  duplicate: Copy,
  submitted: Hourglass,
  pending: Hourglass,
  not_checked: MinusCircle,
  removed: MinusCircle,
};

export function CitationsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading citations">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {["Citation score", "Live & correct", "Wrong details", "Not listed", "In progress"].map((label, index) => (
          <KpiTile key={label} label={label} value="" loading className={index === 0 ? "col-span-2 xl:col-span-1" : undefined} />
        ))}
      </div>
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

export function CitationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <ErrorState
      title="Citation data couldn't be loaded"
      description="Check your connection and try again. Nothing on your listings has changed."
      onRetry={onRetry}
    />
  );
}

/** Before the citation list exists: the team sets it up when onboarding completes. */
export function CitationsSettingUp() {
  return (
    <EmptyState
      variant="unavailable"
      icon={ListChecks}
      tone="citations"
      title="Our team is setting up your citation tracking"
      description="The MyPageSEO team picks the directories that fit your business and checks each listing by hand. Results show here as soon as the first listings are checked."
      secondaryAction={
        <Button asChild variant="outline" size="sm">
          <Link to="/support?new=1">
            <LifeBuoy aria-hidden /> Ask the team
          </Link>
        </Button>
      }
      className="min-h-64"
    />
  );
}

/**
 * The Citations page for one location (`GET locations/:id/citations`). Read-only: the
 * MyPageSEO team checks every listing, so there are no add, edit or "check now" actions.
 * The status filter lives in `?status=`, so dashboard actions can open the filtered list.
 */
export function CitationsContent({ data, locationId }: { data: CitationsData; locationId: string }) {
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const status = parseCitationFilter(params.get("status"));
  const [historyOpen, setHistoryOpen] = useState(false);
  const listRef = useRef<HTMLElement>(null);

  // Committed before it returns, so `filterAndShow` can scroll to the list right after (the page
  // otherwise keeps its place, `#section` included).
  const setStatus = (next: CitationFilter) =>
    updateSearch((updated) => setParam(updated, "status", next === "all" ? null : next), { flushSync: true });
  const filterAndShow = (next: CitationFilter) => {
    setStatus(next);
    listRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const rows = data.citations.filter((row) => matchesCitationFilter(row.status, status));
  const chips = CITATION_FILTER_ORDER.filter((value) => value !== "removed" || data.counts.removed > 0);
  const problems = CITATION_PROBLEM_STATUSES.reduce((sum, value) => sum + (data.counts[value] ?? 0), 0);

  return (
    <div className="space-y-6">
      <CitationKpis data={data} active={status} onFilter={filterAndShow} />

      <ProblemsNotice problems={problems} total={data.health.total} onShow={() => filterAndShow("problems")} />

      <section ref={listRef} aria-labelledby="citation-listings-title" className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="citation-listings-title" className="text-[15px] font-semibold leading-6 text-foreground">
              Directory listings
            </h2>
            <p className="text-[13px] text-muted-foreground">Checked by hand by the MyPageSEO team. Problems are listed first.</p>
          </div>
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2 border-b border-border bg-surface-strong px-4 py-3">
          <StatusChip label="All" count={data.health.total} active={status === "all"} onClick={() => setStatus("all")} />
          {chips.map((value) => (
            <StatusChip
              key={value}
              label={CITATION_STATUS_SHORT[value]}
              count={data.counts[value] ?? 0}
              tone={CITATION_STATUS_TONE[value]}
              // A group filter ("Needs attention", "In progress") lights up each of its statuses.
              active={status !== "all" && matchesCitationFilter(value, status)}
              onClick={() => setStatus(status === value ? "all" : value)}
            />
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            variant="no-results"
            title={status === "all" ? "No listings yet" : `No listings are “${citationFilterLabel(status)}”`}
            description={status === "all" ? "Listings appear here as soon as the team adds them." : "Pick another status to see those listings."}
            action={
              status === "all" ? undefined : (
                <Button variant="outline" size="sm" onClick={() => setStatus("all")}>
                  Show all listings
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <TableScroll minWidth={880} label="Directory listings">
                <TableHead>
                  <Th className="min-w-[190px]">Directory</Th>
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
                        <CitationBadge status={row.status} />
                      </td>
                      <td className={cn(tdClass, "max-w-[380px]")}>
                        <NapIssues row={row} />
                      </td>
                      <td className={tdClass}>
                        <ListingLink row={row} />
                      </td>
                      <td className={cn(tdMutedClass, "whitespace-nowrap")}>{formatDate(row.last_checked_at, "Not checked yet")}</td>
                    </TableRow>
                  ))}
                </TableBody>
              </TableScroll>
            </div>

            <div className="divide-y divide-border md:hidden">
              {rows.map((row, index) => (
                <MobileListRow key={`${row.directory.name}-${index}`}>
                  <div className="flex items-start justify-between gap-3">
                    <DirectoryName row={row} />
                    <CitationBadge status={row.status} short />
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
      </section>

      <Panel
        title="Recent changes"
        description="What the MyPageSEO team found or updated, newest first."
        icon={History}
        tone="citations"
        actions={
          data.recent_changes.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History aria-hidden /> Full history
            </Button>
          ) : undefined
        }
      >
        {data.recent_changes.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No changes recorded yet.</p> : <ChangeList changes={data.recent_changes} />}
      </Panel>

      {historyOpen ? <HistoryDialog locationId={locationId} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Headline numbers                                                            */
/* -------------------------------------------------------------------------- */

/** A status count that filters the listings when pressed; zero counts stay grey. */
function StatusTile({
  label,
  count,
  tone,
  icon: Icon,
  hint,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: StatusTone;
  icon: LucideIcon;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  const resolved: StatusTone = count === 0 ? "neutral" : tone;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group flex min-w-0 cursor-pointer flex-col rounded-xl border bg-card p-4 text-left shadow-card outline-hidden transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <span className="flex items-start gap-3">
        <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ring-border", STATUS_TONE_CLASSES[resolved].chip)}>
          <Icon className="size-[18px]" />
        </span>
        <span className="pt-2 text-sm font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
      </span>
      <span className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-foreground">{count}</span>
      <span className="mt-2 text-xs text-muted-foreground">{active ? "Showing these below" : hint}</span>
    </button>
  );
}

function CitationKpis({ data, active, onFilter }: { data: CitationsData; active: CitationFilter; onFilter: (filter: CitationFilter) => void }) {
  const { health, counts } = data;
  const inProgress = CITATION_IN_PROGRESS_STATUSES.reduce((sum, value) => sum + (counts[value] ?? 0), 0);
  const toggle = (filter: CitationFilter) => onFilter(active === filter ? "all" : filter);

  return (
    <section aria-label="Citation summary" className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      <div className="col-span-2 flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card xl:col-span-1">
        <ScoreRing value={health.score} size="md" label="Citation score" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Citation score</p>
          {health.score != null ? (
            <p className="mt-0.5 text-lg font-semibold text-foreground">{health.grade ? `Grade ${health.grade}` : `${health.score} of 100`}</p>
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-foreground">Being checked by our team</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {coverageText(health.coverage, health.total)}
            {data.last_checked_at ? ` · last ${formatShortDate(data.last_checked_at)}` : ""}
          </p>
        </div>
      </div>
      <StatusTile
        label="Live & correct"
        count={counts.live_correct ?? 0}
        tone="success"
        icon={CheckCircle2}
        hint="Listings with the right details"
        active={active === "live_correct"}
        onClick={() => toggle("live_correct")}
      />
      <StatusTile
        label="Wrong details"
        count={counts.nap_wrong ?? 0}
        tone="warning"
        icon={AlertTriangle}
        hint="Wrong name, address or phone"
        active={active === "nap_wrong"}
        onClick={() => toggle("nap_wrong")}
      />
      <StatusTile
        label="Not listed"
        count={counts.not_found ?? 0}
        tone="critical"
        icon={XCircle}
        hint="Directories without a listing"
        active={active === "not_found"}
        onClick={() => toggle("not_found")}
      />
      <StatusTile
        label="In progress"
        count={inProgress}
        tone="info"
        icon={Hourglass}
        hint="Submitted or waiting for approval"
        active={active === "in_progress"}
        onClick={() => toggle("in_progress")}
      />
    </section>
  );
}

/** One line about what needs attention, or a small celebration when nothing does. */
function ProblemsNotice({ problems, total, onShow }: { problems: number; total: number; onShow: () => void }) {
  if (total === 0) return null;
  if (problems === 0) {
    return (
      <p role="status" className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-surface px-4 py-3 text-sm font-medium text-foreground">
        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
        No problems found: every checked listing shows the right details.
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/40 bg-warning-surface px-4 py-3">
      <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-[1_1_18rem] text-sm text-foreground">
        <span className="font-semibold">
          {problems} listing{problems === 1 ? " needs" : "s need"} attention.
        </span>{" "}
        Wrong details and missing listings make it harder for Google to trust your business information.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onShow}>
          Show {problems === 1 ? "it" : "them"} <ArrowRight aria-hidden />
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link to="/support?new=1">
            <LifeBuoy aria-hidden /> Ask the team
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Listings                                                                    */
/* -------------------------------------------------------------------------- */

function StatusChip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: StatusTone;
  active: boolean;
  onClick: () => void;
}) {
  const empty = count === 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : empty
            ? "border-dashed border-border-strong bg-card text-muted-foreground hover:text-foreground"
            : "border-border-strong bg-card text-foreground hover:border-primary/40 hover:bg-accent",
      )}
    >
      {tone ? <span aria-hidden className={cn("size-2 shrink-0 rounded-full", active ? "bg-primary-foreground" : empty ? "bg-muted-foreground" : STATUS_TONE_CLASSES[tone].dot)} /> : null}
      {label}
      <span
        className={cn(
          "min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums",
          active ? "bg-primary-hover text-primary-foreground" : empty ? "bg-muted text-muted-foreground" : "bg-muted text-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CitationBadge({ status, short = false }: { status: CitationStatus; short?: boolean }) {
  return (
    <StatusBadge tone={CITATION_STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {short ? CITATION_STATUS_SHORT[status] : CITATION_STATUS_LABEL[status]}
    </StatusBadge>
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

const STATUS_TEXT: Partial<Record<CitationStatus, string>> = {
  live_correct: "Matches your business details",
  not_found: "No listing on this directory",
  duplicate: "More than one listing for your business",
  submitted: "Listing submitted, waiting for the directory",
  pending: "Waiting for the directory to approve it",
  not_checked: "Not checked yet",
  removed: "The listing was taken down",
};

/** Each wrong field as "Phone: (416) 555-0199 → (416) 555-0182", so the fix is obvious. */
function NapIssues({ row }: { row: CitationRow }) {
  if (row.nap_issues.length > 0) {
    return (
      <ul className="space-y-1.5">
        {row.nap_issues.map((issue) => (
          <li key={issue.field} className="text-sm leading-5">
            <span className="font-medium text-foreground">{napFieldLabel(issue.field)}:</span>{" "}
            <span className="text-muted-foreground">listed as</span> <span className="font-medium text-warning-foreground">{issue.found ?? "nothing"}</span>
            <span className="text-muted-foreground">, should be</span> <span className="font-medium text-foreground">{issue.expected ?? "—"}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <span className="text-sm text-muted-foreground">{STATUS_TEXT[row.status] ?? "—"}</span>;
}

function ListingLink({ row }: { row: CitationRow }) {
  if (!row.listing_url) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <a
      href={row.listing_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      View listing <ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">on {row.directory.name} (opens in a new tab)</span>
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Changes                                                                     */
/* -------------------------------------------------------------------------- */

/** Words for a change that isn't a status move. */
function changeText(change: CitationChange): string | null {
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

function ChangeLine({ children, at, by }: { children: ReactNode; at: string; by: string }) {
  return (
    <li className="relative pb-4 pl-6 last:pb-0">
      <span aria-hidden className="absolute left-[5px] top-2 h-full w-px bg-border" />
      <span aria-hidden className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card bg-chart-4 ring-1 ring-border" />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">{children}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatShortDate(at)} · by {by}
      </p>
    </li>
  );
}

function ChangeList({ changes }: { changes: CitationChange[] }) {
  return (
    <ul className="[&>li:last-child>span:first-child]:hidden">
      {changes.map((change, index) => {
        const text = changeText(change);
        return (
          <ChangeLine key={`${change.at}-${index}`} at={change.at} by={change.by}>
            <span className="font-medium text-foreground">{change.directory.name}</span>
            {text === null ? (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {change.from ? <CitationBadge status={change.from} short /> : null}
                <ArrowRight className="size-3.5 text-muted-foreground" aria-label="changed to" />
                {change.to ? <CitationBadge status={change.to} short /> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">{text}</span>
            )}
          </ChangeLine>
        );
      })}
    </ul>
  );
}

function HistoryDialog({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const history = useCitationChanges(locationId, page, HISTORY_PAGE_SIZE);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Citation history</DialogTitle>
          <DialogDescription>Every change the MyPageSEO team recorded for this location, newest first.</DialogDescription>
        </DialogHeader>
        {history.isPending ? (
          <ListSkeleton rows={6} />
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
