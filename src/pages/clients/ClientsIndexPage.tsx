import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, Gauge, LoaderCircle, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { createClient, deleteClient, getClients, loadAllClients, updateClient, type ClientRecord } from "@/api";
import { RequireAccess } from "@/components/mypageseo/access";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog, FormAlert, FormTextField } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import {
  RowActions,
  SortableTh,
  TableBody,
  TableCard,
  TableHead,
  TableRow,
  TableScroll,
  TableToolbar,
  Th,
  tdClass,
  tdNumberClass,
  type SortOrder,
} from "@/components/layout/shared/data-table";
import { InitialsAvatar } from "@/components/team/initials-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/hooks/use-access";
import { CLIENTS_KEY, clientErrorText, useDebouncedValue } from "@/lib/clients/clients";
import { healthStatusTone } from "@/lib/health-tone";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { byNumber, byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** Clients are an optional grouping of an agency's locations; no feature depends on them. */
const ClientsIndexPage = () => (
  <RequireAccess permission="clients.view">
    <ClientsPage />
  </RequireAccess>
);

type SortKey = "name" | "locations" | "rank" | "score" | "status";

// Names and ranks read best low-to-high; counts and scores high-to-low.
const FIRST_ORDER: Record<SortKey, SortOrder> = { name: "asc", locations: "desc", rank: "asc", score: "desc", status: "asc" };

function sortClients(rows: ClientRecord[], key: SortKey, order: SortOrder): ClientRecord[] {
  const byName = byText<ClientRecord>((client) => client.name);
  switch (key) {
    case "locations":
      return sortRows(rows, byNumber((client) => client.locations_count, order), byName);
    case "rank":
      return sortRows(rows, byNumber((client) => client.avg_rank, order), byName);
    case "score":
      return sortRows(rows, byNumber((client) => client.avg_gbp_score, order), byName);
    case "status":
      return sortRows(rows, byText((client) => (client.status === "ACTIVE" ? "a" : "b"), order), byName);
    default:
      return sortRows(rows, byText((client) => client.name, order));
  }
}

function average(values: (number | null | undefined)[]): number | null {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
}

function ClientsPage() {
  const access = useAccess();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const canManage = access.can("clients.manage");
  // A member limited to its clients edits them but can't create or delete clients (Phase 21).
  const canAdmin = access.can("clients.admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  // The API rejects a search longer than 100 characters (the box stops there too).
  const query = useDebouncedValue(search.trim().slice(0, 100));
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder }>({ key: "name", order: "asc" });
  const [editing, setEditing] = useState<ClientRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClientRecord | null>(null);

  // The unfiltered list drives the summary; the search narrows the table only.
  // Every client (all pages), so the totals are exact and the table can sort them all.
  const all = useQuery({ queryKey: [...CLIENTS_KEY, "list", ""], queryFn: ({ signal }) => loadAllClients(signal) });
  const searched = useQuery({
    queryKey: [...CLIENTS_KEY, "list", query],
    queryFn: ({ signal }) => getClients(signal, { search: query }),
    enabled: query !== "",
    placeholderData: keepPreviousData,
  });
  const list = query ? searched : all;
  // A new search shows the previous rows until its answer arrives (the first one starts from the
  // full list): say so, instead of a count that belongs to the previous rows.
  const searching = query !== "" && searched.isPlaceholderData;

  const remove = (client: ClientRecord) =>
    void deleteClient(client.client_id)
      .then((result) => {
        toast.success(`${client.name} deleted${result.locations_unassigned ? `; ${result.locations_unassigned} location${result.locations_unassigned === 1 ? "" : "s"} now have no client` : ""}.`);
        void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
        void queryClient.invalidateQueries({ queryKey: ["locations"] });
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The client couldn't be deleted.")));

  const onSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, order: current.order === "asc" ? "desc" : "asc" } : { key, order: FIRST_ORDER[key] }));

  const allClients = all.data?.clients ?? [];
  const unassigned = workspace.locations.filter((location) => !location.clientId).length;
  // Over the client locations themselves, like the dashboard's average (an average of the clients'
  // averages would weigh a one-location client like a ten-location one).
  const avgScore = average(workspace.locations.filter((location) => location.clientId).map((location) => location.gbpScore));
  const rows = list.data ? sortClients(list.data.clients, sort.key, sort.order) : [];
  // Sorting in the browser is only honest when every client is on this page.
  const sortable = Boolean(list.data && list.data.total <= list.data.clients.length);
  const newClient = canAdmin ? (
    <Button onClick={() => setEditing("new")}>
      <Plus aria-hidden /> New client
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader
        icon={Users}
        tone="clients"
        title="Clients"
        description="Group locations by the business they belong to. Clients organise your reports, client links and client access."
        actions={newClient}
      />

      {all.isError ? (
        <ErrorState title="Clients couldn't be loaded" description="Check your connection and try again." onRetry={() => void all.refetch()} />
      ) : all.isPending ? (
        <div role="status" aria-label="Loading clients" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {["Clients", "Locations", "Average profile score"].map((label, index) => (
              <KpiTile key={label} label={label} value="" loading className={index === 2 ? "col-span-2 lg:col-span-1" : undefined} />
            ))}
          </div>
          <TableSkeleton rows={4} columns={5} />
        </div>
      ) : allClients.length === 0 ? (
        <EmptyState
          icon={Users}
          tone="clients"
          title="Group locations by client"
          description="Clients are optional. They help you organise reports, client links and read-only access for the people you work for."
          action={newClient}
        />
      ) : (
        <div className="space-y-6">
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiTile
              label="Clients"
              icon={Users}
              tone="clients"
              value={all.data.total}
              hint={`${allClients.filter((client) => client.status === "ACTIVE").length} active`}
            />
            <KpiTile
              label="Locations"
              icon={MapPin}
              tone="locations"
              value={allClients.reduce((sum, client) => sum + client.locations_count, 0)}
              hint={unassigned > 0 ? `Plus ${unassigned} without a client` : "Every location has a client"}
              to="/locations"
            />
            <KpiTile
              label="Average profile score"
              icon={Gauge}
              tone="gbp"
              value={avgScore == null ? "—" : Math.round(avgScore)}
              hint="Average of the client locations with a Google profile."
              loading={workspace.status === "loading"}
              className="col-span-2 lg:col-span-1"
            />
          </section>

          <TableCard>
            <TableToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search clients" searchLabel="Search clients">
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                {searching ? (
                  <>
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" /> Searching…
                  </>
                ) : list.data ? (
                  `${list.data.total} client${list.data.total === 1 ? "" : "s"}${query ? ` matching “${query}”` : ""}`
                ) : (
                  ""
                )}
              </p>
            </TableToolbar>
            {/* Busy while the rows on screen belong to the previous search. */}
            <div aria-busy={searching || undefined}>
              {list.isError ? (
                <ErrorState compact title="The search didn't work" description="Try again in a moment." onRetry={() => void list.refetch()} className="m-4 shadow-none" />
              ) : rows.length === 0 ? (
                <EmptyState
                  variant="no-results"
                  title={`No clients match “${query}”`}
                  description="Try a shorter name, or clear the search."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="hidden md:block">
                    <TableScroll minWidth={760} label="Clients">
                      <TableHead>
                        {sortable ? (
                          <>
                            <SortableTh label="Client" value="name" active={sort.key} order={sort.order} onSort={onSort} />
                            <SortableTh label="Locations" value="locations" active={sort.key} order={sort.order} onSort={onSort} align="right" />
                            <SortableTh label="Avg. rank" value="rank" active={sort.key} order={sort.order} onSort={onSort} align="right" />
                            <SortableTh label="Profile score" value="score" active={sort.key} order={sort.order} onSort={onSort} align="right" />
                            <SortableTh label="Status" value="status" active={sort.key} order={sort.order} onSort={onSort} />
                          </>
                        ) : (
                          <>
                            <Th>Client</Th>
                            <Th align="right">Locations</Th>
                            <Th align="right">Avg. rank</Th>
                            <Th align="right">Profile score</Th>
                            <Th>Status</Th>
                          </>
                        )}
                        <Th srOnly>Actions</Th>
                      </TableHead>
                      <TableBody>
                        {rows.map((client) => (
                          <TableRow key={client.client_id}>
                            <td className={tdClass}>
                              <ClientName client={client} />
                            </td>
                            <td className={tdNumberClass}>
                              {client.locations_count > 0 ? (
                                <Link
                                  to={`/locations?client=${encodeURIComponent(client.client_id)}`}
                                  className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {client.locations_count}
                                  <span className="sr-only"> locations of {client.name}</span>
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                            <td className={tdNumberClass}>{client.avg_rank == null ? <span className="text-muted-foreground">—</span> : client.avg_rank.toFixed(1)}</td>
                            <td className={tdNumberClass}>
                              <ScoreValue score={client.avg_gbp_score} />
                            </td>
                            <td className={tdClass}>
                              <ClientStatus client={client} />
                            </td>
                            <td className={cn(tdClass, "w-12 text-right")}>
                              <ClientActions
                                client={client}
                                canManage={canManage}
                                canAdmin={canAdmin}
                                onOpen={() => navigate(`/clients/${encodeURIComponent(client.client_id)}`)}
                                onEdit={() => setEditing(client)}
                                onDelete={() => setDeleting(client)}
                              />
                            </td>
                          </TableRow>
                        ))}
                      </TableBody>
                    </TableScroll>
                  </div>

                  <ul className="divide-y divide-border md:hidden">
                    {rows.map((client) => (
                      <li key={client.client_id} className="flex items-start gap-3 px-4 py-3.5">
                        <div className="min-w-0 flex-1">
                          <ClientName client={client} />
                          <dl className="mt-2.5 grid grid-cols-3 gap-2 pl-12 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Locations</dt>
                              <dd className="text-sm font-medium tabular-nums text-foreground">{client.locations_count}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Avg. rank</dt>
                              <dd className="text-sm font-medium tabular-nums text-foreground">{client.avg_rank == null ? "—" : client.avg_rank.toFixed(1)}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Score</dt>
                              <dd className="text-sm font-medium tabular-nums text-foreground">
                                <ScoreValue score={client.avg_gbp_score} />
                              </dd>
                            </div>
                          </dl>
                        </div>
                        <ClientActions
                          client={client}
                          canManage={canManage}
                          canAdmin={canAdmin}
                          onOpen={() => navigate(`/clients/${encodeURIComponent(client.client_id)}`)}
                          onEdit={() => setEditing(client)}
                          onDelete={() => setDeleting(client)}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </TableCard>
        </div>
      )}

      {editing ? <ClientDialog client={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.name ?? "this client"}?`}
        description="Its locations stay in your organization, without a client. Client users of this client lose access to them."
        confirmLabel="Delete client"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) remove(target);
        }}
      />
    </>
  );
}

function ClientName({ client }: { client: ClientRecord }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <InitialsAvatar name={client.name} square />
      <div className="min-w-0">
        <Link
          to={`/clients/${encodeURIComponent(client.client_id)}`}
          className="block truncate rounded-sm font-semibold text-foreground underline-offset-2 outline-hidden hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {client.name}
        </Link>
        {client.contact_email || client.website ? (
          <span className="block truncate text-xs text-muted-foreground">{client.contact_email ?? client.website?.replace(/^https?:\/\//, "")}</span>
        ) : null}
      </div>
    </div>
  );
}

function ScoreValue({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const tone = healthStatusTone(score);
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "critical" ? "bg-critical" : "bg-muted-foreground")}
      />
      {Math.round(score)}
    </span>
  );
}

function ClientStatus({ client }: { client: ClientRecord }) {
  return client.status === "ACTIVE" ? (
    <StatusBadge tone="success" dot>
      Active
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" dot>
      Inactive
    </StatusBadge>
  );
}

function ClientActions({
  client,
  canManage,
  canAdmin,
  onOpen,
  onEdit,
  onDelete,
}: {
  client: ClientRecord;
  canManage: boolean;
  canAdmin: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <RowActions label={`Actions for ${client.name}`}>
      <DropdownMenuItem onSelect={onOpen}>
        <ArrowUpRight aria-hidden /> Open client
      </DropdownMenuItem>
      {canManage ? (
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden /> Edit details
        </DropdownMenuItem>
      ) : null}
      {canAdmin ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-critical focus:text-critical [&>svg]:text-critical" onSelect={onDelete}>
            <Trash2 aria-hidden /> Delete client
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActions>
  );
}

/** Create or edit a client (name, website, contact email; active or not when editing). */
export function ClientDialog({ client, onClose }: { client: ClientRecord | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name ?? "");
  const [website, setWebsite] = useState(client?.website ?? "");
  const [email, setEmail] = useState(client?.contact_email ?? "");
  const [active, setActive] = useState(client?.status !== "INACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const nameError = touched && name.trim().length < 2 ? "Enter at least 2 characters." : null;

  const save = async () => {
    setTouched(true);
    if (name.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    const input = { name: name.trim(), website: website.trim() || null, contact_email: email.trim() || null };
    try {
      if (client) await updateClient(client.client_id, { ...input, status: active ? "ACTIVE" : "INACTIVE" });
      else await createClient(input);
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      toast.success(client ? "Client saved." : `${input.name} created. Assign its locations next.`);
      onClose();
    } catch (err) {
      setError(clientErrorText(err, "The client couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? `Edit ${client.name}` : "New client"}</DialogTitle>
          <DialogDescription>Assign locations to it from the client's page or from Locations.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <FormTextField id="client-name" label="Name" required value={name} onChange={setName} error={nameError} disabled={saving} autoFocus />
          <FormTextField id="client-website" label="Website" optional type="url" placeholder="https://" value={website} onChange={setWebsite} disabled={saving} />
          <FormTextField id="client-email" label="Contact email" optional type="email" value={email} onChange={setEmail} disabled={saving} hint="For your records; MyPageSEO doesn't email it." />
          {client ? (
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox id="client-active" checked={active} onCheckedChange={(checked) => setActive(checked === true)} disabled={saving} className="mt-0.5" />
              <div>
                <Label htmlFor="client-active" className="text-sm font-medium text-foreground">
                  Active client
                </Label>
                <p className="text-xs text-muted-foreground">Inactive clients keep their locations and reports; they're just marked as not current.</p>
              </div>
            </div>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : client ? "Save changes" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ClientsIndexPage;
