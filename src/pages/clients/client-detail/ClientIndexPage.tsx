import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Gauge,
  Globe,
  Link2Off,
  LoaderCircle,
  Mail,
  MapPin,
  MapPinPlus,
  Pencil,
  Stamp,
  Star,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { assignClientLocation, getClient, getMembers, isApiError, unassignClientLocation, type LocationRow } from "@/api";
import { PageHeader, Panel, StatusBadge, TrendIndicator } from "@/components/layout/shared/data-display";
import { RowActions, TableBody, TableCard, TableHead, TableRow, TableScroll, Th, tdClass, tdNumberClass } from "@/components/layout/shared/data-table";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { ReportsSection } from "@/components/report/reports-section";
import { InitialsAvatar } from "@/components/team/initials-avatar";
import { InviteDialog } from "@/components/team/invite-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccess } from "@/hooks/use-access";
import { useRequiredParams } from "@/hooks/use-required-params";
import { CLIENTS_KEY, clientErrorText, retryUnlessClientError } from "@/lib/clients/clients";
import { formatDate } from "@/lib/datetime";
import { healthStatusTone } from "@/lib/health-tone";
import { locationStatusMeta } from "@/lib/locations/location-status";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { avgRankText } from "@/lib/rankings/format";
import { byText, sortRows } from "@/lib/sort";
import { TEAM_KEY } from "@/lib/team/team";
import { ClientDialog } from "@/pages/clients/ClientsIndexPage";

/** One client: its locations, a summary over them, its users, PDF reports and monthly emails. */
function ClientIndexPage() {
  const { clientId } = useRequiredParams("clientId");
  const access = useAccess();
  const navigate = useNavigate();
  const canManage = access.can("clients.manage");
  // Removing a location from a client would hide it from a limited member (400 `client_required`).
  const canUnassign = access.can("clients.admin");
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: [...CLIENTS_KEY, "detail", clientId], queryFn: ({ signal }) => getClient(clientId, signal), retry: retryUnlessClientError });
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const backLink = (
    <Link
      to="/clients"
      className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden className="size-3.5" /> All clients
    </Link>
  );

  if (detail.isPending) return <PageSkeleton metrics={4} rows={3} />;
  if (detail.isError) {
    return isApiError(detail.error) && detail.error.status === 404 ? (
      <EmptyState
        variant="no-results"
        icon={Users}
        title="Client not found"
        description="It may have been deleted, or it isn't one of your clients."
        action={
          <Button asChild variant="outline">
            <Link to="/clients">
              <ArrowLeft aria-hidden /> Back to clients
            </Link>
          </Button>
        }
      />
    ) : (
      <ErrorState title="This client couldn't be loaded" description="Check your connection and try again." onRetry={() => void detail.refetch()} />
    );
  }

  const { client, locations, summary } = detail.data;
  const sortedLocations = sortRows(locations, byText((location) => location.name));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["locations"] });
  };
  const unassign = (locationId: string, name: string) => {
    setBusy(locationId);
    void unassignClientLocation(client.client_id, locationId)
      .then(() => {
        toast.success(`${name} no longer belongs to ${client.name}.`);
        refresh();
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The location couldn't be removed from the client.")))
      .finally(() => setBusy(null));
  };

  return (
    <>
      <PageHeader
        icon={Users}
        tone="clients"
        eyebrow={backLink}
        title={client.name}
        description={<ClientContact website={client.website ?? null} email={client.contact_email ?? null} />}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {client.status === "ACTIVE" ? (
              <StatusBadge tone="success" dot>
                Active
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral" dot>
                Inactive
              </StatusBadge>
            )}
            {client.created_at ? <span className="text-xs text-muted-foreground">Client since {formatDate(client.created_at)}</span> : null}
          </div>
        }
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit details
              </Button>
              <Button onClick={() => setAssigning(true)}>
                <MapPinPlus aria-hidden /> Assign a location
              </Button>
            </>
          ) : undefined
        }
      />

      <section aria-label="Summary" className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <KpiTile label="Locations" icon={MapPin} tone="locations" value={summary.locations} hint={`${summary.gbp_connected} connected to Google`} />
        <KpiTile
          label="Average rank"
          icon={TrendingUp}
          tone="rankings"
          value={summary.avg_rank == null ? "—" : summary.avg_rank.toFixed(1)}
          hint="Across locations with ranking data; 1 is the top"
        />
        <KpiTile
          label="Average profile score"
          icon={Gauge}
          tone="gbp"
          value={summary.avg_gbp_score == null ? "—" : Math.round(summary.avg_gbp_score)}
          hint="Across locations with a GBP report"
          className="col-span-2 xl:col-span-1"
        />
      </section>

      <TableCard>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-6 text-foreground">Locations</h2>
            <p className="text-[13px] text-muted-foreground">
              {locations.length === 0 ? "None assigned yet." : `${locations.length} location${locations.length === 1 ? "" : "s"} belong to ${client.name}.`}
            </p>
          </div>
          {locations.length > 0 ? (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/locations?client=${encodeURIComponent(client.client_id)}`}>
                Open in Locations <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
        {locations.length === 0 ? (
          <EmptyState
            compact
            icon={MapPin}
            tone="locations"
            title="No locations assigned yet"
            description="Assign this client's locations to see their rankings and profile scores together, and to share reports with the client."
            action={
              canManage ? (
                <Button size="sm" onClick={() => setAssigning(true)}>
                  <MapPinPlus aria-hidden /> Assign a location
                </Button>
              ) : undefined
            }
            className="border-0"
          />
        ) : (
          <>
            <div className="hidden md:block">
              <TableScroll minWidth={760} label={`Locations of ${client.name}`}>
                <TableHead>
                  <Th>Location</Th>
                  <Th align="right">Avg. rank</Th>
                  <Th align="right">Profile score</Th>
                  <Th align="right">Rating</Th>
                  <Th>Status</Th>
                  <Th srOnly>Actions</Th>
                </TableHead>
                <TableBody>
                  {sortedLocations.map((location) => (
                    <TableRow key={location.location_id}>
                      <td className={tdClass}>
                        <LocationName location={location} />
                      </td>
                      <td className={tdNumberClass}>
                        <RankValue location={location} />
                      </td>
                      <td className={tdNumberClass}>
                        <ScoreValue location={location} />
                      </td>
                      <td className={tdNumberClass}>
                        <RatingValue location={location} />
                      </td>
                      <td className={tdClass}>
                        <LocationStatusBadge location={location} />
                      </td>
                      <td className={`${tdClass} w-12 text-right`}>
                        <LocationActions
                          location={location}
                          canUnassign={canUnassign}
                          busy={busy === location.location_id}
                          disabled={busy !== null}
                          onOpen={() => navigate(locationPath(location.location_id))}
                          onUnassign={() => unassign(location.location_id, location.name)}
                        />
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </TableScroll>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {sortedLocations.map((location) => (
                <li key={location.location_id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <LocationName location={location} />
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-12 text-xs text-muted-foreground">
                      <span>
                        Rank <span className="font-semibold text-foreground">{avgRankText(location.rank?.overall_avg_rank, location.rank?.status, location.rank?.display)}</span>
                      </span>
                      <span>
                        Score <ScoreValue location={location} />
                      </span>
                      <LocationStatusBadge location={location} />
                    </div>
                  </div>
                  <LocationActions
                    location={location}
                    canUnassign={canUnassign}
                    busy={busy === location.location_id}
                    disabled={busy !== null}
                    onOpen={() => navigate(locationPath(location.location_id))}
                    onUnassign={() => unassign(location.location_id, location.name)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </TableCard>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {access.can("team.manage") ? <ClientUsers clientId={client.client_id} clientName={client.name} /> : null}
        {access.can("clients.view") ? <WhiteLabelCard clientId={client.client_id} clientName={client.name} /> : null}
      </div>

      {/* The same PDF reports and monthly emails as White Label, narrowed to this client: headings,
          not cards, because each list draws its own card. It also opens the "Schedule an email" dialog. */}
      <ReportsSection
        clientId={client.client_id}
        createReportOpen={creatingReport}
        onCreateReportOpenChange={setCreatingReport}
        createScheduleOpen={scheduling}
        onCreateScheduleOpenChange={setScheduling}
      />

      {editing ? (
        <ClientDialog
          client={client}
          onClose={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : null}
      {assigning ? (
        <AssignLocationDialog
          clientId={client.client_id}
          clientName={client.name}
          assigned={locations.map((location) => location.location_id)}
          onClose={() => {
            setAssigning(false);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ClientContact({ website, email }: { website: string | null; email: string | null }) {
  if (!website && !email) return <>A client of your agency.</>;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {website ? (
        <a
          href={/^https?:\/\//i.test(website) ? website : `https://${website}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-sm text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Globe aria-hidden className="size-3.5" />
          {website.replace(/^https?:\/\//i, "")}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1.5 rounded-sm text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mail aria-hidden className="size-3.5" />
          {email}
        </a>
      ) : null}
    </span>
  );
}

function LocationName({ location }: { location: LocationRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <InitialsAvatar name={location.name} square />
      <div className="min-w-0">
        <Link
          to={locationPath(location.location_id)}
          className="block truncate rounded-sm font-semibold text-foreground underline-offset-2 outline-hidden hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {location.name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">{[location.city, location.country].filter(Boolean).join(", ") || "—"}</span>
      </div>
    </div>
  );
}

function RankValue({ location }: { location: LocationRow }) {
  const change = location.rank?.change ?? null;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {avgRankText(location.rank?.overall_avg_rank, location.rank?.status, location.rank?.display)}
      {/* `change` is previous minus current, so a positive number is an improvement. */}
      {change != null && change !== 0 ? (
        <TrendIndicator direction={change > 0 ? "up" : "down"} value={Math.abs(change).toFixed(1)} positive={change > 0} />
      ) : null}
    </span>
  );
}

function ScoreValue({ location }: { location: LocationRow }) {
  const score = location.gbp?.score ?? null;
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const tone = healthStatusTone(score);
  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-foreground">
      <span
        aria-hidden
        className={`size-2 rounded-full ${tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "critical" ? "bg-critical" : "bg-muted-foreground"}`}
      />
      {score}
      {location.gbp?.grade ? <span className="font-normal text-muted-foreground">({location.gbp.grade})</span> : null}
    </span>
  );
}

function RatingValue({ location }: { location: LocationRow }) {
  const rating = location.reviews?.rating ?? null;
  if (rating == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <Star aria-hidden className="size-3.5 fill-warning-bright text-warning" />
      {rating.toFixed(1)}
      {location.reviews?.count != null ? <span className="text-muted-foreground">· {location.reviews.count}</span> : null}
    </span>
  );
}

function LocationStatusBadge({ location }: { location: LocationRow }) {
  const meta = locationStatusMeta(location.status);
  return (
    <StatusBadge tone={meta.tone} dot>
      {meta.label}
    </StatusBadge>
  );
}

function LocationActions({
  location,
  canUnassign,
  busy,
  disabled,
  onOpen,
  onUnassign,
}: {
  location: LocationRow;
  canUnassign: boolean;
  busy: boolean;
  disabled: boolean;
  onOpen: () => void;
  onUnassign: () => void;
}) {
  if (busy) return <LoaderCircle aria-label="Removing…" className="ml-auto size-4 animate-spin text-muted-foreground" />;
  return (
    <RowActions label={`Actions for ${location.name}`} disabled={disabled}>
      <DropdownMenuItem onSelect={onOpen}>
        <ArrowUpRight aria-hidden /> Open location
      </DropdownMenuItem>
      {canUnassign ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onUnassign}>
            <Link2Off aria-hidden /> Remove from client
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActions>
  );
}

function ClientUsers({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [inviting, setInviting] = useState(false);
  const members = useQuery({ queryKey: [...TEAM_KEY, "members"], queryFn: ({ signal }) => getMembers(signal) });
  const users = sortRows(
    (members.data ?? []).filter((member) => member.role === "client_user" && member.client_ids.includes(clientId)),
    byText((member) => member.name),
  );
  return (
    <Panel
      title="Client users"
      description={`People at ${clientName} who can see its locations and reports (read-only).`}
      icon={Users}
      tone="clients"
      actions={
        <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
          <UserPlus aria-hidden /> Invite
        </Button>
      }
    >
      {members.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden className="size-4 animate-spin" /> Loading people…
        </p>
      ) : members.isError ? (
        <ErrorState compact title="People couldn't be loaded" description="Try again in a moment." onRetry={() => void members.refetch()} className="shadow-none" />
      ) : users.length === 0 ? (
        <EmptyState
          compact
          icon={UserPlus}
          tone="clients"
          title="No client users yet"
          description="Invite someone at this client to give them their own read-only view of their locations and reports."
          action={
            <Button size="sm" onClick={() => setInviting(true)}>
              <UserPlus aria-hidden /> Invite a client user
            </Button>
          }
          className="border-0"
        />
      ) : (
        <ul className="-my-1 divide-y divide-border">
          {users.map((user) => (
            <li key={user.user_id} className="flex items-center gap-3 py-2.5">
              <InitialsAvatar name={user.name} fallback={user.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <StatusBadge tone="neutral" size="sm">
                Read-only
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Manage everyone's access in{" "}
        <Link to="/settings/team" className="font-medium text-primary underline-offset-2 hover:underline">
          Settings › Team
        </Link>
        .
      </p>
      {inviting ? <InviteDialog clientId={clientId} onClose={() => setInviting(false)} /> : null}
    </Panel>
  );
}

/** The client's branded links and reports live on the White Label page, opened on this client. */
function WhiteLabelCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <section aria-labelledby="client-white-label" className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-3">
        {/* The White Label chip, the same everywhere (page header, help, location overview). */}
        <IconChip icon={Stamp} tone="reports" />
        <h2 id="client-white-label" className="text-[15px] font-semibold text-foreground">
          Client links and branded reports
        </h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Give {clientName} a branded page for each location, with your logo and the reports you choose.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={`/white-label?client=${encodeURIComponent(clientId)}#links`}>
            Manage client links <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function AssignLocationDialog({ clientId, clientName, assigned, onClose }: { clientId: string; clientName: string; assigned: string[]; onClose: () => void }) {
  const workspace = useWorkspace();
  const options = sortRows(
    workspace.locations.filter((location) => !assigned.includes(location.id)),
    byText((location) => location.businessName),
  );
  const [locationId, setLocationId] = useState(options[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const chosen = options.find((location) => location.id === locationId);
  const currentClient = chosen?.clientId ? (workspace.clients.find((entry) => entry.id === chosen.clientId)?.name ?? "another client") : null;

  const save = () => {
    if (saving || !locationId) return;
    setSaving(true);
    void assignClientLocation(clientId, locationId)
      .then(() => {
        toast.success(`${chosen?.businessName ?? "The location"} now belongs to ${clientName}.`);
        onClose();
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The location couldn't be assigned.")))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a location to {clientName}</DialogTitle>
          <DialogDescription>A location belongs to one client at most, so assigning moves it from its current client.</DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-sm text-muted-foreground">Every location already belongs to {clientName}.</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="assign-location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="assign-location" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {options.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.businessName}
                    {location.area ? ` · ${location.area}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentClient ? <p className="text-xs text-warning-foreground">It moves from {currentClient}.</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button disabled={saving || !locationId} aria-busy={saving || undefined} onClick={save}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <MapPinPlus aria-hidden />} Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientIndexPage;
