import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { LoaderCircle, MapPinPlus, Search, X } from "lucide-react";
import {
  deleteLocation,
  isApiError,
  unbindGbpLocation,
  updateLocation,
  type ClientRecord,
  type LocationRow,
  type LocationSortField,
  type LocationStatus,
} from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { NoLocationsEmpty, NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import { GoogleAccountsPanel } from "@/components/gbp-connect/google-accounts-panel";
import { PendingGbpSection } from "@/components/gbp-connect/pending-gbp-section";
import { ClientSelect } from "@/components/location/client-select";
import { LocationRowsTable } from "@/components/location/location-rows-table";
import { LOCATION_STATUS_LABEL, locationSetupPath } from "@/lib/locations/location-actions";
import type { SortOrder } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { invalidateGbpQueries, useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { useClients, useLocationsList } from "@/lib/locations/use-locations";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const searchSchema = z.object({
  q: z.string().optional(),
  client: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
  page: z.coerce.number().optional(),
});

const PAGE_SIZE = 25;
const STATUSES: LocationStatus[] = ["active", "setup_required", "gbp_disconnected", "gbp_not_connected", "reconnect_required"];
const SORTS: LocationSortField[] = ["name", "city", "rank", "gbp_score", "rating", "last_refreshed"];
const DESCRIPTION = "Manage the Google Business Profiles connected to your Mypageseo account.";

/** Delays a fast-changing value (the search box) so each keystroke doesn't send a request. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function LocationsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connect } = useGbpConnect();
  const [search, setSearch] = useTypedSearch(searchSchema);
  const agency = workspace.organization?.accountType === "agency";
  const { clients } = useClients(agency);

  const q = (search.q ?? "").slice(0, 120);
  const debouncedQ = useDebounced(q.trim());
  const clientId = search.client ?? null;
  const status = STATUSES.includes(search.status as LocationStatus) ? (search.status as LocationStatus) : null;
  const sort = SORTS.includes(search.sort as LocationSortField) ? (search.sort as LocationSortField) : "name";
  const order: SortOrder = search.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, Math.floor(search.page ?? 1));
  const hasFilters = Boolean(q || clientId || status);

  const list = useLocationsList({
    ...(debouncedQ ? { search: debouncedQ } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    ...(status ? { status } : {}),
    sort,
    order,
    page,
    limit: PAGE_SIZE,
  });

  const [unbindTarget, setUnbindTarget] = useState<LocationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const [clientTarget, setClientTarget] = useState<LocationRow | null>(null);

  const updateSearch = (patch: Record<string, string | number | undefined>) => {
    setSearch((previous) => ({ ...previous, ...patch }));
  };
  // Unbind and delete also change the Google accounts' bound counts.
  const refresh = () => invalidateGbpQueries(queryClient);

  const runRowAction = async (label: string, action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      await refresh();
      toast.success(success);
    } catch (err) {
      toast.error(isApiError(err) && err.message ? err.message : `${label} failed. Try again.`);
    }
  };

  const header = (
    <PageHeader
      title="Locations"
      description={DESCRIPTION}
      actions={
        <Button onClick={() => navigate("/locations/add")}>
          <MapPinPlus aria-hidden /> Add location
        </Button>
      }
    />
  );

  if (list.isPending) {
    return (
      <AppShell>
        {header}
        <TableSkeleton rows={6} columns={agency ? 9 : 8} />
      </AppShell>
    );
  }

  if (list.isError) {
    return (
      <AppShell>
        {header}
        <ErrorState
          description="We couldn't load your locations. Try again without leaving this page."
          onRetry={() => void list.refetch()}
        />
      </AppShell>
    );
  }

  const { locations, total, pending_gbp: pending = [], attribution } = list.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      {header}

      <PendingGbpSection picks={pending} clients={clients} />

      {total === 0 && !hasFilters ? (
        pending.length === 0 ? <NoLocationsEmpty /> : null
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search locations"
                value={q}
                onChange={(event) => updateSearch({ q: event.target.value || undefined, page: 1 })}
                placeholder="Search name or city"
                className="h-9 pl-9"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              {agency && clients.length > 0 ? (
                <Select value={clientId ?? "all"} onValueChange={(value) => updateSearch({ client: value === "all" ? undefined : value, page: 1 })}>
                  <SelectTrigger className="w-full bg-background sm:w-48" aria-label="Filter by client"><SelectValue placeholder="All clients" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map((client) => <SelectItem key={client.client_id} value={client.client_id}>{client.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <Select value={status ?? "all"} onValueChange={(value) => updateSearch({ status: value === "all" ? undefined : value, page: 1 })}>
                <SelectTrigger className="w-full bg-background sm:w-48" aria-label="Filter by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((value) => <SelectItem key={value} value={value}>{LOCATION_STATUS_LABEL[value]}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasFilters ? <Button variant="ghost" size="sm" onClick={() => setSearch({ sort, order, page: 1 })}><X aria-hidden /> Clear</Button> : null}
            </div>
          </div>

          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {total} {total === 1 ? "location" : "locations"}
            {list.isFetching ? <LoaderCircle aria-label="Updating" className="size-3.5 animate-spin" /> : null}
          </p>

          {locations.length === 0 ? (
            <NoResultsEmpty label="locations" onClear={() => setSearch({ sort, order, page: 1 })} />
          ) : (
            <LocationRowsTable
              locations={locations}
              agency={agency}
              sort={sort}
              order={order}
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              attribution={attribution?.text ?? null}
              onSort={(nextSort) => updateSearch({ sort: nextSort, order: sort === nextSort && order === "asc" ? "desc" : "asc", page: 1 })}
              onPageChange={(nextPage) => updateSearch({ page: nextPage })}
              actions={{
                onOpen: (location) => navigate(`/locations/${location.location_id}`),
                onContinueSetup: (location) => navigate(locationSetupPath(location.location_id)),
                onReconnect: () => connect(),
                onUnbind: setUnbindTarget,
                onDelete: setDeleteTarget,
                onSetClient: agency && clients.length > 0 ? setClientTarget : undefined,
              }}
            />
          )}
        </div>
      )}

      <GoogleAccountsPanel className="mt-6" />

      <ConfirmDialog
        open={unbindTarget !== null}
        onOpenChange={(open) => (open ? undefined : setUnbindTarget(null))}
        title={`Unbind ${unbindTarget?.name ?? "this location"} from Google?`}
        description="The location stays and its rankings keep working, but Google Business Profile data stops syncing and it's marked “GBP disconnected”. The Google account stays connected; pick the profile again and press Bind to reconnect it."
        cancelLabel="Keep bound"
        confirmLabel="Unbind"
        onConfirm={() => {
          const target = unbindTarget;
          setUnbindTarget(null);
          if (target) void runRowAction("Unbinding", () => unbindGbpLocation(target.location_id), `${target.name} unbound from Google`);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
        title={`Delete ${deleteTarget?.name ?? "this location"}?`}
        description="Tracking stops and scheduled runs are cancelled. History is kept, and the place can be added again later. A paid location slot stays paid until the period ends."
        cancelLabel="Keep location"
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target) void runRowAction("Deleting", () => deleteLocation(target.location_id), `${target.name} deleted`);
        }}
      />

      {clientTarget ? (
        <SetClientDialog
          location={clientTarget}
          clients={clients}
          onClose={() => setClientTarget(null)}
          onSave={(nextClientId) => {
            const target = clientTarget;
            setClientTarget(null);
            void runRowAction(
              "Updating the client",
              () => updateLocation(target.location_id, { client_id: nextClientId }),
              nextClientId ? `${target.name} moved to ${clients.find((c) => c.client_id === nextClientId)?.name ?? "the client"}` : `${target.name} has no client now`,
            );
          }}
        />
      ) : null}
    </AppShell>
  );
}

function SetClientDialog({
  location,
  clients,
  onClose,
  onSave,
}: {
  location: LocationRow;
  clients: ClientRecord[];
  onClose: () => void;
  onSave: (clientId: string | null) => void;
}) {
  const [clientId, setClientId] = useState<string | null>(location.client?.client_id ?? null);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client for {location.name}</DialogTitle>
          <DialogDescription>Clients are an optional grouping. Choose "No client" to unassign.</DialogDescription>
        </DialogHeader>
        <ClientSelect id="location-client" clients={clients} value={clientId} onChange={setClientId} label="Client" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={clientId === (location.client?.client_id ?? null)} onClick={() => onSave(clientId)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationsPage;
