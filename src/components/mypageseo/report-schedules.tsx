import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Panel, StatusBadge, type StatusTone } from "@/components/layout/shared/data-display";
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
  REPORT_TYPE_LABEL,
  SCHEDULES_PAGE_SIZE,
  SCHEDULE_RUN_STATUS_LABEL,
  SCHEDULE_STATUS_LABEL,
  type ReportSchedule,
  type ReportType,
  type ScheduleStatus,
  type SchedulesData,
} from "@/lib/mypageseo/reports";

const statusTone: Record<ScheduleStatus, StatusTone> = {
  active: "success",
  paused: "neutral",
  failed: "critical",
};

type SortKey = "name" | "type" | "frequency" | "nextRunAt" | "status";

export function ReportSchedulesContent({
  data,
  isAgency,
  onRetry,
}: {
  data: SchedulesData;
  isAgency: boolean;
  onRetry: () => void;
}) {
  const [type, setType] = useState<"all" | ReportType>("all");
  const [status, setStatus] = useState<"all" | ScheduleStatus>("all");
  const [client, setClient] = useState("all");
  const [location, setLocation] = useState("all");
  const [frequency, setFrequency] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("nextRunAt");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<ReportSchedule | null>(null);

  const clients = useMemo(
    () =>
      Array.from(
        new Map(
          data.schedules.filter((s) => s.clientId && s.clientName).map((s) => [s.clientId!, s.clientName!]),
        ).entries(),
      ),
    [data.schedules],
  );
  const locations = useMemo(
    () =>
      Array.from(
        new Map(
          data.schedules.filter((s) => s.locationId && s.locationName).map((s) => [s.locationId!, s.locationName!]),
        ).entries(),
      ),
    [data.schedules],
  );

  const filtered = useMemo(() => {
    const rows = data.schedules.filter((schedule) => {
      if (type !== "all" && schedule.type !== type) return false;
      if (status !== "all" && schedule.status !== status) return false;
      if (isAgency && client !== "all" && schedule.clientId !== client) return false;
      if (location !== "all" && schedule.locationId !== location) return false;
      if (frequency !== "all" && schedule.frequency !== frequency) return false;
      if (data.capabilities.canSearch && search.trim()) {
        if (!schedule.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => {
      const direction = descending ? -1 : 1;
      if (sort === "name") return a.name.localeCompare(b.name) * direction;
      if (sort === "type") return a.type.localeCompare(b.type) * direction;
      if (sort === "status") return a.status.localeCompare(b.status) * direction;
      if (sort === "frequency") return ((a.frequency ?? "").localeCompare(b.frequency ?? "")) * direction;
      return ((a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? "")) * direction;
    });
  }, [data.schedules, data.capabilities.canSearch, type, status, client, location, frequency, search, sort, descending, isAgency]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / SCHEDULES_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * SCHEDULES_PAGE_SIZE, current * SCHEDULES_PAGE_SIZE);
  const hasFilters =
    type !== "all" || status !== "all" || client !== "all" || location !== "all" || frequency !== "all" || search.trim() !== "";

  if (data.status === "loading") {
    return (
      <div role="status" aria-live="polite" aria-label="Loading scheduled reports">
        <TableSkeleton rows={6} columns={6} />
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <ErrorState
        title="Scheduled reports could not be loaded"
        description="We couldn't load your report schedules. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }

  if (data.status === "no_schedules" || data.schedules.length === 0) {
    return (
      <EmptyState
        title="No report schedules exist yet"
        description="A schedule runs a report on a recurring basis and delivers the result without anyone re-running it manually. Recurring report generation and delivery are not available in the current product integration, so no schedules can be created yet."
        className="min-h-64"
        action={
          <Button asChild variant="outline">
            <Link to="/reports">Back to reports</Link>
          </Button>
        }
      />
    );
  }

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDescending((value) => !value);
    else {
      setSort(key);
      setDescending(false);
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          {data.capabilities.canSearch ? (
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search schedules"
              className="h-9 w-full sm:w-56"
              aria-label="Search schedules"
            />
          ) : null}
          <FilterSelect
            label="Report type"
            value={type}
            onChange={(value) => {
              setType(value as "all" | ReportType);
              setPage(1);
            }}
            options={[["all", "All types"], ...(Object.keys(REPORT_TYPE_LABEL) as ReportType[]).map((value) => [value, REPORT_TYPE_LABEL[value]] as [string, string])]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value as "all" | ScheduleStatus);
              setPage(1);
            }}
            options={[["all", "All statuses"], ...(Object.keys(SCHEDULE_STATUS_LABEL) as ScheduleStatus[]).map((value) => [value, SCHEDULE_STATUS_LABEL[value]] as [string, string])]}
          />
          {data.capabilities.frequencies.length > 0 ? (
            <FilterSelect
              label="Frequency"
              value={frequency}
              onChange={(value) => {
                setFrequency(value);
                setPage(1);
              }}
              options={[["all", "All frequencies"], ...data.capabilities.frequencies.map((f) => [f.value, f.label] as [string, string])]}
            />
          ) : null}
          {isAgency && clients.length > 0 ? (
            <FilterSelect
              label="Client"
              value={client}
              onChange={(value) => {
                setClient(value);
                setPage(1);
              }}
              options={[["all", "All clients"], ...clients.map(([id, name]) => [id, name] as [string, string])]}
            />
          ) : null}
          {locations.length > 0 ? (
            <FilterSelect
              label="Location"
              value={location}
              onChange={(value) => {
                setLocation(value);
                setPage(1);
              }}
              options={[["all", "All locations"], ...locations.map(([id, name]) => [id, name] as [string, string])]}
            />
          ) : null}
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setType("all");
                setStatus("all");
                setClient("all");
                setLocation("all");
                setFrequency("all");
                setSearch("");
                setPage(1);
              }}
            >
              Reset
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} schedule{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState title="No schedules match these filters" description="Adjust or reset the filters to see more schedules." />
      ) : (
        <>
          <Panel className="hidden md:block">
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <SortableHeader label="Report" active={sort === "name"} descending={descending} onClick={() => toggleSort("name")} />
                    <SortableHeader label="Type" active={sort === "type"} descending={descending} onClick={() => toggleSort("type")} />
                    {isAgency ? <th className="px-4 py-2 font-medium">Client</th> : null}
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Period</th>
                    <SortableHeader label="Frequency" active={sort === "frequency"} descending={descending} onClick={() => toggleSort("frequency")} />
                    <SortableHeader label="Next run" active={sort === "nextRunAt"} descending={descending} onClick={() => toggleSort("nextRunAt")} />
                    <th className="px-4 py-2 font-medium">Last run</th>
                    <th className="px-4 py-2 font-medium">Delivery</th>
                    <SortableHeader label="Status" active={sort === "status"} descending={descending} onClick={() => toggleSort("status")} />
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-border last:border-b-0 align-top">
                      <td className="px-4 py-3 font-medium text-foreground">{schedule.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{REPORT_TYPE_LABEL[schedule.type]}</td>
                      {isAgency ? <td className="px-4 py-3 text-muted-foreground">{schedule.clientName ?? "—"}</td> : null}
                      <td className="px-4 py-3 text-muted-foreground">{schedule.locationName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{schedule.period ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{schedule.frequency ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{schedule.nextRunAt ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {schedule.lastRunAt ? (
                          <span>
                            {schedule.lastRunAt}
                            {schedule.lastRunStatus ? ` · ${SCHEDULE_RUN_STATUS_LABEL[schedule.lastRunStatus]}` : ""}
                          </span>
                        ) : (
                          "Not run yet"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{schedule.delivery ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTone[schedule.status]}>{SCHEDULE_STATUS_LABEL[schedule.status]}</StatusBadge>
                        {schedule.failureReason ? (
                          <p className="mt-1 text-xs text-critical">{schedule.failureReason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <ScheduleActions data={data} schedule={schedule} onDelete={setConfirmDelete} align="end" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="space-y-3 md:hidden">
            {visible.map((schedule) => (
              <Panel key={schedule.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{schedule.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {REPORT_TYPE_LABEL[schedule.type]}
                      {isAgency && schedule.clientName ? ` · ${schedule.clientName}` : ""}
                      {schedule.locationName ? ` · ${schedule.locationName}` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone[schedule.status]}>{SCHEDULE_STATUS_LABEL[schedule.status]}</StatusBadge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <Detail label="Frequency" value={schedule.frequency} />
                  <Detail label="Next run" value={schedule.nextRunAt} />
                  <Detail label="Period" value={schedule.period} />
                  <Detail
                    label="Last run"
                    value={
                      schedule.lastRunAt
                        ? `${schedule.lastRunAt}${schedule.lastRunStatus ? ` · ${SCHEDULE_RUN_STATUS_LABEL[schedule.lastRunStatus]}` : ""}`
                        : "Not run yet"
                    }
                  />
                  <Detail label="Delivery" value={schedule.delivery} />
                </dl>
                {schedule.failureReason ? <p className="mt-2 text-xs text-critical">{schedule.failureReason}</p> : null}
                <div className="mt-3">
                  <ScheduleActions data={data} schedule={schedule} onDelete={setConfirmDelete} align="start" />
                </div>
              </Panel>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {current} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={current === totalPages} onClick={() => setPage(current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `"${confirmDelete.name}" will stop running and will no longer deliver reports. Previously generated reports are unaffected.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(null);
                toast.error("Deleting a schedule is not available in the current product integration.");
              }}
            >
              Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  descending,
  onClick,
}: {
  label: string;
  active: boolean;
  descending: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2 font-medium">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? <span aria-hidden>{descending ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full sm:w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Only renders operations the backend declares as supported. */
function ScheduleActions({
  data,
  schedule,
  onDelete,
  align,
}: {
  data: SchedulesData;
  schedule: ReportSchedule;
  onDelete: (schedule: ReportSchedule) => void;
  align: "start" | "end";
}) {
  const { capabilities } = data;
  const hasAny =
    capabilities.canEdit ||
    capabilities.canPause ||
    capabilities.canRunNow ||
    capabilities.canDelete ||
    schedule.lastRunReportId !== null;

  if (!hasAny) {
    return <p className="text-xs text-muted-foreground">No actions available</p>;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}>
      {schedule.lastRunReportId ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/reports/${schedule.lastRunReportId}`}>
            View report
          </Link>
        </Button>
      ) : null}
      {capabilities.canRunNow ? (
        <Button variant="outline" size="sm">
          Run now
        </Button>
      ) : null}
      {capabilities.canPause ? (
        <Button variant="outline" size="sm">
          {schedule.status === "paused" ? "Resume" : "Pause"}
        </Button>
      ) : null}
      {capabilities.canEdit ? (
        <Button variant="outline" size="sm">
          Edit
        </Button>
      ) : null}
      {capabilities.canDelete ? (
        <Button variant="ghost" size="sm" className="text-critical" onClick={() => onDelete(schedule)}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}

