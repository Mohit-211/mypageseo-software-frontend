import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AppWindow,
  Archive,
  CalendarClock,
  ChevronDown,
  Download,
  FileBarChart,
  FilePlus2,
  LoaderCircle,
  Mail,
  RotateCcw,
  RotateCw,
  Share2,
} from "lucide-react";
import { getReports, type LiveReportRow, type ReportRow, type ReportStatus, type ReportType } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import {
  RowActions,
  TableBody,
  TableCard,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
  tdMutedClass,
} from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import {
  REPORT_ACTIVE_STATUSES,
  REPORT_STATUS_FILTERS,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  REPORT_TYPES,
  REPORT_TYPE_LABEL,
  reportRangeLabel,
} from "@/lib/reports/report-meta";
import { REPORTS_LIST_KEY } from "@/lib/reports/use-report-counts";
import { useReportPdfDownload } from "@/lib/reports/use-report-pdf";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { cn } from "@/lib/utils";
import { GenerateReportDialog } from "./generate-report-dialog";
import { ArchiveReportDialog, EmailDialog, ShareDialog } from "./report-actions";
import { ReportTypeIcon } from "./report-type-icon";

const PAGE_SIZE = 20;

type RowDialog = { kind: "share" | "email" | "archive"; reportId: string } | null;
type ListParams = Parameters<typeof getReports>[0];

/** Same filters (maybe another page): the rows on screen still answer what the toolbar shows. */
function sameFilters(a: ListParams, b: ListParams): boolean {
  return (
    a.location_id === b.location_id &&
    a.client_id === b.client_id &&
    a.type === b.type &&
    a.status === b.status &&
    a.include_deleted === b.include_deleted
  );
}

/**
 * The PDF report library (`GET reports`): newest first (the backend's order, never re-sorted
 * here), with filters, a menu per report (download, share, email, archive) and a create dialog
 * that stays on the page. Live pages (always up to date, no PDF) sit folded at the top.
 */
export function ReportsList({
  locationId,
  initialLocationId,
  clientId,
  reportPath,
  createOpen,
  onCreateOpenChange,
  showCreateButton = true,
}: {
  /** Lock the list to one location (its filter is hidden). */
  locationId?: string;
  /** Start filtered to this location (the filter can be changed). */
  initialLocationId?: string | null;
  /** One client's reports (the client page, or White Label filtered by client). */
  clientId?: string | null;
  reportPath: (reportId: string, locationId: string | null) => string;
  /** Controls the create dialog from the page (`?create=report`). */
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  showCreateButton?: boolean;
}) {
  const workspace = useWorkspace();
  const canEdit = useCanEdit();
  const block = useWriteBlock();
  const { download, downloading } = useReportPdfDownload();
  const locationOptions = clientId ? workspace.locations.filter((entry) => entry.clientId === clientId) : workspace.locations;
  const [locationFilter, setLocationFilter] = useState<string>(() =>
    initialLocationId && workspace.locations.some((entry) => entry.id === initialLocationId) ? initialLocationId : "all",
  );
  const [type, setType] = useState<ReportType | "all">("all");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [hideDeleted, setHideDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [showLive, setShowLive] = useState(false);
  const [localCreate, setLocalCreate] = useState(false);
  const [retry, setRetry] = useState<{ locationId: string; type: ReportType } | null>(null);
  const [dialog, setDialog] = useState<RowDialog>(null);
  const creating = createOpen ?? localCreate;
  const setCreating = (open: boolean) => {
    if (!open) setRetry(null);
    if (onCreateOpenChange) onCreateOpenChange(open);
    else setLocalCreate(open);
  };
  const location = locationId ?? (locationFilter === "all" ? undefined : locationFilter);

  const params: ListParams = {
    ...(location ? { location_id: location } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    ...(type === "all" ? {} : { type }),
    ...(status === "all" ? {} : { status }),
    ...(hideDeleted ? { include_deleted: false } : {}),
    page,
    limit: PAGE_SIZE,
  };
  const reports = useQuery({
    queryKey: [...REPORTS_LIST_KEY, params],
    queryFn: ({ signal }) => getReports(params, signal),
    // Another page keeps the current rows up (marked "Updating…") until it arrives. A filter change
    // shows the skeleton instead: the old rows would contradict the filters just picked.
    placeholderData: (previous, previousQuery) => {
      const before = previousQuery?.queryKey[2] as ListParams | undefined;
      return before && sameFilters(before, params) ? previous : undefined;
    },
    // Keep queued reports moving to "Ready" without a reload.
    refetchInterval: (query) => (query.state.data?.reports.some((r) => REPORT_ACTIVE_STATUSES.includes(r.status)) ? 5_000 : false),
  });
  const updating = reports.isPlaceholderData;

  const filtered = type !== "all" || status !== "all" || (!locationId && locationFilter !== "all") || hideDeleted;
  const resetFilters = () => {
    setType("all");
    setStatus("all");
    setLocationFilter("all");
    setHideDeleted(false);
    setPage(1);
  };
  const total = reports.data?.total ?? 0;
  const rows = (reports.data?.reports ?? []) as ReportRow[];
  const live = reports.data?.live ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = locationId ? 5 : 6;

  // No PDF report to list: on its own, or under the in-app pages (which come back with most filters,
  // so the next step must show there too).
  const noReports = filtered ? (
    <EmptyState
      variant="no-results"
      title={status === "archived" ? "Nothing archived" : "No PDF reports match these filters"}
      description={status === "archived" ? "Reports you archive are kept here." : "Try another location, report or status."}
      action={
        <Button variant="outline" size="sm" onClick={resetFilters}>
          <RotateCcw aria-hidden /> Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      className="m-4"
      icon={FileBarChart}
      tone="reports"
      title="No PDF reports yet"
      description="A PDF report is a snapshot of a location's results you can download, share or email. It takes about a minute."
      action={
        canEdit && workspace.locations.length > 0 ? (
          <Button onClick={() => setCreating(true)} disabled={block.blocked}>
            <FilePlus2 aria-hidden /> Create your first report
          </Button>
        ) : undefined
      }
    />
  );

  // The way forward for one report: its menu when it's ready (or archived), "Try again" when it failed.
  const reportAction = (report: ReportRow) => {
    const reportLocation = report.location?.location_id ?? null;
    if (report.status === "ready" || report.status === "archived") {
      return (
        <RowActions label={`Actions for ${REPORT_TYPE_LABEL[report.type] ?? "this report"}`}>
          <DropdownMenuItem disabled={downloading !== null} onSelect={() => void download(report.report_id)}>
            <Download aria-hidden /> Download PDF
          </DropdownMenuItem>
          {canEdit && report.status === "ready" ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog({ kind: "share", reportId: report.report_id })}>
                <Share2 aria-hidden /> Share link…
              </DropdownMenuItem>
              <DropdownMenuItem disabled={block.blocked} onSelect={() => setDialog({ kind: "email", reportId: report.report_id })}>
                <Mail aria-hidden /> Email…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDialog({ kind: "archive", reportId: report.report_id })}>
                <Archive aria-hidden /> Archive
              </DropdownMenuItem>
            </>
          ) : null}
        </RowActions>
      );
    }
    if (report.status === "failed" && canEdit && reportLocation && !report.location?.deleted && isCreatable(report.type)) {
      return (
        <Button
          variant="ghost"
          size="sm"
          disabled={block.blocked}
          onClick={() => {
            setRetry({ locationId: reportLocation, type: report.type as ReportType });
            setCreating(true);
          }}
        >
          <RotateCw aria-hidden /> Try again
        </Button>
      );
    }
    return null;
  };

  return (
    <TableCard>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 xl:flex-row xl:items-center">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,13rem))_auto] lg:items-center">
          {locationId ? null : (
            <Select
              value={locationFilter}
              onValueChange={(value) => {
                setLocationFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Filter by location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All locations</SelectItem>
                {locationOptions.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.businessName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value as ReportType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by report">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reports</SelectItem>
              {REPORT_TYPES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as ReportStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {REPORT_STATUS_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {REPORT_STATUS_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {locationId ? null : (
            <div className="flex min-h-9 items-center gap-2 sm:col-span-2 lg:col-span-1 lg:pl-1">
              <Switch
                id="reports-hide-deleted"
                checked={hideDeleted}
                onCheckedChange={(value) => {
                  setHideDeleted(value);
                  setPage(1);
                }}
              />
              <Label htmlFor="reports-hide-deleted" className="whitespace-nowrap text-sm font-normal text-muted-foreground">
                Hide deleted locations
              </Label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          {/* Always in the page, so screen readers announce it when the next page starts loading. */}
          <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {updating ? (
              <>
                <LoaderCircle aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" /> Updating…
              </>
            ) : null}
          </span>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw aria-hidden /> Reset
            </Button>
          ) : null}
          {showCreateButton && canEdit && !(reports.isSuccess && rows.length === 0 && !filtered) ? (
            // Outline: the page header holds the one filled action. Hidden while the first-use empty
            // state below offers "Create your first report".
            <span title={block.reason ?? (workspace.locations.length === 0 ? "Add a location first." : undefined)}>
              <Button size="sm" variant="outline" onClick={() => setCreating(true)} disabled={workspace.locations.length === 0 || block.blocked}>
                <FilePlus2 aria-hidden /> Create report
              </Button>
            </span>
          ) : null}
        </div>
      </div>

      {reports.isPending ? (
        <div className="p-4">
          <TableSkeleton rows={5} columns={5} />
        </div>
      ) : reports.isError ? (
        <div className="p-4">
          <ErrorState compact description="Your PDF reports couldn't be loaded." onRetry={() => void reports.refetch()} />
        </div>
      ) : rows.length === 0 && live.length === 0 ? (
        noReports
      ) : (
        <div aria-busy={updating || undefined}>
          {/* Phones: one card per report; the table needs more room than a phone has. */}
          <ul className="divide-y divide-border md:hidden">
            {live.length > 0 ? (
              <li className="bg-surface-strong px-4 py-2.5">
                <LiveToggle count={live.length} open={showLive} onToggle={() => setShowLive((open) => !open)} />
              </li>
            ) : null}
            {showLive
              ? live.map((row) => (
                  <li key={`live-${row.type}-${row.location.location_id}`} className="space-y-1.5 bg-surface-strong/50 px-4 py-3">
                    <ReportName type={row.type} to={livePath(row)} detail="Updates on its own" />
                    <p className="pl-11 text-xs text-muted-foreground">
                      {row.location.name ?? "Unnamed location"}
                      {row.generated_at ? ` · updated ${formatDate(row.generated_at)}` : ""}
                    </p>
                  </li>
                ))
              : null}
            {rows.length === 0 ? <li>{noReports}</li> : null}
            {rows.map((report) => (
              <li key={report.report_id} className="flex items-start gap-2 px-4 py-3.5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <ReportName
                    type={report.type}
                    to={reportPath(report.report_id, report.location?.location_id ?? null)}
                    detail={reportRangeLabel(report.range)}
                    scheduled={report.trigger === "schedule"}
                  />
                  <div className="space-y-1.5 pl-11">
                    {locationId ? null : (
                      <p className="text-xs text-muted-foreground">
                        {report.location?.name ?? "Unnamed location"}
                        {report.location?.deleted ? " (deleted)" : ""}
                        {report.client?.name ? ` · ${report.client.name}` : ""}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <ReportStatusBadge report={report} />
                      <span>{formatDateTime(report.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">{reportAction(report)}</div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <TableScroll minWidth={locationId ? 680 : 860} label="PDF reports">
              <TableHead>
                <Th>Report</Th>
                {locationId ? null : <Th>Location</Th>}
                <Th>Ranking run</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th srOnly className="w-14">
                  Actions
                </Th>
              </TableHead>
              <TableBody>
                {live.length > 0 ? (
                  <tr className="bg-surface-strong">
                    <td colSpan={columns} className="px-4 py-2">
                      <LiveToggle count={live.length} open={showLive} onToggle={() => setShowLive((open) => !open)} />
                    </td>
                  </tr>
                ) : null}
                {showLive
                  ? live.map((row) => (
                      <TableRow key={`live-${row.type}-${row.location.location_id}`} className="bg-surface-strong/50">
                        <td className={tdClass}>
                          <ReportName type={row.type} to={livePath(row)} detail="Updates on its own" />
                        </td>
                        {locationId ? null : (
                          <td className={tdClass}>
                            <LocationName location={row.location} />
                          </td>
                        )}
                        <td className={tdMutedClass}>—</td>
                        <td className={tdClass}>
                          <InAppBadge />
                        </td>
                        <td className={tdMutedClass}>{row.generated_at ? `Updated ${formatDate(row.generated_at)}` : "—"}</td>
                        <td className={tdClass} />
                      </TableRow>
                    ))
                  : null}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns} className="p-0">
                      {noReports}
                    </td>
                  </tr>
                ) : null}
                {rows.map((report) => (
                  <TableRow key={report.report_id}>
                    <td className={tdClass}>
                      <ReportName
                        type={report.type}
                        to={reportPath(report.report_id, report.location?.location_id ?? null)}
                        detail={reportRangeLabel(report.range)}
                        scheduled={report.trigger === "schedule"}
                      />
                    </td>
                    {locationId ? null : (
                      <td className={tdClass}>
                        {report.location ? <LocationName location={report.location} /> : "—"}
                        {report.client?.name ? <span className="block text-xs text-muted-foreground">{report.client.name}</span> : null}
                      </td>
                    )}
                    <td className={cn(tdMutedClass, "whitespace-nowrap")}>{report.run_at ? formatDate(report.run_at) : "—"}</td>
                    <td className={tdClass}>
                      <ReportStatusBadge report={report} />
                    </td>
                    <td className={cn(tdMutedClass, "whitespace-nowrap")}>{formatDateTime(report.created_at)}</td>
                    <td className={cn(tdClass, "text-right")}>{reportAction(report)}</td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
          </div>
          {total > 0 ? (
            <TablePagination page={page} pageCount={pageCount} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="reports" />
          ) : null}
        </div>
      )}

      <GenerateReportDialog
        open={creating}
        onOpenChange={setCreating}
        locationId={retry?.locationId ?? locationId ?? (locationFilter === "all" ? null : locationFilter)}
        clientId={clientId}
        lockLocation={Boolean(locationId)}
        defaultType={retry?.type ?? "rank_tracker"}
      />
      {dialog?.kind === "share" ? <ShareDialog reportId={dialog.reportId} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "email" ? <EmailDialog reportId={dialog.reportId} onClose={() => setDialog(null)} /> : null}
      <ArchiveReportDialog
        reportId={dialog?.kind === "archive" ? dialog.reportId : ""}
        open={dialog?.kind === "archive"}
        onOpenChange={(open) => (open ? undefined : setDialog(null))}
        onArchived={() => setDialog(null)}
      />
    </TableCard>
  );
}

function isCreatable(type: string): boolean {
  return REPORT_TYPES.some((entry) => entry.value === type);
}

/** In-app page of a live row. */
function livePath(row: LiveReportRow): string {
  const id = row.link.location_id;
  return row.type === "review_insights" ? locationPath(id, "reputation/insights") : locationPath(id, "gbp/audit");
}

function ReportName({ type, to, detail, scheduled }: { type: string; to: string; detail?: string | null; scheduled?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-tint text-primary ring-1 ring-inset ring-primary/15">
        <ReportTypeIcon type={type} className="size-4" />
      </span>
      <div className="min-w-0">
        <Link to={to} className="rounded-sm font-semibold text-foreground underline-offset-2 outline-hidden hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
          {REPORT_TYPE_LABEL[type] ?? type}
        </Link>
        {detail || scheduled ? (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {detail ? <span>{detail}</span> : null}
            {scheduled ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock aria-hidden className="size-3.5" /> Monthly email
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A location's name, labelled when the location was deleted (its reports are kept). */
function LocationName({ location }: { location: { name: string | null; deleted?: boolean } }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={location.deleted ? "text-muted-foreground" : "text-foreground"}>{location.name ?? "Unnamed location"}</span>
      {location.deleted ? (
        <StatusBadge tone="neutral" size="sm">
          Deleted location
        </StatusBadge>
      ) : null}
    </span>
  );
}

/**
 * The in-app pages (GBP report, review insights) listed with the PDFs. Never called "Live": on White
 * Label that word means a client link, and clients never see these pages.
 */
function InAppBadge() {
  return (
    <StatusBadge tone="neutral" icon={AppWindow} size="sm">
      In the app
    </StatusBadge>
  );
}

function LiveToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md py-1 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <InAppBadge />
      {/* The explanation wraps on phones rather than hiding: it's what tells these apart from client links. */}
      <span className="min-w-0 flex-1">
        <span className="font-medium text-foreground">
          {count} always-current page{count === 1 ? "" : "s"}
        </span>{" "}
        <span className="text-muted-foreground">· no PDF, they open in the app</span>
      </span>
      <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
    </button>
  );
}

function ReportStatusBadge({ report }: { report: ReportRow }) {
  const active = REPORT_ACTIVE_STATUSES.includes(report.status);
  return (
    <span title={report.status === "failed" ? (report.failure_reason ?? undefined) : undefined}>
      <StatusBadge tone={REPORT_STATUS_TONE[report.status] ?? "neutral"}>
        {active ? <LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" /> : null}
        {REPORT_STATUS_LABEL[report.status] ?? report.status}
      </StatusBadge>
    </span>
  );
}
