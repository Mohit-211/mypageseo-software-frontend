import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, LoaderCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createClient, deleteClient, getClients, updateClient, type ClientRecord } from "@/api";
import { RequireAccess } from "@/components/mypageseo/access";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccess } from "@/hooks/use-access";
import { CLIENTS_KEY, clientErrorText } from "@/lib/clients/clients";

/** Clients are an optional grouping of an agency's locations; no feature depends on them. */
const ClientsIndexPage = () => (
  <RequireAccess permission="clients.view">
    <ClientsPage />
  </RequireAccess>
);

function ClientsPage() {
  const access = useAccess();
  const canManage = access.can("clients.manage");
  // A member limited to its clients edits them but can't create or delete clients (Phase 21).
  const canAdmin = access.can("clients.admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientRecord | "new" | null>(null);
  const [deleting, setDeleting] = useState<ClientRecord | null>(null);
  const clients = useQuery({
    queryKey: [...CLIENTS_KEY, "list", search.trim()],
    queryFn: ({ signal }) => getClients(signal, search.trim() ? { search: search.trim() } : {}),
  });

  const remove = (client: ClientRecord) =>
    void deleteClient(client.client_id)
      .then((result) => {
        toast.success(`${client.name} deleted${result.locations_unassigned ? `; ${result.locations_unassigned} location${result.locations_unassigned === 1 ? "" : "s"} unassigned` : ""}.`);
        void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
        void queryClient.invalidateQueries({ queryKey: ["locations"] });
      })
      .catch((err: unknown) => toast.error(clientErrorText(err, "The client couldn't be deleted.")));

  return (
    <AppShell>
      <PageHeader
        title="Clients"
        description="Group your locations by the business they belong to. Optional: locations work the same with or without a client."
        actions={canAdmin ? <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden /> New client</Button> : undefined}
      />
      <div className="relative max-w-sm">
        <Search aria-hidden className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search clients" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {clients.isPending ? (
        <TableSkeleton rows={4} columns={5} />
      ) : clients.isError ? (
        <ErrorState description="Clients couldn't be loaded." onRetry={() => void clients.refetch()} />
      ) : clients.data.clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? "No matching clients" : "No clients yet"}
          description={search ? "Try another name." : "Create a client, then assign its locations to see them together."}
          action={canAdmin && !search ? <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden /> New client</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-surface-strong text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 text-right font-medium">Locations</th>
                <th className="px-3 py-2.5 text-right font-medium" title="Average over the 5 tracking points, all keywords">Avg. rank</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg. GBP score</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                {canManage ? <th className="px-3 py-2.5" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.data.clients.map((client) => (
                <tr key={client.client_id}>
                  <td className="px-4 py-3">
                    <Link to={`/clients/${client.client_id}`} className="font-medium text-foreground hover:text-primary hover:underline">{client.name}</Link>
                    {client.contact_email ? <span className="block text-xs text-muted-foreground">{client.contact_email}</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular">{client.locations_count}</td>
                  <td className="px-3 py-3 text-right tabular">{client.avg_rank == null ? "—" : client.avg_rank.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right tabular">{client.avg_gbp_score == null ? "—" : Math.round(client.avg_gbp_score)}</td>
                  <td className="px-3 py-3"><StatusBadge tone={client.status === "ACTIVE" ? "success" : "neutral"}>{client.status === "ACTIVE" ? "Active" : "Inactive"}</StatusBadge></td>
                  {canManage ? (
                    <td className="px-3 py-3 text-right">
                      <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${client.name}`} onClick={() => setEditing(client)}><Pencil aria-hidden /></Button>
                      {canAdmin ? (
                        <Button size="icon" variant="ghost" className="size-8 text-critical" aria-label={`Delete ${client.name}`} onClick={() => setDeleting(client)}><Trash2 aria-hidden /></Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? <ClientDialog client={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={`Delete ${deleting?.name ?? "this client"}?`}
        description="Its locations stay in your organization, without a client. Client users of this client lose access to them."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) remove(target);
        }}
      />
    </AppShell>
  );
}

export function ClientDialog({ client, onClose }: { client: ClientRecord | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(client?.name ?? "");
  const [website, setWebsite] = useState(client?.website ?? "");
  const [email, setEmail] = useState(client?.contact_email ?? "");
  const [active, setActive] = useState(client?.status !== "INACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const input = { name: name.trim(), website: website.trim() || null, contact_email: email.trim() || null };
    try {
      if (client) await updateClient(client.client_id, { ...input, status: active ? "ACTIVE" : "INACTIVE" });
      else await createClient(input);
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      toast.success(client ? "Client saved." : "Client created.");
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
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>Assign locations to it from the client's page or the Locations list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="client-name">Name</Label><Input id="client-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="client-website">Website (optional)</Label><Input id="client-website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="client-email">Contact email (optional)</Label><Input id="client-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          {client ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active
            </label>
          ) : null}
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button disabled={saving || name.trim().length < 2} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {client ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientsIndexPage;
