import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { MapPinPlus, Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { LocationsTable, type LocationSort, type SortOrder } from "@/components/location/locations-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildManagedLocations, type LocationStatus, type ManagedLocation } from "@/lib/mock-data/locations-data";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { NoLocationsEmpty, NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import { PlanLimitNotice, usePlanLimit } from "@/components/mypageseo/plan";
import { planLimitMessage } from "@/lib/mypageseo/plan";
import { useTypedSearch } from "@/hooks/use-typed-search";

const searchSchema = z.object({
  q: z.string().optional(),
  client: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  page: z.coerce.number().optional(),
});

type LocationSearch = z.infer<typeof searchSchema>;



function LocationsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useTypedSearch(searchSchema);
  const agency = workspace.organization?.accountType === "agency";
  const q = (search.q ?? "").slice(0, 120);
  const client = search.client ?? "all";
  const validStatuses: LocationStatus[] = ["active", "setup_required", "disconnected"];
  const status = validStatuses.includes(search.status as LocationStatus) ? search.status as LocationStatus : "all";
  const validSorts: LocationSort[] = ["location", "visibility", "gbp", "reviews", "rank", "status"];
  const sort = validSorts.includes(search.sort as LocationSort) ? search.sort as LocationSort : "location";
  const order: SortOrder = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Math.floor(search.page ?? 1));
  const pageSize = 5;

  const locationLimit = usePlanLimit("locations");

  const allLocations = useMemo(
    () => buildManagedLocations(workspace.locations, workspace.clients),
    [workspace.locations, workspace.clients],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allLocations
      .filter((location) => !needle || `${location.businessName} ${location.area} ${location.clientName ?? ""}`.toLowerCase().includes(needle))
      .filter((location) => client === "all" || location.clientId === client)
      .filter((location) => status === "all" || location.status === status)
      .sort((a, b) => compareLocations(a, b, sort, order));
  }, [allLocations, client, order, q, sort, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleLocations = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const hasFilters = Boolean(q || client !== "all" || status !== "all");

  const updateSearch = (patch: Record<string, string | number | boolean | undefined>) => {
    setSearch((previous) => ({ ...previous, ...patch }));
  };

  if (workspace.status === "loading") {
    return <AppShell><PageHeader title="Locations" description="Manage the Google Business Profiles connected to your Mypageseo account." /><TableSkeleton rows={6} columns={agency ? 8 : 7} /></AppShell>;
  }

  if (workspace.status === "unavailable") {
    return <AppShell><PageHeader title="Locations" description="Manage the Google Business Profiles connected to your Mypageseo account." /><ErrorState description="We couldn't load your locations. Try again without leaving this page." onRetry={() => window.location.reload()} /></AppShell>;
  }

  return (
    <AppShell>
      <PageHeader
        title="Locations"
        description="Manage the Google Business Profiles connected to your Mypageseo account."
        actions={
          <Button
            onClick={() => navigate("/locations/add")}
            disabled={Boolean(locationLimit?.reached)}
            title={locationLimit?.reached ? planLimitMessage(locationLimit) : undefined}
          >
            <MapPinPlus aria-hidden /> Add location
          </Button>
        }
      />

      {locationLimit ? <PlanLimitNotice state={locationLimit} className="mb-4" /> : null}


      {allLocations.length === 0 ? (
        <NoLocationsEmpty />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search locations" value={q} onChange={(event) => updateSearch({ q: event.target.value || undefined, page: 1 })} placeholder="Search name, city or client" className="h-9 pl-9" />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              {agency ? (
                <Select value={client} onValueChange={(value) => updateSearch({ client: value === "all" ? undefined : value, page: 1 })}>
                  <SelectTrigger className="w-full bg-background sm:w-48" aria-label="Filter by client"><SelectValue placeholder="All clients" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All clients</SelectItem>{workspace.clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : null}
              <Select value={status} onValueChange={(value) => updateSearch({ status: value === "all" ? undefined : value, page: 1 })}>
                <SelectTrigger className="w-full bg-background sm:w-44" aria-label="Filter by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="setup_required">Setup required</SelectItem><SelectItem value="disconnected">Disconnected</SelectItem></SelectContent>
              </Select>
              {hasFilters ? <Button variant="ghost" size="sm" onClick={() => setSearch({ sort, order, page: 1 })}><X aria-hidden /> Clear</Button> : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "location" : "locations"}</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><SlidersHorizontal className="size-3.5" aria-hidden /> Sorted by {sortLabel(sort)}</span>
          </div>

          {filtered.length === 0 ? (
            <NoResultsEmpty label="locations" onClear={() => setSearch({ sort, order, page: 1 })} />
          ) : (
            <LocationsTable
              locations={visibleLocations}
              agency={agency}
              sort={sort}
              order={order}
              page={safePage}
              pageCount={pageCount}
              onSort={(nextSort) => updateSearch({ sort: nextSort, order: sort === nextSort && order === "asc" ? "desc" : "asc", page: 1 })}
              onPageChange={(nextPage) => updateSearch({ page: nextPage })}
              onOpen={(location) => {
                workspace.setActiveClientId(location.clientId ?? null);
                workspace.setActiveLocationId(location.id);
                navigate(`/locations/${location.id}`);
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function compareLocations(a: ManagedLocation, b: ManagedLocation, sort: LocationSort, order: SortOrder) {
  const multiplier = order === "asc" ? 1 : -1;
  const values: Record<LocationSort, [string | number | null, string | number | null]> = {
    location: [a.businessName, b.businessName], visibility: [a.visibility, b.visibility], gbp: [a.gbpHealth, b.gbpHealth], reviews: [a.reviewCount ?? null, b.reviewCount ?? null], rank: [a.averageRank, b.averageRank], status: [a.status, b.status],
  };
  const [left, right] = values[sort];
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return multiplier * (typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right));
}

function sortLabel(sort: LocationSort) {
  return ({ location: "location", visibility: "visibility", gbp: "GBP health", reviews: "reviews", rank: "average rank", status: "status" } as const)[sort];
}

export default LocationsPage;
