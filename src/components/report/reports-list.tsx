import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileBarChart, FilePlus2, LoaderCircle } from "lucide-react";
import { createReport, getReports, isApiError, type ReportStatus, type ReportType } from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import {
  TableBody,
  TableCard,
  TableHead,
  TablePagination,
  TableRow,
  TableScroll,
  Th,
  tdClass,
} from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRunDate } from "@/lib/rankings/format";
import {
  REPORT_CREATE_ERRORS,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  REPORT_TYPES,
  REPORT_TYPE_LABEL,
} from "@/lib/reports/report-meta";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const PAGE_SIZE = 20;
const ACTIVE: ReportStatus[] = ["queued", "generating"];

/**
 * Every generated report (`GET reports`), newest first, with filters. Pass
 * `locationId` to show one location's reports (its page under Locations).
 */
export function ReportsList({ locationId, reportPath }: { locationId?: string; reportPath: (reportId: string, locationId: string | null) => string }) {
  const workspace = useWorkspace();
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [type, setType] = useState<ReportType | "all">("all");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const location = locationId ?? (locationFilter === "all" ? undefined : locationFilter);

  const params = {
    ...(location ? { location_id: location } : {}),
    ...(type === "all" ? {} : { type }),
    ...(status === "all" ? {} : { status }),
    page,
    limit: PAGE_SIZE,
  };
  const reports = useQuery({
    queryKey: ["reports", "list", params],
    queryFn: ({ signal }) => getReports(params, signal),
    placeholderData: keepPreviousData,
    // Keep queued reports moving to "Ready" without a reload.
    refetchInterval: (query) => (query.state.data?.reports.some((r) => ACTIVE.includes(r.status)) ? 5_000 : false),
  });

  const filters = (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-center">
      {locationId ? null : (
        <Select value={locationFilter} onValueChange={(value) => { setLocationFilter(value); setPage(1); }}>
          <SelectTrigger className="w-full bg-background sm:w-56" aria-label="Filter by location"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {workspace.locations.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.businessName}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <Select value={type} onValueChange={(value) => { setType(value as ReportType | "all"); setPage(1); }}>
        <SelectTrigger className="w-full bg-background sm:w-48" aria-label="Filter by type"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {REPORT_TYPES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => { setStatus(value as ReportStatus | "all"); setPage(1); }}>
        <SelectTrigger className="w-full bg-background sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any status</SelectItem>
          {(["ready", "queued", "generating", "failed", "expired"] as ReportStatus[]).map((value) => (
            <SelectItem key={value} value={value}>{REPORT_STATUS_LABEL[value]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" className="sm:ml-auto" onClick={() => setCreating(true)} disabled={workspace.locations.length === 0}>
        <FilePlus2 aria-hidden /> Create report
      </Button>
    </div>
  );

  const total = reports.data?.total ?? 0;
  const rows = reports.data?.reports ?? [];
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = type !== "all" || status !== "all" || locationFilter !== "all";

  return (
    <div className="space-y-4">
      {filters}
      {reports.isPending ? (
        <TableSkeleton rows={5} columns={5} />
      ) : reports.isError ? (
        <ErrorState description="Reports couldn't be loaded." onRetry={() => void reports.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title={filtered ? "No reports match these filters" : "No reports yet"}
          description={filtered ? "Change the filters to see other reports." : "Create a report to get a PDF you can download, share or email."}
        />
      ) : (
        <TableCard>
          <TableScroll minWidth={760} label="Reports">
            <TableHead>
              <Th>Report</Th>
              {locationId ? null : <Th>Location</Th>}
              <Th>Ranking run</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </TableHead>
            <TableBody>
              {rows.map((report) => (
                <TableRow key={report.report_id}>
                  <td className={tdClass}>
                    <Link to={reportPath(report.report_id, report.location?.location_id ?? null)} className="font-semibold text-foreground hover:text-primary hover:underline">
                      {REPORT_TYPE_LABEL[report.type] ?? report.type}
                    </Link>
                    {report.range ? <span className="ml-2 text-xs text-muted-foreground">{report.range}</span> : null}
                  </td>
                  {locationId ? null : (
                    <td className={tdClass}>
                      {report.location?.name ?? "—"}
                      {report.client?.name ? <span className="block text-xs text-muted-foreground">{report.client.name}</span> : null}
                    </td>
                  )}
                  <td className={tdClass}>{report.run_at ? formatRunDate(report.run_at) : "—"}</td>
                  <td className={tdClass}>
                    <StatusBadge tone={REPORT_STATUS_TONE[report.status] ?? "neutral"}>
                      {ACTIVE.includes(report.status) ? <LoaderCircle aria-hidden className="size-3 animate-spin" /> : null}
                      {REPORT_STATUS_LABEL[report.status] ?? report.status}
                    </StatusBadge>
                  </td>
                  <td className={tdClass}><span className="text-muted-foreground">{formatRunDate(report.created_at, true)}</span></td>
                </TableRow>
              ))}
            </TableBody>
          </TableScroll>
          <TablePagination page={page} pageCount={pageCount} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="reports" />
        </TableCard>
      )}

      {creating ? (
        <CreateReportDialog
          {...(location ? { locationId: location } : {})}
          lockLocation={Boolean(locationId)}
          reportPath={reportPath}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}

function CreateReportDialog({
  locationId,
  lockLocation,
  reportPath,
  onClose,
}: {
  locationId?: string;
  lockLocation: boolean;
  reportPath: (reportId: string, locationId: string | null) => string;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [location, setLocation] = useState<string>(locationId ?? workspace.activeLocation?.id ?? workspace.locations[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("rank_tracker");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!location) return;
    setSaving(true);
    setError(null);
    try {
      const report = await createReport({ location_id: location, type });
      onClose();
      navigate(reportPath(report.report_id, location));
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      setError((reason && REPORT_CREATE_ERRORS[reason]) ?? "The report couldn't be created. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a report</DialogTitle>
          <DialogDescription>It's generated from the latest data in a minute or so, then you can download, share or email the PDF.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {lockLocation ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="report-location">Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="report-location" className="bg-background"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>
                  {workspace.locations.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.businessName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-foreground">Type</legend>
            {REPORT_TYPES.map((entry) => (
              <label key={entry.value} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:bg-brand-tint">
                <input type="radio" name="report-type" value={entry.value} checked={type === entry.value} onChange={() => setType(entry.value)} className="mt-1 accent-[var(--color-primary)]" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                  <span className="block text-xs text-muted-foreground">{entry.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void create()} disabled={saving || !location}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <FilePlus2 aria-hidden />} Create report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
