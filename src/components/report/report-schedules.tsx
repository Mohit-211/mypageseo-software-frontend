import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SCHEDULES_QUERY_KEY, useReportSchedules } from "@/lib/reports/use-report-schedules";
import { toast } from "sonner";
import { CalendarClock, LoaderCircle, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  createReportSchedule,
  deleteReportSchedule,
  isApiError,
  updateReportSchedule,
  type ReportSchedule,
  type ReportType,
} from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { REPORT_TYPES, REPORT_TYPE_LABEL } from "@/lib/reports/report-meta";

const SCHEDULE_ERRORS: Record<string, string> = {
  manual_only: "This location doesn't refresh automatically, so there's nothing to send after.",
  gbp_not_connected: "A GBP Audit schedule needs the location connected to Google.",
  agency_only: "Client schedules are for agency accounts.",
  no_citations_yet: "This location has no citation list yet.",
  no_reviews: "This location has no stored reviews yet.",
};

/**
 * Monthly report schedules. They send after each covered location's automatic monthly
 * refresh (not on a fixed date); `next_expected` says when that should be.
 */
export function ReportSchedulesContent({ clientId, onCreate }: { clientId?: string; onCreate?: () => void }) {
  const canEdit = useCanEdit();
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const schedules = useReportSchedules(clientId ? { client_id: clientId } : {});
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReportSchedule | null>(null);
  const clientName = (id: string | null) => workspace.clients.find((client) => client.id === id)?.name ?? "Client";

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("That didn't work. Try again.");
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    }
  };

  if (schedules.isPending) return <TableSkeleton rows={3} columns={5} />;
  if (schedules.isError) return <ErrorState description="Scheduled reports couldn't be loaded." onRetry={() => void schedules.refetch()} />;
  if (schedules.data.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No scheduled reports"
        description="A schedule emails a report every month, right after the location's automatic monthly refresh."
        action={canEdit && onCreate ? <Button size="sm" onClick={onCreate}><Plus aria-hidden /> Schedule a report</Button> : undefined}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-surface-strong text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Covers</th>
            <th className="px-3 py-2.5 font-medium">Report</th>
            <th className="px-3 py-2.5 font-medium">Recipients</th>
            <th className="px-3 py-2.5 font-medium">Next expected</th>
            <th className="px-3 py-2.5 font-medium">Last sent</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            {canEdit ? <th className="px-3 py-2.5" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {schedules.data.map((schedule) => (
            <tr key={schedule.schedule_id}>
              <td className="px-4 py-3">
                <span className="block font-medium text-foreground">
                  {schedule.scope === "client" ? clientName(schedule.client_id) : (schedule.locations[0]?.name ?? "Location")}
                </span>
                {schedule.scope === "client" ? (
                  <span className="text-xs text-muted-foreground">{schedule.locations.length} location{schedule.locations.length === 1 ? "" : "s"} · one email each</span>
                ) : null}
              </td>
              <td className="px-3 py-3">
                {REPORT_TYPE_LABEL[schedule.type] ?? schedule.type}
                {schedule.range ? <span className="block text-xs text-muted-foreground">Period: {schedule.range}</span> : null}
              </td>
              <td className="px-3 py-3 text-xs text-muted-foreground">{schedule.recipients.join(", ")}</td>
              <td className="px-3 py-3 text-xs">{schedule.status === "active" && schedule.next_expected ? `After the refresh around ${formatDate(schedule.next_expected)}` : "—"}</td>
              <td className="px-3 py-3 text-xs">
                {schedule.last_sent_at ? formatDateTime(schedule.last_sent_at) : "Not yet"}
                {schedule.last_error ? <span className="block text-critical">{schedule.last_error}</span> : null}
              </td>
              <td className="px-3 py-3"><StatusBadge tone={schedule.status === "active" ? "success" : "neutral"}>{schedule.status === "active" ? "Active" : "Paused"}</StatusBadge></td>
              {canEdit ? (
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() =>
                        void run(
                          schedule.schedule_id,
                          () => updateReportSchedule(schedule.schedule_id, { status: schedule.status === "active" ? "paused" : "active" }),
                          schedule.status === "active" ? "Paused." : "Resumed.",
                        )
                      }
                    >
                      {busy === schedule.schedule_id ? <LoaderCircle aria-hidden className="animate-spin" /> : schedule.status === "active" ? <Pause aria-hidden /> : <Play aria-hidden />}
                      {schedule.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 text-critical" aria-label="Delete schedule" onClick={() => setDeleting(schedule)}>
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title="Delete this schedule?"
        description="No more reports are emailed for it. Reports already sent stay in the library."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void run(target.schedule_id, () => deleteReportSchedule(target.schedule_id), "Schedule deleted.");
        }}
      />
    </div>
  );
}

/** Create a monthly schedule for a location or (agency) a client. */
export function ScheduleReportDialog({ onClose, defaultClientId }: { onClose: () => void; defaultClientId?: string }) {
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const agency = workspace.organization?.accountType === "agency";
  const [scope, setScope] = useState<"location" | "client">(defaultClientId ? "client" : "location");
  const [locationId, setLocationId] = useState(workspace.activeLocation?.id ?? workspace.locations[0]?.id ?? "");
  const [clientId, setClientId] = useState(defaultClientId ?? workspace.clients[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("rank_tracker");
  const [range, setRange] = useState<"28d" | "90d" | "12m">("28d");
  const [recipients, setRecipients] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const list = recipients.split(/[,;\s]+/).map((value) => value.trim()).filter(Boolean);
    if (list.length === 0 || list.some((value) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))) {
      setError("Enter one or more valid email addresses, separated by commas.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createReportSchedule({
        scope,
        ...(scope === "location" ? { location_id: locationId } : { client_id: clientId }),
        type,
        range,
        recipients: list,
      });
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
      toast.success("Scheduled. The report is emailed after each monthly refresh.");
      onClose();
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      setError((reason && SCHEDULE_ERRORS[reason]) ?? (isApiError(err) && err.status === 400 && err.message ? err.message : "The schedule couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a report</DialogTitle>
          <DialogDescription>Monthly: the report is emailed right after each covered location's automatic monthly refresh, not on a fixed date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {agency && workspace.clients.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Covers</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as "location" | "client")}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="location">One location</SelectItem>
                  <SelectItem value="client">Every location of a client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {scope === "location" ? (
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                <SelectContent>{workspace.locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.businessName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Choose a client" /></SelectTrigger>
                <SelectContent>{workspace.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-1.5">
              <Label>Report</Label>
              <Select value={type} onValueChange={(value) => setType(value as ReportType)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{REPORT_TYPES.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={range} onValueChange={(value) => setRange(value as "28d" | "90d" | "12m")}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="28d">28 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="12m">12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-recipients">Recipients</Label>
            <Input id="schedule-recipients" placeholder="owner@example.com, manager@example.com" value={recipients} onChange={(event) => setRecipients(event.target.value)} />
          </div>
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || (scope === "location" ? !locationId : !clientId)} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
