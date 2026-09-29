import { useMemo, useState } from "react";
import { Panel, SectionHeader, StatusBadge, type StatusTone } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  REPORTS_PAGE_SIZE,
  REPORT_STATE_LABEL,
  REPORT_TYPE_LABEL,
  type ReportRow,
  type ReportState,
  type ReportType,
  type ReportsData,
} from "@/lib/reports/reports";
import { cn } from "@/lib/utils";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  RowActions,
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
import { NoReportsEmpty } from "@/components/layout/shared/feedback/empty-states";

const stateTone: Record<ReportState, StatusTone> = {
  generated: "success",
  scheduled: "info",
  processing: "warning",
  failed: "critical",
};

export function ReportsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading reports">
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}

type SortKey = "name" | "type" | "state" | "generatedAt" | "updatedAt";

export function ReportsContent({
  data,
  isAgency,
  onRetry,
}: {
  data: ReportsData;
  isAgency: boolean;
  onRetry: () => void;
}) {
  const [type, setType] = useState<"all" | ReportType>("all");
  const [state, setState] = useState<"all" | ReportState>("all");
  const [client, setClient] = useState("all");
  const [location, setLocation] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("updatedAt");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<ReportRow | null>(null);

  const clients = useMemo(
    () => Array.from(new Map(data.reports.filter((r) => r.clientId && r.clientName).map((r) => [r.clientId!, r.clientName!])).entries()),
    [data.reports],
  );
  const locations = useMemo(
    () => Array.from(new Map(data.reports.filter((r) => r.locationId && r.locationName).map((r) => [r.locationId!, r.locationName!])).entries()),
    [data.reports],
  );

  const filtered = useMemo(() => {
    const rows = data.reports.filter((report) => {
      if (type !== "all" && report.type !== type) return false;
      if (state !== "all" && report.state !== state) return false;
      if (isAgency && client !== "all" && report.clientId !== client) return false;
      if (location !== "all" && report.locationId !== location) return false;
      if (data.capabilities.canSearch && search.trim()) {
        if (!report.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      const direction = descending ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name) * direction;
      if (sort === "type") return a.type.localeCompare(b.type) * direction;
      if (sort === "state") return a.state.localeCompare(b.state) * direction;
      return ((a[sort] ?? "").localeCompare(b[sort] ?? "")) * direction;
    });
  }, [data.reports, data.capabilities.canSearch, type, state, client, location, search, sort, descending, isAgency]);

  const generated = filtered.filter((report) => report.state !== "scheduled");
  const scheduled = filtered.filter((report) => report.state === "scheduled");
  const totalPages = Math.max(1, Math.ceil(generated.length / REPORTS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = generated.slice((current - 1) * REPORTS_PAGE_SIZE, current * REPORTS_PAGE_SIZE);
  const hasFilters = type !== "all" || state !== "all" || client !== "all" || location !== "all" || search.trim() !== "";

  if (data.status === "loading") return <ReportsLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Reports could not be loaded"
        description="We couldn't load your reports. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "no_reports" || data.reports.length === 0) {
    return (
      <NoReportsEmpty className="min-h-64" />
    );
  }

  const order = descending ? "desc" : "asc";

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDescending((value) => !value);
    else { setSort(key); setDescending(true); }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {data.capabilities.availableTypes.length > 0 ? (
            <Select value={type} onValueChange={(value) => { setType(value as ReportType | "all"); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px] text-xs" aria-label="Report type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All report types</SelectItem>
                {data.capabilities.availableTypes.map((value) => (
                  <SelectItem key={value} value={value}>{REPORT_TYPE_LABEL[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={state} onValueChange={(value) => { setState(value as ReportState | "all"); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] text-xs" aria-label="Report status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["generated", "scheduled", "processing", "failed"] as ReportState[]).map((value) => (
                <SelectItem key={value} value={value}>{REPORT_STATE_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAgency && clients.length > 0 ? (
            <Select value={client} onValueChange={(value) => { setClient(value); setPage(1); }}>
              <SelectTrigger className="h-9 w-[180px] text-xs" aria-label="Client"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {locations.length > 0 ? (
            <Select value={location} onValueChange={(value) => { setLocation(value); setPage(1); }}>
              <SelectTrigger className="h-9 w-[190px] text-xs" aria-label="Location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setType("all"); setState("all"); setClient("all"); setLocation("all"); setSearch(""); setPage(1); }}>
              Reset
            </Button>
          ) : null}
        </div>
        {data.capabilities.canSearch ? (
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search reports"
            aria-label="Search reports"
            className="h-9 w-full text-sm lg:w-64"
          />
        ) : null}
      </div>

      <Panel
        title="Generated reports"
        description={`${generated.length.toLocaleString()} of ${data.reports.length.toLocaleString()} reports`}
      >
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No reports match the current filters.</p>
        ) : (
          <div className="-mx-4">
            <div className="hidden md:block">
            <TableScroll minWidth={1120} label="Reports">
              <TableHead>
                <SortableTh label="Report" value="name" active={sort} order={order} onSort={toggleSort} className="min-w-[240px]" />
                <SortableTh label="Type" value="type" active={sort} order={order} onSort={toggleSort} />
                {isAgency ? <Th>Client</Th> : null}
                <Th>Location</Th>
                <Th>Period</Th>
                <SortableTh label="Status" value="state" active={sort} order={order} onSort={toggleSort} />
                <SortableTh label="Generated" value="generatedAt" active={sort} order={order} onSort={toggleSort} />
                <Th align="right" className="w-14">Actions</Th>
              </TableHead>
              <TableBody>
                {visible.map((report) => (
                  <TableRow key={report.id}>
                    <td className={tdClass}>
                      <span className="font-medium text-foreground">{report.name}</span>
                      {report.failureReason ? <span className="block text-xs text-critical">{report.failureReason}</span> : null}
                    </td>
                    <td className={tdMutedClass}>{REPORT_TYPE_LABEL[report.type]}</td>
                    {isAgency ? <td className={tdMutedClass}>{report.clientName ?? "—"}</td> : null}
                    <td className={tdMutedClass}>{report.locationName ?? "—"}</td>
                    <td className={tdMutedClass}>{report.period ?? "—"}</td>
                    <td className={tdClass}><StatusBadge tone={stateTone[report.state]}>{REPORT_STATE_LABEL[report.state]}</StatusBadge></td>
                    <td className={tdMutedClass}>{report.generatedAt ?? report.createdAt ?? "—"}</td>
                    <td className={tdClass}>
                      <div className="flex justify-end">
                        <ReportRowMenu report={report} data={data} onDelete={() => setConfirmDelete(report)} />
                      </div>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {visible.map((report) => (
                <li key={report.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{report.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{REPORT_TYPE_LABEL[report.type]}</p>
                    </div>
                    <StatusBadge tone={stateTone[report.state]}>{REPORT_STATE_LABEL[report.state]}</StatusBadge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {isAgency ? (
                      <div><dt className="text-muted-foreground">Client</dt><dd className="text-foreground">{report.clientName ?? "—"}</dd></div>
                    ) : null}
                    <div><dt className="text-muted-foreground">Location</dt><dd className="text-foreground">{report.locationName ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Period</dt><dd className="text-foreground">{report.period ?? "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Generated</dt><dd className="text-foreground">{report.generatedAt ?? report.createdAt ?? "—"}</dd></div>
                  </dl>
                  {report.failureReason ? <p className="mt-1 text-xs text-critical">{report.failureReason}</p> : null}
                  <div className="mt-2">
                    <ReportActions report={report} data={data} onDelete={() => setConfirmDelete(report)} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {visible.length > 0 ? (
          <div className="-mx-4 -mb-4 mt-4">
            <TablePagination
              page={current}
              pageCount={totalPages}
              totalItems={generated.length}
              pageSize={REPORTS_PAGE_SIZE}
              itemLabel="reports"
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </Panel>

      {data.capabilities.canSchedule && scheduled.length > 0 ? (
        <section aria-labelledby="scheduled-reports">
          <SectionHeader title="Scheduled reports" description="Configured for future generation and delivery" />
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
            {scheduled.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{report.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {REPORT_TYPE_LABEL[report.type]}
                    {report.locationName ? ` · ${report.locationName}` : ""}
                    {report.scheduleSummary ? ` · ${report.scheduleSummary}` : ""}
                    {report.scheduledFor ? ` · Next ${report.scheduledFor}` : ""}
                  </p>
                </div>
                <ReportActions report={report} data={data} onDelete={() => setConfirmDelete(report)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This report and any generated file will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmDelete(null)}>Delete report</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReportRowMenu({ report, data, onDelete }: { report: ReportRow; data: ReportsData; onDelete: () => void }) {
  const { capabilities } = data;
  return (
    <RowActions label={`Actions for ${report.name}`}>
      {capabilities.canView && report.previewUrl ? (
        <DropdownMenuItem asChild><a href={report.previewUrl}>View report</a></DropdownMenuItem>
      ) : null}
      {capabilities.canDownload && report.downloadUrl ? (
        <DropdownMenuItem asChild><a href={report.downloadUrl}>Download</a></DropdownMenuItem>
      ) : null}
      {capabilities.canEdit ? <DropdownMenuItem>Edit</DropdownMenuItem> : null}
      {capabilities.canDuplicate ? <DropdownMenuItem>Duplicate</DropdownMenuItem> : null}
      {capabilities.canSchedule ? <DropdownMenuItem>Schedule</DropdownMenuItem> : null}
      {capabilities.canDelete ? (
        <DropdownMenuItem className="text-critical focus:text-critical" onSelect={onDelete}>Delete</DropdownMenuItem>
      ) : null}
    </RowActions>
  );
}

function ReportActions({ report, data, onDelete }: { report: ReportRow; data: ReportsData; onDelete: () => void }) {
  const { capabilities } = data;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {capabilities.canView && report.previewUrl ? (
        <Button asChild variant="outline" size="sm"><a href={report.previewUrl}>View</a></Button>
      ) : null}
      {capabilities.canDownload && report.downloadUrl ? (
        <Button asChild variant="ghost" size="sm"><a href={report.downloadUrl}>Download</a></Button>
      ) : null}
      {capabilities.canEdit ? <Button variant="ghost" size="sm">Edit</Button> : null}
      {capabilities.canDuplicate ? <Button variant="ghost" size="sm">Duplicate</Button> : null}
      {capabilities.canSchedule ? <Button variant="ghost" size="sm">Schedule</Button> : null}
      {capabilities.canDelete ? (
        <Button variant="ghost" size="sm" className={cn("text-critical hover:text-critical")} onClick={onDelete}>Delete</Button>
      ) : null}
    </div>
  );
}

