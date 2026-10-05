import { useMemo } from "react";
import { RequireAccess } from "@/components/mypageseo/access";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge, type StatusTone } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIENTS_PAGE_SIZE,
  CLIENT_STATUS_LABEL,
  buildManagedClients,
  getClientCapabilities,
  type ClientAccountStatus,
  type ManagedClient,
} from "@/lib/mypageseo/clients-data";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { PlanLimitNotice } from "@/components/mypageseo/plan";
import { usePlanLimit } from "@/hooks/use-plan";
import { planLimitMessage } from "@/lib/mypageseo/plan";
import { useTypedSearch } from "@/hooks/use-typed-search";

const description =
  "Manage the client accounts in this agency, the locations assigned to each client and the local SEO work running across the portfolio.";

const searchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  page: z.coerce.number().optional(),
});

type ClientsSearch = z.infer<typeof searchSchema>;
type SortKey = "name" | "locations" | "visibility" | "gbp" | "status";

const statusTone: Record<ClientAccountStatus, StatusTone> = {
  active: "success",
  setup_required: "warning",
  disconnected: "critical",
};

const ClientsIndexPage = () => (
    // <RequireAccess permission="clients.view">
    <RequireAccess permission="clients.view">

      <ClientsPage />
    </RequireAccess>
  );

function ClientsPage() {
  const workspace = useWorkspace();
  const [search, setSearch] = useTypedSearch(searchSchema);
  const capabilities = getClientCapabilities();
  const clientLimit = usePlanLimit("clients");

  const q = (search.q ?? "").slice(0, 120);
  const validStatuses: ClientAccountStatus[] = ["active", "setup_required", "disconnected"];
  const status = validStatuses.includes(search.status as ClientAccountStatus)
    ? (search.status as ClientAccountStatus)
    : "all";
  const validSorts: SortKey[] = ["name", "locations", "visibility", "gbp", "status"];
  const sort = validSorts.includes(search.sort as SortKey) ? (search.sort as SortKey) : "name";
  const order = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Math.floor(search.page ?? 1));

  const clients = useMemo(
    () => buildManagedClients(workspace.clients, workspace.locations),
    [workspace.clients, workspace.locations],
  );

  const filtered = useMemo(() => {
    const rows = clients.filter((client) => {
      if (status !== "all" && client.status !== status) return false;
      if (q.trim() && !client.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
    const direction = order === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (sort === "locations") return (a.locationCount - b.locationCount) * direction;
      if (sort === "visibility") return ((a.visibility ?? -1) - (b.visibility ?? -1)) * direction;
      if (sort === "gbp") return ((a.gbpHealth ?? -1) - (b.gbpHealth ?? -1)) * direction;
      if (sort === "status") return a.status.localeCompare(b.status) * direction;
      return a.name.localeCompare(b.name) * direction;
    });
  }, [clients, status, q, sort, order]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / CLIENTS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * CLIENTS_PAGE_SIZE, current * CLIENTS_PAGE_SIZE);
  const hasFilters = q.trim() !== "" || status !== "all";

  const update = (next: Partial<ClientsSearch>) => {
    setSearch((prev) => ({ ...prev, page: undefined, ...next }));
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) update({ sort: key, order: order === "asc" ? "desc" : "asc" });
    else update({ sort: key, order: "asc" });
  };

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Clients" description={description} />
        <TableSkeleton rows={6} columns={6} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <PageHeader title="Clients" description={description} />
        <ErrorState
          description="We couldn't load your agency workspace. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <AppShell>
        <PageHeader title="Clients" description="Client accounts are part of the Agency workspace." />
        <EmptyState
          title="Clients are only available to agency accounts"
          description="This organization is a business account, so its locations are managed directly instead of through client accounts."
          action={
            <Button asChild>
              <Link to="/locations">Go to locations</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Clients"
        description={description}
        actions={
          capabilities.canCreate ? (
            <Button
              size="sm"
              disabled={Boolean(clientLimit?.reached)}
              title={clientLimit?.reached ? planLimitMessage(clientLimit) : undefined}
            >
              Add client
            </Button>
          ) : null
        }
      />

      {clientLimit ? <PlanLimitNotice state={clientLimit} className="mb-4" /> : null}

      {clients.length === 0 ? (
        <EmptyState
          title="No clients in this agency yet"
          description="A client groups the locations, rankings, Google Business Profiles, citations and reports that belong to one business you manage. Client creation is not available in the current product integration."
          className="min-h-64"
        />
      ) : (
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={q}
                  onChange={(event) => update({ q: event.target.value || undefined })}
                  placeholder="Search clients"
                  aria-label="Search clients"
                  className="h-9 pl-8"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => update({ status: value === "all" ? undefined : value })}
              >
                <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Client status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {validStatuses.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CLIENT_STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={() => update({ q: undefined, status: undefined })}>
                  Reset
                </Button>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length} of {clients.length} clients
              </span>
            </div>
          </Panel>

          {filtered.length === 0 ? (
            <EmptyState
              title="No clients match these filters"
              description="Adjust the search or status filter to see more of the portfolio."
            />
          ) : (
            <>
              <Panel className="hidden md:block">
                <div className="-mx-4 overflow-x-auto">
                  <table className="w-full min-w-[880px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <SortHeader label="Client" active={sort === "name"} order={order} onClick={() => toggleSort("name")} />
                        <SortHeader label="Locations" active={sort === "locations"} order={order} onClick={() => toggleSort("locations")} />
                        <SortHeader label="Visibility" active={sort === "visibility"} order={order} onClick={() => toggleSort("visibility")} />
                        <SortHeader label="GBP health" active={sort === "gbp"} order={order} onClick={() => toggleSort("gbp")} />
                        <th className="px-4 py-2 font-medium">Reviews</th>
                        <th className="px-4 py-2 font-medium">Reports</th>
                        <th className="px-4 py-2 font-medium">Last activity</th>
                        <SortHeader label="Status" active={sort === "status"} order={order} onClick={() => toggleSort("status")} />
                        <th className="px-4 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((client) => (
                        <tr key={client.id} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 font-medium">
                            <Link
                              to={`/clients/${client.id}`}
                              onClick={() => workspace.setActiveClientId(client.id)}
                              className="text-foreground hover:text-primary hover:underline"
                            >
                              {client.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {client.locationCount}
                            {client.needsAttention > 0 ? (
                              <span className="ml-2 text-xs text-critical">· {client.needsAttention} need setup</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatScore(client.visibility)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatScore(client.gbpHealth)}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {client.averageRating !== null
                              ? `${client.averageRating.toFixed(1)}${client.reviewCount !== null ? ` · ${client.reviewCount}` : ""}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{client.reportStatus ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{client.lastActivity ?? "—"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={statusTone[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ClientActions client={client} onOpen={() => workspace.setActiveClientId(client.id)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <div className="space-y-3 md:hidden">
                {visible.map((client) => (
                  <Panel key={client.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/clients/${client.id}`}
                          onClick={() => workspace.setActiveClientId(client.id)}
                          className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {client.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {client.locationCount} location{client.locationCount === 1 ? "" : "s"}
                          {client.needsAttention > 0 ? ` · ${client.needsAttention} need setup` : ""}
                        </p>
                      </div>
                      <StatusBadge tone={statusTone[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</StatusBadge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <Detail label="Visibility" value={formatScore(client.visibility)} />
                      <Detail label="GBP health" value={formatScore(client.gbpHealth)} />
                      <Detail
                        label="Reviews"
                        value={client.averageRating !== null ? client.averageRating.toFixed(1) : "—"}
                      />
                      <Detail label="Reports" value={client.reportStatus ?? "—"} />
                    </dl>
                    <div className="mt-3">
                      <ClientActions client={client} onOpen={() => workspace.setActiveClientId(client.id)} />
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
                    <Button variant="outline" size="sm" disabled={current === 1} onClick={() => setSearch((prev) => ({ ...prev, page: current - 1 }))}>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled={current === totalPages} onClick={() => setSearch((prev) => ({ ...prev, page: current + 1 }))}>
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

function formatScore(value: number | null) {
  return value === null ? "—" : String(value);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}

function SortHeader({
  label,
  active,
  order,
  onClick,
}: {
  label: string;
  active: boolean;
  order: string;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2 font-medium">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {active ? <span aria-hidden>{order === "desc" ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );
}

/** Only exposes navigation that exists; client creation and invites stay out until the backend supports them. */
function ClientActions({ client, onOpen }: { client: ManagedClient; onOpen: () => void }) {
  const capabilities = getClientCapabilities();
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button asChild variant="outline" size="sm" onClick={onOpen}>
        <Link to={`/clients/${client.id}`}>
          Open client
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm" onClick={onOpen}>
        <Link to={`/locations?client=${encodeURIComponent(client.id)}`}>
          Locations
        </Link>
      </Button>
      {capabilities.canInviteUsers ? (
        <Button variant="outline" size="sm">
          Invite user
        </Button>
      ) : null}
      {capabilities.canEdit ? (
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      ) : null}
    </div>
  );
}

export default ClientsIndexPage;
