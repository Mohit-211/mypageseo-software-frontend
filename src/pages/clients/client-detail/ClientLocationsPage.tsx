import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, MapPinPlus, Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { LocationsTable, type LocationSort, type SortOrder } from "@/components/location/locations-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLIENT_STATUS_LABEL,
  buildManagedClients,
  type ClientAccountStatus,
} from "@/lib/mypageseo/clients-data";
import { buildManagedLocations, type LocationStatus, type ManagedLocation } from "@/lib/mock-data/locations-data";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  page: z.coerce.number().optional(),
});

type LocationSearch = z.infer<typeof searchSchema>;

const statusTone: Record<ClientAccountStatus, "success" | "warning" | "critical"> = {
  active: "success",
  setup_required: "warning",
  disconnected: "critical",
};

const PAGE_SIZE = 5;



function ClientLocationsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const { clientId } = useRequiredParams("clientId");
  const [search, setSearch] = useTypedSearch(searchSchema);


  const q = (search.q ?? "").slice(0, 120);
  const validStatuses: LocationStatus[] = ["active", "setup_required", "disconnected"];
  const status = validStatuses.includes(search.status as LocationStatus) ? (search.status as LocationStatus) : "all";
  const validSorts: LocationSort[] = ["location", "visibility", "gbp", "reviews", "rank", "status"];
  const sort = validSorts.includes(search.sort as LocationSort) ? (search.sort as LocationSort) : "location";
  const order: SortOrder = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Math.floor(search.page ?? 1));

  const client = useMemo(
    () => buildManagedClients(workspace.clients, workspace.locations).find((row) => row.id === clientId) ?? null,
    [workspace.clients, workspace.locations, clientId],
  );

  const clientLocations = useMemo(
    () =>
      buildManagedLocations(workspace.locations, workspace.clients).filter(
        (location) => location.clientId === clientId,
      ),
    [workspace.locations, workspace.clients, clientId],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clientLocations
      .filter(
        (location) =>
          !needle || `${location.businessName} ${location.area}`.toLowerCase().includes(needle),
      )
      .filter((location) => status === "all" || location.status === status)
      .sort((a, b) => compareLocations(a, b, sort, order));
  }, [clientLocations, order, q, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(q || status !== "all");

  const updateSearch = (patch: Record<string, string | number | undefined>) => {
    setSearch((previous) => ({ ...previous, ...patch }));
  };

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageHeader title="Client locations" description="Loading this client's locations." />
        <TableSkeleton rows={6} columns={7} />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <PageHeader title="Client locations" description="Locations assigned to this client." />
        <ErrorState
          description="We couldn't load this client's locations. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (workspace.organization?.accountType !== "agency") {
    return (
      <AppShell>
        <PageHeader title="Client locations" description="Client accounts are part of the Agency workspace." />
        <EmptyState
          title="Client accounts are only available to agency organizations"
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

  if (!client) {
    return (
      <AppShell>
        <PageHeader title="Client not found" description="This client is not part of the current agency workspace." />
        <EmptyState
          title="We couldn't find this client"
          description="The client may have been removed, or it belongs to another agency organization."
          action={
            <Button asChild>
              <Link to="/clients">
                <ArrowLeft aria-hidden /> Back to clients
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/clients/${client.id}`}>
            <ArrowLeft aria-hidden /> Back to {client.name}
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Client locations"
        description={`All Google Business Profile locations assigned to ${client.name}. Open a location to work inside its rankings, GBP and citations.`}
        meta={
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone={statusTone[client.status]}>{CLIENT_STATUS_LABEL[client.status]}</StatusBadge>
            <span>
              {client.locationCount} location{client.locationCount === 1 ? "" : "s"}
            </span>
            {client.needsAttention > 0 ? (
              <span className="text-critical">{client.needsAttention} need setup</span>
            ) : null}
          </div>
        }
        actions={
          <Button size="sm" onClick={() => navigate("/locations/add")}>
            <MapPinPlus aria-hidden /> Add location
          </Button>
        }
      />

      {clientLocations.length === 0 ? (
        <EmptyState
          title={`No locations assigned to ${client.name}`}
          description="Connect a Google Business Profile location and assign it to this client to start tracking local performance."
          action={
            <Button onClick={() => navigate("/locations/add")}>
              <MapPinPlus aria-hidden /> Add location
            </Button>
          }
        />
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search client locations"
                value={q}
                onChange={(event) => updateSearch({ q: event.target.value || undefined, page: 1 })}
                placeholder="Search name or city"
                className="h-9 pl-9"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Select value={status} onValueChange={(value) => updateSearch({ status: value === "all" ? undefined : value, page: 1 })}>
                <SelectTrigger className="w-full bg-background sm:w-44" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="setup_required">Setup required</SelectItem>
                  <SelectItem value="disconnected">Disconnected</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={() => setSearch({ sort, order, page: 1 })}>
                  <X aria-hidden /> Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "location" : "locations"}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" aria-hidden /> Sorted by {sortLabel(sort)}
            </span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No locations match these filters"
              description="Try another search or status to see more of this client's locations."
              action={
                <Button variant="outline" onClick={() => setSearch({ sort, order, page: 1 })}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <LocationsTable
              locations={visible}
              agency
              sort={sort}
              order={order}
              page={safePage}
              pageCount={pageCount}
              onSort={(nextSort) =>
                updateSearch({ sort: nextSort, order: sort === nextSort && order === "asc" ? "desc" : "asc", page: 1 })
              }
              onPageChange={(nextPage) => updateSearch({ page: nextPage })}
              onOpen={(location) => {
                workspace.setActiveClientId(client.id);
                workspace.setActiveLocationId(location.id);
                navigate(`/locations/${location.id}`);
              }}
            />
          )}

          <p className="text-xs text-muted-foreground">
            Citation health and last-updated timestamps are supplied by services that are not connected to this
            frontend yet, so they are not shown here. Assigning or removing locations from a client requires the
            account-management backend, which is not available yet.
          </p>
        </div>
      )}
    </AppShell>
  );
}

function compareLocations(a: ManagedLocation, b: ManagedLocation, sort: LocationSort, order: SortOrder) {
  const multiplier = order === "asc" ? 1 : -1;
  const values: Record<LocationSort, [string | number | null, string | number | null]> = {
    location: [a.businessName, b.businessName],
    visibility: [a.visibility, b.visibility],
    gbp: [a.gbpHealth, b.gbpHealth],
    reviews: [a.reviewCount ?? null, b.reviewCount ?? null],
    rank: [a.averageRank, b.averageRank],
    status: [a.status, b.status],
  };
  const [left, right] = values[sort];
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return multiplier * (typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right));
}

function sortLabel(sort: LocationSort) {
  return ({ location: "location", visibility: "visibility", gbp: "GBP health", reviews: "reviews", rank: "average rank", status: "status" } as const)[sort];
}

export default ClientLocationsPage;
