import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Play, Search } from "lucide-react";
import { toast } from "sonner";
import { MetricCard, Panel, SectionHeader, StatusBadge } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NoAutomationsEmpty, NoResultsEmpty } from "@/components/mypageseo/empty-states";
import {
  AUTOMATION_RUN_LABEL,
  AUTOMATION_RUN_TONE,
  AUTOMATION_STATUS_LABEL,
  AUTOMATION_STATUS_TONE,
  AUTOMATION_TYPE_DESCRIPTION,
  AUTOMATION_TYPE_LABEL,
  AUTOMATIONS_PAGE_SIZE,
  formatAutomationDate,
  type Automation,
  type AutomationStatus,
  type AutomationType,
  type AutomationsCapabilities,
  type AutomationsData,
} from "@/lib/mypageseo/automations";

type SortKey = "name" | "status" | "lastRun" | "nextRun";

type PendingAction = { kind: "delete"; automation: Automation };

export function AutomationsContent({
  data,
  accountType,
  onRetry,
}: {
  data: AutomationsData;
  accountType: "business" | "agency";
  onRetry: () => void;
}) {
  const showClient = accountType === "agency";

  const [overrides, setOverrides] = useState<Record<string, Partial<Automation>>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  const [extra, setExtra] = useState<Automation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AutomationType>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Automation | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const automations = useMemo(
    () =>
      [...data.automations, ...extra]
        .filter((automation) => !removed.includes(automation.id))
        .map((automation) => ({ ...automation, ...(overrides[automation.id] ?? {}) })),
    [data.automations, extra, removed, overrides],
  );

  const clients = useMemo(() => {
    const seen = new Map<string, string>();
    automations.forEach((a) => {
      if (a.clientId) seen.set(a.clientId, a.clientName ?? a.clientId);
    });
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [automations]);

  const locations = useMemo(() => {
    const seen = new Map<string, string>();
    automations.forEach((a) => {
      if (a.locationId) seen.set(a.locationId, a.locationName ?? a.locationId);
    });
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [automations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = automations.filter((automation) => {
      if (statusFilter !== "all" && automation.status !== statusFilter) return false;
      if (typeFilter !== "all" && automation.type !== typeFilter) return false;
      if (showClient && clientFilter !== "all" && automation.clientId !== clientFilter) return false;
      if (locationFilter !== "all" && automation.locationId !== locationFilter) return false;
      if (!q) return true;
      return (
        automation.name.toLowerCase().includes(q) ||
        (automation.locationName ?? "").toLowerCase().includes(q) ||
        (automation.clientName ?? "").toLowerCase().includes(q) ||
        AUTOMATION_TYPE_LABEL[automation.type].toLowerCase().includes(q)
      );
    });
    const time = (value: string | null) => (value ? new Date(value).getTime() : 0);
    return [...rows].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "lastRun") return time(b.lastRunAt) - time(a.lastRunAt);
      return time(a.nextRunAt || "9999-12-31") - time(b.nextRunAt || "9999-12-31");
    });
  }, [automations, query, statusFilter, typeFilter, clientFilter, locationFilter, showClient, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / AUTOMATIONS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * AUTOMATIONS_PAGE_SIZE, safePage * AUTOMATIONS_PAGE_SIZE);

  const capabilities = data.capabilities;

  const update = (automation: Automation, patch: Partial<Automation>) =>
    setOverrides((current) => ({ ...current, [automation.id]: { ...(current[automation.id] ?? {}), ...patch } }));

  const runNow = (automation: Automation) => {
    setBusyId(automation.id);
    update(automation, { status: "running", lastRunStatus: "running", lastRunSummary: "Run started manually." });
    window.setTimeout(() => {
      setBusyId((id) => (id === automation.id ? null : id));
      update(automation, {
        status: "active",
        lastRunAt: new Date().toISOString(),
        lastRunStatus: "success",
        lastRunSummary: "Manual run completed.",
        failureReason: null,
      });
      toast.success(`${automation.name} finished running`);
    }, 1400);
  };

  const togglePause = (automation: Automation) => {
    const next = automation.status === "paused" ? "active" : "paused";
    update(automation, { status: next });
    toast.success(next === "paused" ? `${automation.name} paused` : `${automation.name} resumed`);
  };

  const createDisabledNote = "Creating automations is not available in this workspace.";

  if (data.status === "loading") {
    return (
      <div className="space-y-6">
        <MetricSkeletonGrid count={4} />
        <Panel title="Automations">
          <TableSkeleton rows={6} columns={showClient ? 7 : 6} />
        </Panel>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <ErrorState
        description="We couldn't load automations for this workspace. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }

  if (data.status === "no_automations" || automations.length === 0) {
    return (
      <NoAutomationsEmpty canCreate={capabilities.canCreate} />
    );
  }

  const total = automations.length;
  const active = automations.filter((a) => a.status === "active").length;
  const paused = automations.filter((a) => a.status === "paused").length;
  const failing = automations.filter((a) => a.status === "failed" || a.lastRunStatus === "failed").length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="automations-summary">
        <SectionHeader
          title="Automation status"
          description={
            showClient
              ? "Recurring tasks running across the client portfolio"
              : "Recurring tasks running across your locations"
          }
        />
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard accent="brand" label="Automations" value={total} caption="Configured in this workspace" />
          <MetricCard accent="green" label="Active" value={active} caption="Running on schedule" />
          <MetricCard accent="amber" label="Paused" value={paused} caption="Not currently running" />
          <MetricCard accent="red" label="Needs attention" value={failing} caption="Failed automation or last run" />
        </div>
      </section>

      <Panel
        title="All automations"
        description={`${filtered.length.toLocaleString()} of ${total.toLocaleString()} automation${total === 1 ? "" : "s"}`}
        actions={
          capabilities.canCreate ? (
            <Button asChild size="sm">
              <Link to="/automations/create">Create automation</Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">{createDisabledNote}</span>
          )
        }
      >
        <div className="flex flex-col gap-2 pb-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search automations"
              className="pl-9"
              aria-label="Search automations"
            />
          </div>

          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value as "all" | AutomationStatus);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All statuses" },
              ...(Object.keys(AUTOMATION_STATUS_LABEL) as AutomationStatus[]).map((status) => ({
                value: status,
                label: AUTOMATION_STATUS_LABEL[status],
              })),
            ]}
          />

          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value as "all" | AutomationType);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All types" },
              ...capabilities.availableTypes.map((type) => ({ value: type, label: AUTOMATION_TYPE_LABEL[type] })),
            ]}
          />

          {showClient && clients.length > 1 ? (
            <FilterSelect
              label="Client"
              value={clientFilter}
              onChange={(value) => {
                setClientFilter(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All clients" },
                ...clients.map((client) => ({ value: client.id, label: client.name })),
              ]}
            />
          ) : null}

          {locations.length > 1 ? (
            <FilterSelect
              label="Location"
              value={locationFilter}
              onChange={(value) => {
                setLocationFilter(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "All locations" },
                ...locations.map((location) => ({ value: location.id, label: location.name })),
              ]}
            />
          ) : null}

          <FilterSelect
            label="Sort"
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={[
              { value: "name", label: "Sort: Name" },
              { value: "status", label: "Sort: Status" },
              { value: "lastRun", label: "Sort: Last run" },
              { value: "nextRun", label: "Sort: Next run" },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <NoResultsEmpty
            className="min-h-40"
            label="automations"
            onClear={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setClientFilter("all");
                  setLocationFilter("all");
                }}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="-mx-4 hidden overflow-x-auto lg:block">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Automation</TableHead>
                    {showClient ? <TableHead>Client</TableHead> : null}
                    <TableHead>Location</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead>Next run</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((automation) => (
                    <TableRow key={automation.id} className="align-top">
                      <TableCell className="pl-4">
                        <button
                          type="button"
                          className="text-left font-medium text-foreground hover:underline"
                          onClick={() => setDetail(automation)}
                        >
                          {automation.name}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {AUTOMATION_TYPE_LABEL[automation.type]}
                        </p>
                      </TableCell>
                      {showClient ? (
                        <TableCell className="text-muted-foreground">{automation.clientName ?? "—"}</TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground">{automation.locationName ?? "All locations"}</TableCell>
                      <TableCell className="text-muted-foreground">{automation.frequency ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge tone={AUTOMATION_STATUS_TONE[automation.status]}>
                          {AUTOMATION_STATUS_LABEL[automation.status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground">{formatAutomationDate(automation.lastRunAt)}</span>
                        {automation.lastRunStatus ? (
                          <p
                            className={
                              automation.lastRunStatus === "failed"
                                ? "mt-0.5 text-xs font-medium text-critical"
                                : "mt-0.5 text-xs text-muted-foreground"
                            }
                          >
                            {AUTOMATION_RUN_LABEL[automation.lastRunStatus]}
                            {automation.failureReason ? ` · ${automation.failureReason}` : ""}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {automation.status === "paused" ? "Paused" : formatAutomationDate(automation.nextRunAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {capabilities.canRunNow ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === automation.id || automation.status === "running"}
                              onClick={() => runNow(automation)}
                            >
                              <Play className="size-3.5" />
                              {busyId === automation.id || automation.status === "running" ? "Running…" : "Run now"}
                            </Button>
                          ) : null}
                          <RowActions
                            automation={automation}
                            capabilities={capabilities}
                            onView={() => setDetail(automation)}
                            onTogglePause={() => togglePause(automation)}
                            onDuplicate={() => {
                              setExtra((current) => [
                                ...current,
                                {
                                  ...automation,
                                  id: `${automation.id}_copy_${current.length + 1}`,
                                  name: `${automation.name} (copy)`,
                                  status: "paused",
                                  lastRunAt: null,
                                  lastRunStatus: null,
                                  lastRunSummary: null,
                                  nextRunAt: null,
                                  failureReason: null,
                                  recentRuns: [],
                                },
                              ]);
                              toast.success(`${automation.name} duplicated as a paused copy`);
                            }}
                            onDelete={() => setPending({ kind: "delete", automation })}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Tablet / mobile rows */}
            <ul className="divide-y divide-border lg:hidden">
              {visible.map((automation) => (
                <li key={automation.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-left text-sm font-medium text-foreground hover:underline"
                        onClick={() => setDetail(automation)}
                      >
                        {automation.name}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {AUTOMATION_TYPE_LABEL[automation.type]}
                        {showClient && automation.clientName ? ` · ${automation.clientName}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {automation.locationName ?? "All locations"}
                      </p>
                    </div>
                    <RowActions
                      automation={automation}
                      capabilities={capabilities}
                      onView={() => setDetail(automation)}
                      onTogglePause={() => togglePause(automation)}
                      onDuplicate={() => {
                        setExtra((current) => [
                          ...current,
                          {
                            ...automation,
                            id: `${automation.id}_copy_${current.length + 1}`,
                            name: `${automation.name} (copy)`,
                            status: "paused",
                            lastRunAt: null,
                            lastRunStatus: null,
                            lastRunSummary: null,
                            nextRunAt: null,
                            failureReason: null,
                            recentRuns: [],
                          },
                        ]);
                        toast.success(`${automation.name} duplicated as a paused copy`);
                      }}
                      onDelete={() => setPending({ kind: "delete", automation })}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge tone={AUTOMATION_STATUS_TONE[automation.status]}>
                      {AUTOMATION_STATUS_LABEL[automation.status]}
                    </StatusBadge>
                    <span>{automation.frequency ?? "—"}</span>
                    <span>Last run {formatAutomationDate(automation.lastRunAt)}</span>
                    <span>
                      Next {automation.status === "paused" ? "—" : formatAutomationDate(automation.nextRunAt)}
                    </span>
                  </div>
                  {automation.lastRunStatus === "failed" ? (
                    <p className="mt-1 text-xs font-medium text-critical">
                      {automation.failureReason ?? AUTOMATION_RUN_LABEL.failed}
                    </p>
                  ) : null}
                  {capabilities.canRunNow ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={busyId === automation.id || automation.status === "running"}
                      onClick={() => runNow(automation)}
                    >
                      {busyId === automation.id || automation.status === "running" ? "Running…" : "Run now"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {pageCount > 1 ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>
                  Page {safePage} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <Panel title="Automation types" description="Recurring work Mypageseo can run for this workspace">
        <ul className="divide-y divide-border">
          {capabilities.availableTypes.map((type) => (
            <li key={type} className="py-2.5">
              <p className="text-sm font-medium text-foreground">{AUTOMATION_TYPE_LABEL[type]}</p>
              <p className="text-xs text-muted-foreground">{AUTOMATION_TYPE_DESCRIPTION[type]}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Dialog open={detail !== null} onOpenChange={(open) => (!open ? setDetail(null) : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              {detail ? AUTOMATION_TYPE_DESCRIPTION[detail.type] : null}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Status" value={AUTOMATION_STATUS_LABEL[detail.status]} />
                <Detail label="Trigger" value={detail.frequency ?? "—"} />
                {showClient ? <Detail label="Client" value={detail.clientName ?? "—"} /> : null}
                <Detail label="Location" value={detail.locationName ?? "All locations"} />
                <Detail label="Last run" value={formatAutomationDate(detail.lastRunAt)} />
                <Detail
                  label="Next run"
                  value={detail.status === "paused" ? "Paused" : formatAutomationDate(detail.nextRunAt)}
                />
              </dl>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent executions
                </p>
                {capabilities.canViewHistory && detail.recentRuns.length > 0 ? (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {detail.recentRuns.map((run) => (
                      <li key={run.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-foreground">{formatAutomationDate(run.startedAt)}</p>
                          {run.summary ? <p className="text-xs text-muted-foreground">{run.summary}</p> : null}
                        </div>
                        <StatusBadge tone={AUTOMATION_RUN_TONE[run.status]}>
                          {AUTOMATION_RUN_LABEL[run.status]}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No executions recorded for this automation yet.</p>
                )}
              </div>

              {detail.locationId ? (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/locations/${detail.locationId}/rankings`}>
                    Open location
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={pending !== null} onOpenChange={(open) => (!open ? setPending(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.automation.name} will stop running and its schedule will be removed. Past executions are not
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pending) return;
                setRemoved((current) => [...current, pending.automation.id]);
                toast.success(`${pending.automation.name} deleted`);
                setPending(null);
              }}
            >
              Delete automation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
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
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="lg:w-[190px]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RowActions({
  automation,
  capabilities,
  onView,
  onTogglePause,
  onDuplicate,
  onDelete,
}: {
  automation: Automation;
  capabilities: AutomationsCapabilities;
  onView: () => void;
  onTogglePause: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${automation.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onView}>View details</DropdownMenuItem>
        {capabilities.canEdit ? (
          <DropdownMenuItem asChild>
            <Link to={`/automations/${automation.id}`}>
              Edit automation
            </Link>
          </DropdownMenuItem>
        ) : null}
        {capabilities.canPause ? (
          <DropdownMenuItem onSelect={onTogglePause}>
            {automation.status === "paused" ? "Resume" : "Pause"}
          </DropdownMenuItem>
        ) : null}
        {capabilities.canDuplicate ? <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem> : null}
        {capabilities.canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-critical focus:text-critical" onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
