import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Link2, LoaderCircle, MapPin, MapPinPlus, Search, X } from "lucide-react";
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
import { preloadPath } from "@/app/route-preload";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { NoResultsEmpty } from "@/components/layout/shared/feedback/empty-states";
import type { SortOrder } from "@/components/layout/shared/data-table";
import { GoogleAccountsPanel } from "@/components/gbp-connect/google-accounts-panel";
import { PendingGbpSection } from "@/components/gbp-connect/pending-gbp-section";
import { ClientSelect } from "@/components/location/client-select";
import { LocationRowsTable } from "@/components/location/location-rows-table";
import { RemoveLocationDialog } from "@/components/location/remove-location-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCanEdit } from "@/hooks/use-access";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useClientRequired } from "@/lib/clients/clients";
import { invalidateGbpQueries, useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { LOCATION_STATUS_META, LOCATION_STATUS_ORDER } from "@/lib/locations/location-status";
import { useClients, useLocationsList } from "@/lib/locations/use-locations";
import { locationPath } from "@/lib/mypageseo/section-links";
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
/** Longest search the locations API accepts. */
const MAX_SEARCH = 100;
const SORTS: LocationSortField[] = ["name", "city", "rank", "gbp_score", "rating", "citation_score", "last_refreshed"];
/**
 * First click on a column: names A–Z, ranks best (lowest) first, scores and ratings highest first,
 * "Refreshed" newest first. A second click flips it.
 */
const FIRST_ORDER: Record<LocationSortField, SortOrder> = {
  name: "asc",
  city: "asc",
  rank: "asc",
  gbp_score: "desc",
  rating: "desc",
  citation_score: "desc",
  last_refreshed: "desc",
};

/** The sorts offered on phones (the table's headers aren't there). */
const MOBILE_SORTS: { value: `${LocationSortField}:${SortOrder}`; label: string }[] = [
  { value: "name:asc", label: "Name, A–Z" },
  { value: "rank:asc", label: "Best average rank" },
  { value: "gbp_score:desc", label: "Highest profile score" },
  { value: "rating:desc", label: "Highest rating" },
  { value: "citation_score:desc", label: "Highest citation score" },
  { value: "last_refreshed:desc", label: "Recently refreshed" },
];

/** Delays a fast-changing value (the search box) so each keystroke doesn't send a request. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Every location of the organization, searchable and filterable, sorted and paged on the server.
 * Profiles picked from Google but not added yet wait at the top ("Ready to add").
 */
function LocationsPage() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { connect } = useGbpConnect();
  const [search, setSearch] = useTypedSearch(searchSchema);
  const agency = workspace.organization?.accountType === "agency";
  const { clients } = useClients(agency);

  // The API rejects a search longer than 100 characters.
  const q = (search.q ?? "").slice(0, MAX_SEARCH);
  const debouncedQ = useDebounced(q.trim());
  const clientId = search.client ?? null;
  const status = LOCATION_STATUS_ORDER.includes(search.status as LocationStatus) ? (search.status as LocationStatus) : null;
  const sort = SORTS.includes(search.sort as LocationSortField) ? (search.sort as LocationSortField) : "name";
  const order: SortOrder = search.order === "asc" || search.order === "desc" ? search.order : FIRST_ORDER[sort];
  const page = Math.max(1, Math.floor(search.page ?? 1));
  const hasFilters = Boolean(q || clientId || status);
  // What the list on screen was loaded with: the search box runs ahead of it while the request waits.
  const listFiltered = Boolean(debouncedQ || clientId || status);

  const list = useLocationsList({
    ...(debouncedQ ? { search: debouncedQ } : {}),
    ...(clientId ? { client_id: clientId } : {}),
    ...(status ? { status } : {}),
    sort,
    order,
    page,
    limit: PAGE_SIZE,
  });

  const canEdit = useCanEdit();
  const [unbindTarget, setUnbindTarget] = useState<LocationRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const [clientTarget, setClientTarget] = useState<LocationRow | null>(null);

  const updateSearch = (patch: Record<string, string | number | undefined>) => {
    setSearch((previous) => ({ ...previous, ...patch }));
  };
  // Typing replaces the history entry (Back leaves the page, not one letter) and is committed at
  // once, so the box bound to the address keeps every keystroke and its caret.
  const updateQuery = (value: string) =>
    setSearch((previous) => ({ ...previous, q: value || undefined, page: undefined }), { replace: true, flushSync: true });
  const clearFilters = () => setSearch(sort === "name" && order === "asc" ? {} : { sort, order });
  // Unbind and delete also change the Google accounts' counts and the setup checklist.
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

  // No location yet, but profiles picked from Google: adding one of those is the page's main action.
  const noneYet = Boolean(list.data && list.data.total === 0 && !listFiltered && !list.isPlaceholderData);
  const picksFirst = canEdit && noneYet && (list.data?.pending_gbp?.length ?? 0) > 0;

  const header = (
    <PageHeader
      icon={MapPin}
      tone="locations"
      title="Locations"
      description="Every business you track. Open one for its rankings, Google profile, reviews and more."
      actions={
        canEdit ? (
          <Button asChild variant={picksFirst ? "outline" : "default"}>
            <Link to="/locations/add" onPointerEnter={() => preloadPath("/locations/add")}>
              <MapPinPlus aria-hidden /> Add location
            </Link>
          </Button>
        ) : null
      }
    />
  );

  if (list.isPending) {
    return (
      <>
        {header}
        <TableSkeleton rows={6} columns={7} />
      </>
    );
  }

  if (list.isError) {
    return (
      <>
        {header}
        <ErrorState description="We couldn't load your locations. Try again without leaving this page." onRetry={() => void list.refetch()} />
      </>
    );
  }

  const { locations, total, pending_gbp: pending = [], attribution } = list.data;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toolbar = (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search locations"
          value={q}
          maxLength={MAX_SEARCH}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder="Search by name or city"
          className="h-9 pl-9"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        {agency && clients.length > 0 ? (
          <Select value={clientId ?? "all"} onValueChange={(value) => updateSearch({ client: value === "all" ? undefined : value, page: undefined })}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by client">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.client_id} value={client.client_id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={status ?? "all"} onValueChange={(value) => updateSearch({ status: value === "all" ? undefined : value, page: undefined })}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LOCATION_STATUS_ORDER.map((value) => (
              <SelectItem key={value} value={value}>
                {LOCATION_STATUS_META[value].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Phones get cards instead of the table, so the column sort moves into a select. */}
        <Select
          // "" shows the placeholder when the URL holds an order the list doesn't offer.
          value={MOBILE_SORTS.some((option) => option.value === `${sort}:${order}`) ? `${sort}:${order}` : ""}
          onValueChange={(value) => {
            const [nextSort, nextOrder] = value.split(":") as [LocationSortField, SortOrder];
            const isDefault = nextSort === "name" && nextOrder === "asc";
            updateSearch({ sort: isDefault ? undefined : nextSort, order: isDefault ? undefined : nextOrder, page: undefined });
          }}
        >
          <SelectTrigger className="w-full md:hidden" aria-label="Sort locations">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {MOBILE_SORTS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X aria-hidden /> Clear
          </Button>
        ) : null}
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground lg:ml-auto" aria-live="polite">
        {list.isFetching ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : null}
        <span>
          <span className="font-semibold tabular-nums text-foreground">{total.toLocaleString()}</span> {total === 1 ? "location" : "locations"}
          {hasFilters ? " match" : ""}
        </span>
      </p>
    </div>
  );

  return (
    <>
      {header}

      {canEdit ? <PendingGbpSection picks={pending} clients={clients} primary={picksFirst} /> : null}

      {/* Only an unfiltered answer that has really arrived means "no locations yet": clearing a
          search that matched nothing keeps the table (and the focused search box) until it loads. */}
      {total === 0 && !listFiltered && !list.isPlaceholderData ? (
        pending.length === 0 ? (
          <EmptyState
            icon={MapPinPlus}
            tone="locations"
            title="Add your first location"
            description="A location is a business you track: where it ranks on Google Maps, how its Google profile performs, its reviews and its listings."
            {...(canEdit
              ? {
                  action: (
                    <Button asChild>
                      <Link to="/locations/add">
                        <MapPinPlus aria-hidden /> Add location
                      </Link>
                    </Button>
                  ),
                  secondaryAction: (
                    <Button variant="outline" onClick={() => connect()}>
                      <Link2 aria-hidden /> Connect Google
                    </Button>
                  ),
                }
              : {})}
          />
        ) : null
      ) : (
        // With or without results the toolbar stays in the same place, so the search box keeps focus
        // while typing turns the results into "no match" and back.
        <LocationRowsTable
          empty={<NoResultsEmpty label="locations" onClear={clearFilters} />}
          locations={locations}
          agency={agency}
          sort={sort}
          order={order}
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          total={total}
          pageSize={PAGE_SIZE}
          attribution={attribution?.text ?? null}
          toolbar={toolbar}
          onSort={(nextSort) => {
            const nextOrder: SortOrder = sort === nextSort ? (order === "asc" ? "desc" : "asc") : FIRST_ORDER[nextSort];
            const isDefault = nextSort === "name" && nextOrder === "asc";
            updateSearch({ sort: isDefault ? undefined : nextSort, order: isDefault ? undefined : nextOrder, page: undefined });
          }}
          onPageChange={(nextPage) => updateSearch({ page: nextPage > 1 ? nextPage : undefined })}
          actions={{
            onOpen: (location) => navigate(locationPath(location.location_id)),
            ...(canEdit
              ? {
                  onContinueSetup: (location: LocationRow) => navigate(locationSetupPath(location.location_id)),
                  onReconnect: () => connect(),
                  onUnbind: setUnbindTarget,
                  onDelete: setDeleteTarget,
                  onSetClient: agency && clients.length > 0 ? setClientTarget : undefined,
                }
              : {}),
          }}
        />
      )}

      {canEdit ? <GoogleAccountsPanel /> : null}

      <ConfirmDialog
        open={unbindTarget !== null}
        onOpenChange={(open) => (open ? undefined : setUnbindTarget(null))}
        title={`Disconnect the Google profile of ${unbindTarget?.name ?? "this location"}?`}
        description="The location stays and its rankings keep working, but its Google Business Profile data, reviews and posts stop updating, and it shows as “Profile disconnected”. The Google account stays connected: pick the profile again and add it to reconnect."
        cancelLabel="Keep connected"
        confirmLabel="Disconnect profile"
        onConfirm={() => {
          const target = unbindTarget;
          setUnbindTarget(null);
          if (target) void runRowAction("Disconnecting", () => unbindGbpLocation(target.location_id), `${target.name} is disconnected from Google`);
        }}
      />

      {/* Also says when the location's unused AI replies of a started block would be lost (2026-11-17). */}
      <RemoveLocationDialog
        location={deleteTarget}
        onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
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
    </>
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
  const required = useClientRequired();
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client for {location.name}</DialogTitle>
          <DialogDescription>{required ? "Move this location to another of your clients." : 'Clients are an optional grouping. Choose "No client" to unassign.'}</DialogDescription>
        </DialogHeader>
        <ClientSelect id="location-client" clients={clients} value={clientId} onChange={setClientId} label="Client" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={clientId === (location.client?.client_id ?? null) || (required && !clientId)} onClick={() => onSave(clientId)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationsPage;
