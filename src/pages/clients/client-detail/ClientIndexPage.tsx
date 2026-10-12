import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Link2Off, LoaderCircle, MapPinPlus, Pencil, Plus, UserPlus } from "lucide-react";
import { assignClientLocation, getClient, getMembers, isApiError, unassignClientLocation } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { ReportsList } from "@/components/report/reports-list";
import { ReportSchedulesContent, ScheduleReportDialog } from "@/components/report/report-schedules";
import { InviteDialog } from "@/components/team/invite-dialog";
import { TEAM_KEY } from "@/lib/team/team";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useRequiredParams } from "@/hooks/use-required-params";
import { avgRankText } from "@/lib/rankings/format";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { ClientDialog } from "@/pages/clients/ClientsIndexPage";
import { CLIENTS_KEY, clientErrorText } from "@/lib/clients/clients";

/** One client: its locations, a summary over them, its users, reports and schedules. */
function ClientIndexPage() {
  const { clientId } = useRequiredParams("clientId");
  const access = useAccess();
  const canManage = access.can("clients.manage");
  // Removing a location from a client would hide it from a limited member (400 `client_required`).
  const canUnassign = access.can("clients.admin");
  const canEdit = useCanEdit();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: [...CLIENTS_KEY, "detail", clientId], queryFn: ({ signal }) => getClient(clientId, signal) });
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (detail.isPending) return <AppShell><PageSkeleton /></AppShell>;
  if (detail.isError) {
    return (
      <AppShell>
        {isApiError(detail.error) && detail.error.status === 404 ? (
          <EmptyState title="Client not found" description="It may have been deleted." action={<Button asChild variant="outline"><Link to="/clients"><ArrowLeft aria-hidden /> Back to clients</Link></Button>} />
        ) : (
          <ErrorState description="This client couldn't be loaded." onRetry={() => void detail.refetch()} />
        )}
      </AppShell>
    );
  }
  const { client, locations, summary } = detail.data;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["locations"] });
  };
  const unassign = (locationId: string, name: string) => {
    setBusy(locationId);
    void unassignClientLocation(client.client_id, locationId)
      .then(() => {
        toast.success(`${name} removed from ${client.name}.`);
        refresh();
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The location couldn't be removed from the client.")))
      .finally(() => setBusy(null));
  };

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit"><Link to="/clients"><ArrowLeft aria-hidden /> Clients</Link></Button>
      <PageHeader
        title={client.name}
        description={[client.website, client.contact_email].filter(Boolean).join(" · ") || "Client"}
        meta={<StatusBadge tone={client.status === "ACTIVE" ? "success" : "neutral"}>{client.status === "ACTIVE" ? "Active" : "Inactive"}</StatusBadge>}
        actions={canManage ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil aria-hidden /> Edit</Button> : undefined}
      />

      <section className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-3 sm:divide-x sm:divide-border">
        <MetricCard label="Locations" value={summary.locations} caption={`${summary.gbp_connected} connected to Google`} />
        <MetricCard label="Avg. rank" value={summary.avg_rank == null ? "—" : summary.avg_rank.toFixed(1)} caption="Over the locations with ranking data" />
        <MetricCard label="Avg. GBP score" value={summary.avg_gbp_score == null ? "—" : Math.round(summary.avg_gbp_score)} caption="Over the locations with a GBP report" />
      </section>

      <Panel
        title="Locations"
        actions={canManage ? <Button size="sm" variant="outline" onClick={() => setAssigning(true)}><MapPinPlus aria-hidden /> Assign a location</Button> : undefined}
      >
        {locations.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No locations assigned yet.</p>
        ) : (
          <ul className="-m-4 divide-y divide-border">
            {locations.map((location) => (
              <li key={location.location_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link to={`/locations/${location.location_id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground hover:text-primary">{location.name}</span>
                  <span className="block text-xs text-muted-foreground">{location.city ?? ""}</span>
                </Link>
                <span className="text-xs text-muted-foreground">
                  Rank {avgRankText(location.rank?.overall_avg_rank, location.rank?.status, location.rank?.display)} · GBP {location.gbp?.score ?? "—"}
                </span>
                {canUnassign ? (
                  <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => unassign(location.location_id, location.name)}>
                    {busy === location.location_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2Off aria-hidden />} Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {access.can("team.manage") ? <ClientUsers clientId={client.client_id} /> : null}

      <Panel title="Reports">
        <ReportsList clientId={client.client_id} reportPath={(reportId) => `/reports/${reportId}`} />
      </Panel>

      <Panel title="Scheduled reports" actions={canEdit ? <Button size="sm" variant="outline" onClick={() => setScheduling(true)}><Plus aria-hidden /> Schedule</Button> : undefined}>
        <ReportSchedulesContent clientId={client.client_id} onCreate={() => setScheduling(true)} />
      </Panel>

      {editing ? <ClientDialog client={client} onClose={() => { setEditing(false); refresh(); }} /> : null}
      {assigning ? <AssignLocationDialog clientId={client.client_id} assigned={locations.map((l) => l.location_id)} onClose={() => { setAssigning(false); refresh(); }} /> : null}
      {scheduling ? <ScheduleReportDialog defaultClientId={client.client_id} onClose={() => setScheduling(false)} /> : null}
    </AppShell>
  );
}

function ClientUsers({ clientId }: { clientId: string }) {
  const [inviting, setInviting] = useState(false);
  const members = useQuery({ queryKey: [...TEAM_KEY, "members"], queryFn: ({ signal }) => getMembers(signal) });
  const users = (members.data ?? []).filter((member) => member.role === "client_user" && member.client_ids.includes(clientId));
  return (
    <Panel
      title="Client users"
      description="People at this client who can see its locations and reports (read-only)."
      actions={<Button size="sm" variant="outline" onClick={() => setInviting(true)}><UserPlus aria-hidden /> Invite</Button>}
    >
      {members.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No client users yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {users.map((user) => (
            <li key={user.user_id}><span className="font-medium text-foreground">{user.name}</span> <span className="text-muted-foreground">{user.email}</span></li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Manage everyone's access in <Link to="/settings/team" className="text-primary hover:underline">Settings → Team</Link>.</p>
      {inviting ? <InviteDialog clientId={clientId} onClose={() => setInviting(false)} /> : null}
    </Panel>
  );
}

function AssignLocationDialog({ clientId, assigned, onClose }: { clientId: string; assigned: string[]; onClose: () => void }) {
  const workspace = useWorkspace();
  const options = workspace.locations.filter((location) => !assigned.includes(location.id));
  const [locationId, setLocationId] = useState(options[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    void assignClientLocation(clientId, locationId)
      .then(() => {
        toast.success("Location assigned.");
        onClose();
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The location couldn't be assigned.")))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a location</DialogTitle>
          <DialogDescription>A location belongs to at most one client; assigning moves it from its current client.</DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every location is already assigned to this client.</p>
        ) : (
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.businessName}
                  {location.clientId ? ` (${workspace.clients.find((c) => c.id === location.clientId)?.name ?? "another client"})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || !locationId} onClick={save}>{saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientIndexPage;
