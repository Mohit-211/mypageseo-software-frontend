import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, LoaderCircle, Pause, PenLine, Play, Plus, Trash2 } from "lucide-react";
import { createReportSchedule, deleteReportSchedule, updateReportSchedule, type ReportSchedule, type ReportType } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ConfirmDialog, FormTextField } from "@/components/layout/shared/form-fields";
import { TableBody, TableCard, TableHead, TableRow, TableScroll, Th, tdClass } from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import {
  MAX_RECIPIENTS,
  REPORT_RANGES,
  REPORT_TYPES,
  REPORT_TYPES_WITH_PERIOD,
  REPORT_TYPE_LABEL,
  parseRecipients,
  reportRangeLabel,
  type ReportRange,
} from "@/lib/reports/report-meta";
import { SCHEDULES_QUERY_KEY, scheduleErrorText, scheduleLastErrorText, useReportSchedules } from "@/lib/reports/use-report-schedules";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { cn } from "@/lib/utils";
import { ReportTypeIcon } from "./report-type-icon";

/**
 * Monthly emails (report schedules). Each sends a fresh PDF right after a covered location's
 * automatic monthly refresh (not on a fixed date); `next_expected` says when that should be.
 * Listed by the next email first. Pause, resume, edit and delete in place.
 */
export function ReportSchedulesContent({
  clientId,
  locationId,
  onCreate,
}: {
  clientId?: string | null;
  locationId?: string | null;
  onCreate?: () => void;
}) {
  const canEdit = useCanEdit();
  const block = useWriteBlock();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const schedules = useReportSchedules({ ...(clientId ? { client_id: clientId } : {}), ...(locationId ? { location_id: locationId } : {}) });
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReportSchedule | null>(null);
  const [editing, setEditing] = useState<ReportSchedule | null>(null);
  const clientName = (id: string | null) => workspace.clients.find((client) => client.id === id)?.name ?? "Client";

  const run = async (id: string, action: () => Promise<unknown>, success: string, failure: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(scheduleErrorText(err, failure));
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    }
  };

  if (schedules.isPending) return <TableSkeleton rows={3} columns={6} />;
  if (schedules.isError) {
    return <ErrorState compact description="Your monthly emails couldn't be loaded." onRetry={() => void schedules.refetch()} />;
  }
  if (schedules.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        tone="reports"
        title={locationId || clientId ? "No monthly emails here yet" : "No monthly emails yet"}
        description="A monthly email sends a fresh PDF right after a location's automatic monthly refresh, so your client hears from you without you lifting a finger."
        action={
          canEdit && onCreate ? (
            <Button onClick={onCreate} disabled={block.blocked} title={block.reason ?? undefined}>
              <Plus aria-hidden /> Schedule an email
            </Button>
          ) : undefined
        }
      />
    );
  }

  const covers = (schedule: ReportSchedule) => (
    <>
      <span className="block font-semibold text-foreground">
        {schedule.scope === "client" ? clientName(schedule.client_id) : (schedule.locations[0]?.name ?? "Location")}
      </span>
      <span className="block text-xs text-muted-foreground">
        {schedule.scope === "client" ? `Every location (${schedule.locations.length}) · one email each` : "One location"}
      </span>
    </>
  );
  const report = (schedule: ReportSchedule) => (
    <span className="flex items-center gap-2">
      <ReportTypeIcon type={schedule.type} className="size-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-foreground">{REPORT_TYPE_LABEL[schedule.type] ?? schedule.type}</span>
        {schedule.range && REPORT_TYPES_WITH_PERIOD.includes(schedule.type) ? (
          <span className="block text-xs text-muted-foreground">{reportRangeLabel(schedule.range)}</span>
        ) : null}
      </span>
    </span>
  );
  const recipients = (schedule: ReportSchedule) => {
    const more = schedule.recipients.length - 1;
    return (
      <span className="block min-w-0 text-xs text-foreground" title={schedule.recipients.join(", ")}>
        <span className="block truncate">{schedule.recipients[0]}</span>
        {more > 0 ? <span className="text-muted-foreground">and {more} more</span> : null}
      </span>
    );
  };
  // Status lives with the next email: an active one has a date, a paused one says so.
  const nextEmail = (schedule: ReportSchedule) =>
    schedule.status === "active" ? (
      <span className="flex items-start gap-2">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-success" />
        <span className="min-w-0">
          <span className="block whitespace-nowrap font-medium text-foreground">{schedule.next_expected ? formatDate(schedule.next_expected) : "After the next refresh"}</span>
          <span className="block whitespace-nowrap text-xs text-muted-foreground">Active</span>
        </span>
      </span>
    ) : (
      <StatusBadge tone="neutral" icon={Pause}>
        Paused
      </StatusBadge>
    );
  const lastSent = (schedule: ReportSchedule, label = false) => (
    <>
      <span className="block whitespace-nowrap text-xs text-muted-foreground">
        {schedule.last_sent_at ? `${label ? "Last sent " : ""}${formatDateTime(schedule.last_sent_at)}` : "Not sent yet"}
      </span>
      {schedule.last_error ? (
        <span className="mt-1 flex max-w-64 items-start gap-1 text-xs font-medium text-critical">
          <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>Last email failed: {scheduleLastErrorText(schedule.last_error)}</span>
        </span>
      ) : null}
    </>
  );
  const actions = (schedule: ReportSchedule) => {
    const active = schedule.status === "active";
    return (
      <div className="flex items-center justify-end gap-1" title={block.reason ?? undefined}>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy !== null || block.blocked}
          onClick={() =>
            void run(
              schedule.schedule_id,
              () => updateReportSchedule(schedule.schedule_id, { status: active ? "paused" : "active" }),
              active ? "Paused. No emails until you resume it." : "Resumed. The next email goes after the next refresh.",
              active ? "The email couldn't be paused. Try again." : "The email couldn't be resumed. Try again.",
            )
          }
        >
          {busy === schedule.schedule_id ? <LoaderCircle aria-hidden className="animate-spin" /> : active ? <Pause aria-hidden /> : <Play aria-hidden />}
          {active ? "Pause" : "Resume"}
        </Button>
        <Button size="icon" variant="ghost" className="size-9" aria-label="Edit this monthly email" disabled={busy !== null || block.blocked} onClick={() => setEditing(schedule)}>
          <PenLine aria-hidden />
        </Button>
        <Button size="icon" variant="ghost" className="size-9 text-critical hover:text-critical" aria-label="Delete this monthly email" disabled={busy !== null} onClick={() => setDeleting(schedule)}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    );
  };

  return (
    <TableCard>
      {/* Phones: one card per email. */}
      <ul className="divide-y divide-border md:hidden">
        {schedules.data.map((schedule) => (
          <li key={schedule.schedule_id} className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{covers(schedule)}</div>
              <div className="shrink-0">{nextEmail(schedule)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {report(schedule)}
              {recipients(schedule)}
            </div>
            <div>{lastSent(schedule, true)}</div>
            {canEdit ? <div className="border-t border-border pt-2">{actions(schedule)}</div> : null}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <TableScroll minWidth={canEdit ? 940 : 760} label="Monthly emails">
          <TableHead>
            <Th>Covers</Th>
            <Th>Report</Th>
            <Th>Recipients</Th>
            <Th>Next email</Th>
            <Th>Last sent</Th>
            {canEdit ? (
              <Th srOnly className="w-44">
                Actions
              </Th>
            ) : null}
          </TableHead>
          <TableBody>
            {schedules.data.map((schedule) => (
              <TableRow key={schedule.schedule_id}>
                <td className={cn(tdClass, "min-w-44")}>{covers(schedule)}</td>
                <td className={tdClass}>{report(schedule)}</td>
                <td className={cn(tdClass, "max-w-56")}>{recipients(schedule)}</td>
                <td className={tdClass}>{nextEmail(schedule)}</td>
                <td className={tdClass}>{lastSent(schedule)}</td>
                {canEdit ? <td className={cn(tdClass, "text-right")}>{actions(schedule)}</td> : null}
              </TableRow>
            ))}
          </TableBody>
        </TableScroll>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title="Delete this monthly email?"
        description="No more emails go out for it. Reports already sent stay in your PDF reports."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void run(target.schedule_id, () => deleteReportSchedule(target.schedule_id), "Monthly email deleted.", "The email couldn't be deleted. Try again.");
        }}
      />
      {editing ? <ScheduleReportDialog schedule={editing} onClose={() => setEditing(null)} /> : null}
    </TableCard>
  );
}

/**
 * Create a monthly email for a location or (agency) every location of a client, or edit one
 * (`schedule`): what it covers stays; the report, period and recipients can change.
 */
export function ScheduleReportDialog({
  onClose,
  defaultClientId,
  defaultLocationId,
  schedule,
}: {
  onClose: () => void;
  defaultClientId?: string | null | undefined;
  defaultLocationId?: string | null | undefined;
  schedule?: ReportSchedule;
}) {
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const block = useWriteBlock();
  const agency = workspace.organization?.accountType === "agency";
  const editing = Boolean(schedule);
  const [scope, setScope] = useState<"location" | "client">(schedule?.scope ?? (defaultClientId && !defaultLocationId ? "client" : "location"));
  const [locationId, setLocationId] = useState(
    schedule?.location_id ??
      (defaultLocationId && workspace.locations.some((entry) => entry.id === defaultLocationId) ? defaultLocationId : null) ??
      (defaultClientId ? workspace.locations.find((entry) => entry.clientId === defaultClientId)?.id : null) ??
      workspace.activeLocation?.id ??
      workspace.locations[0]?.id ??
      "",
  );
  const [clientId, setClientId] = useState(schedule?.client_id ?? defaultClientId ?? workspace.clients[0]?.id ?? "");
  const [type, setType] = useState<ReportType>(schedule?.type ?? "rank_tracker");
  const [range, setRange] = useState<ReportRange>((schedule?.range as ReportRange | null) ?? "28d");
  const [recipients, setRecipients] = useState(schedule?.recipients.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseRecipients(recipients);
  const withPeriod = REPORT_TYPES_WITH_PERIOD.includes(type);
  const coversLabel = schedule
    ? schedule.scope === "client"
      ? `${workspace.clients.find((client) => client.id === schedule.client_id)?.name ?? "A client"}: every location`
      : (schedule.locations[0]?.name ?? "One location")
    : null;

  const save = async () => {
    if (saving) return;
    setTried(true);
    if (parsed.error) return;
    setSaving(true);
    setError(null);
    try {
      if (schedule) {
        await updateReportSchedule(schedule.schedule_id, { type, recipients: parsed.recipients, ...(withPeriod ? { range } : {}) });
        toast.success("Monthly email saved.");
      } else {
        await createReportSchedule({
          scope,
          ...(scope === "location" ? { location_id: locationId } : { client_id: clientId }),
          type,
          ...(withPeriod ? { range } : {}),
          recipients: parsed.recipients,
        });
        toast.success("Scheduled. The report is emailed after each monthly refresh.");
      }
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
      onClose();
    } catch (err) {
      setError(scheduleErrorText(err, "The monthly email couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit monthly email" : "Schedule a monthly email"}</DialogTitle>
          <DialogDescription>
            A fresh PDF is emailed right after each covered location's automatic monthly refresh, not on a fixed date.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {coversLabel ? (
            <div className="rounded-lg border border-border bg-surface-strong px-3.5 py-2.5 text-sm">
              <span className="text-muted-foreground">Covers </span>
              <span className="font-medium text-foreground">{coversLabel}</span>
            </div>
          ) : (
            <>
              {agency && workspace.clients.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">Covers</p>
                  <SegmentedControl
                    size="sm"
                    aria-label="Covers"
                    value={scope}
                    onValueChange={setScope}
                    options={[
                      { value: "location", label: "One location" },
                      { value: "client", label: "Every location of a client" },
                    ]}
                  />
                </div>
              ) : null}
              {scope === "location" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-location">Location</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger id="schedule-location" className="w-full">
                      <SelectValue placeholder="Choose a location" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {workspace.locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.businessName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-client">Client</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger id="schedule-client" className="w-full">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {workspace.clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">One email per location, each after its own refresh.</p>
                </div>
              )}
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="schedule-type">Report</Label>
            <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
              <SelectTrigger id="schedule-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {withPeriod ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Period</p>
              <SegmentedControl size="sm" aria-label="Period" value={range} onValueChange={setRange} options={REPORT_RANGES} />
            </div>
          ) : null}
          <FormTextField
            id="schedule-recipients"
            label="Recipients"
            value={recipients}
            onChange={setRecipients}
            placeholder="owner@example.com, manager@example.com"
            inputMode="email"
            autoComplete="off"
            error={tried ? parsed.error : null}
            hint={`Separate addresses with commas. Up to ${MAX_RECIPIENTS}.`}
          />
          {error ? (
            <p role="alert" className="text-sm font-medium text-critical">
              {error}
            </p>
          ) : block.reason ? (
            <p className="text-sm text-muted-foreground">{block.reason}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || block.blocked || (!editing && (scope === "location" ? !locationId : !clientId))}
            aria-busy={saving || undefined}
            onClick={() => void save()}
          >
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <CalendarClock aria-hidden />} {editing ? "Save changes" : "Schedule email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
