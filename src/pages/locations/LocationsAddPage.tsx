import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Building2, Check, Link2, ListChecks, LoaderCircle, MapPin, MapPinPlus, Plus, Search } from "lucide-react";
import { apiErrorData, isApiError, searchPlaces, type PlaceSearchResponse, type PlaceSearchResult } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { PendingGbpSection } from "@/components/gbp-connect/pending-gbp-section";
import { ClientSelect } from "@/components/location/client-select";
import { LocationSlotDialog } from "@/components/location/location-billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanEdit } from "@/hooks/use-access";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { clientErrorText, useClientRequired } from "@/lib/clients/clients";
import { useGbpConnections } from "@/lib/gbp/use-gbp";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath, runLocationAction } from "@/lib/locations/location-actions";
import { useLocationBillingGate } from "@/lib/locations/use-location-billing-gate";
import { LOCATIONS_QUERY_KEY, useClients, useLocationsList } from "@/lib/locations/use-locations";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * Add a location, two ways: (a) connect Google and pick Business Profiles (recommended when you
 * manage the business on Google), or (b) find the business on Google Maps and add it here directly
 * (rankings and citations only). Profiles already picked wait at the top ("Ready to add"), so every
 * way in (setup checklist, dashboard, sidebar) reaches them with one click.
 */
function AddLocationPage() {
  const canEdit = useCanEdit();
  const workspace = useWorkspace();
  const agency = workspace.organization?.accountType === "agency";
  const { clients } = useClients(agency);
  // `pending_gbp` comes with any page of the list (outside its filters and paging); one row is enough.
  const list = useLocationsList({ page: 1, limit: 1 });
  const picks = canEdit ? (list.data?.pending_gbp ?? []) : [];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        icon={MapPinPlus}
        tone="locations"
        title="Add a location"
        eyebrow={
          <Link
            to="/locations"
            // The ::after pads the small link out to a finger-sized target without moving the layout.
            className="relative inline-flex items-center gap-1 rounded-sm font-medium text-muted-foreground outline-hidden after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden className="size-3.5" /> Locations
          </Link>
        }
        description="A location is a business you track on Google Maps. Pick the way that fits it."
      />

      {/* Picked profiles first: adding one is the quickest way in, and the page's main action. */}
      <PendingGbpSection picks={picks} clients={clients} primary />

      <GoogleOption picksShown={picks.length > 0} />

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border-strong" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border-strong" />
      </div>

      <PlacesSearchAdd />
    </div>
  );
}

const GOOGLE_BENEFITS = ["Rankings and directory listings", "Reviews, with AI reply drafts", "Posts and profile insights"];

/**
 * Option A: through Google. Shows the accounts already connected, so a second visit is one click.
 * While picked profiles wait above (`picksShown`), adding those is the main action, so its buttons
 * step back to outline.
 */
function GoogleOption({ picksShown }: { picksShown: boolean }) {
  const { connect } = useGbpConnect();
  const { connections, isPending } = useGbpConnections();
  const active = connections.filter((connection) => connection.status === "active");
  const variant = picksShown ? "outline" : "default";

  return (
    <section aria-labelledby="google-option-title" className="overflow-hidden rounded-xl border border-primary/30 bg-card shadow-card">
      <div className="flex flex-col gap-5 bg-linear-to-br from-brand-tint/80 via-card to-card p-5 sm:flex-row sm:items-start">
        <IconChip icon={Building2} tone="gbp" size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="google-option-title" className="text-base font-semibold text-foreground">
              Connect a Google Business Profile
            </h2>
            <StatusBadge tone="brand" size="sm">
              Recommended
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            For businesses you manage on Google. Sign in with the Google account that manages them and choose the profiles to track.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {GOOGLE_BENEFITS.map((benefit) => (
              <li key={benefit} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <Check aria-hidden className="size-4 text-success" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border p-5">
        {isPending ? (
          <Skeleton className="h-9 w-56 rounded-lg" />
        ) : active.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Choose from a connected Google account</p>
            <ul className="space-y-2">
              {active.map((connection) => (
                <li key={connection.google_sub} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{connection.google_email}</span>
                    <span className="block text-xs text-muted-foreground">
                      {connection.bound} {connection.bound === 1 ? "location" : "locations"} added · {connection.picked} ready to add
                    </span>
                  </span>
                  <Button size="sm" variant={variant} onClick={() => connect({ googleSub: connection.google_sub, googleEmail: connection.google_email })}>
                    <ListChecks aria-hidden /> Choose profiles
                  </Button>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={() => connect()}>
              <Link2 aria-hidden /> Connect another Google account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">MyPageSEO reads the profiles you choose, and nothing is added until you confirm.</p>
            <Button variant={variant} onClick={() => connect()} className="shrink-0">
              <Link2 aria-hidden /> Connect Google
            </Button>
          </div>
        )}
        {/* With picks waiting, the list above already says it. */}
        {picksShown ? null : (
          <p className="mt-4 text-xs text-muted-foreground">
            Profiles you pick wait under "Ready to add", at the top of this page and on the{" "}
            <Link to="/locations" className="font-medium text-primary underline-offset-4 hover:underline">
              Locations
            </Link>{" "}
            page. Press Add on each one to start tracking it.
          </p>
        )}
      </div>
    </section>
  );
}

/** Option B: a Google Maps search (one paid Places call per search), each result added with one click. */
function PlacesSearchAdd() {
  const workspace = useWorkspace();
  const agency = workspace.organization?.accountType === "agency";
  const { clients } = useClients(agency);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceSearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const clientRequired = useClientRequired();
  const [adding, setAdding] = useState<string | null>(null);
  const gate = useLocationBillingGate();
  const askClient = agency && (clients.length > 0 || clientRequired);

  // Each search is one paid Places call, so it runs on submit, not while typing.
  const search = async () => {
    const q = query.trim();
    if (q.length < 2 || q.length > 100) {
      setSearchError("Enter 2–100 characters, for example the business name and its city.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(q));
    } catch (err) {
      setResults(null);
      setSearchError(
        isApiError(err) && err.status === 429
          ? "Today's search limit is reached. Try again tomorrow."
          : isApiError(err) && err.reason === "subscription_required"
            ? "A subscription is needed to search for new locations."
            : "The search didn't work. Try again.",
      );
    } finally {
      setSearching(false);
    }
  };

  const add = async (action: PendingLocationAction) => {
    setAdding(action.kind === "add" ? action.placeId : null);
    try {
      const locationId = await runLocationAction(action);
      await queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      toast.success(`${action.title} added`, { description: "Choose its keywords and competitors next." });
      navigate(locationSetupPath(locationId));
    } catch (err) {
      if (gate.handle(err, action)) return;
      if (isApiError(err) && err.reason === "duplicate_place") {
        const existing = apiErrorData(err).location_id;
        // A member limited to its clients may get a location it can't open (another client's): no link then.
        const visible = typeof existing === "string" && workspace.locations.some((location) => location.id === existing);
        toast.error(
          visible ? `${action.title} is already one of your locations.` : "This business is already in your organization (managed by another team member).",
          visible ? { action: { label: "Open", onClick: () => navigate(locationPath(existing)) } } : undefined,
        );
      } else if (isApiError(err) && ["client_required", "client_not_assigned"].includes(err.reason ?? "")) {
        toast.error(clientErrorText(err, `${action.title} could not be added.`));
      } else {
        toast.error(isApiError(err) && err.message ? err.message : `${action.title} could not be added. Try again.`);
      }
    } finally {
      setAdding(null);
    }
  };

  const addResult = (result: PlaceSearchResult) => {
    if (clientRequired && !clientId) {
      toast.error("Choose the client this location belongs to first.");
      return;
    }
    void add({ kind: "add", placeId: result.place_id, title: result.name, ...(clientId ? { clientId } : {}) });
  };

  return (
    <section aria-labelledby="maps-option-title" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <IconChip icon={MapPin} tone="locations" size="lg" />
        <div className="min-w-0 flex-1">
          <h2 id="maps-option-title" className="text-base font-semibold text-foreground">
            Find the business on Google Maps
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For businesses you don't manage on Google: you get rankings and directory listings, and can connect the profile later. US and Canada.
          </p>
        </div>
      </div>
      <div className="space-y-4 border-t border-border p-5">
        <form
          role="search"
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Business name and city"
              value={query}
              maxLength={100}
              placeholder="Business name and city, e.g. Harbor Dental Toronto"
              className="pl-9"
              aria-invalid={searchError ? true : undefined}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchError(null);
              }}
            />
          </div>
          {/* Outline: the recommended Google path above holds the page's filled action. */}
          <Button type="submit" variant="outline" disabled={searching} aria-busy={searching}>
            {searching ? <LoaderCircle aria-hidden className="animate-spin" /> : <Search aria-hidden />} {searching ? "Searching…" : "Search"}
          </Button>
        </form>

        {searchError ? (
          <p role="alert" className="text-sm font-medium text-critical">
            {searchError}
          </p>
        ) : null}

        {askClient && results && results.results.length > 0 ? (
          <div className="max-w-sm">
            <ClientSelect id="add-client" clients={clients} value={clientId} onChange={setClientId} />
          </div>
        ) : null}

        {results ? (
          results.results.length === 0 ? (
            <EmptyState
              variant="no-results"
              title="Nothing found"
              description="Try the business name with its city, or check the spelling."
            />
          ) : (
            <div className="space-y-2">
              <ul aria-label="Search results" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {results.results.map((result) => (
                  <PlaceResult
                    key={result.place_id}
                    result={result}
                    visible={(id) => workspace.locations.some((location) => location.id === id)}
                    adding={adding}
                    onAdd={addResult}
                  />
                ))}
              </ul>
              {results.attribution ? <p className="text-xs text-muted-foreground">{results.attribution.text}</p> : null}
            </div>
          )
        ) : null}
      </div>
      {gate.payment ? (
        <LocationSlotDialog
          action={gate.payment.action}
          quote={gate.payment.quote}
          onClose={gate.closePayment}
          onFulfilled={() => {
            const action = gate.payment!.action;
            gate.closePayment();
            void add(action);
          }}
        />
      ) : null}
    </section>
  );
}

function PlaceResult({
  result,
  visible,
  adding,
  onAdd,
}: {
  result: PlaceSearchResult;
  visible: (locationId: string) => boolean;
  adding: string | null;
  onAdd: (result: PlaceSearchResult) => void;
}) {
  const added = result.already_added ?? null;
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <span className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-tint text-primary">
          <MapPin className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{result.name}</span>
          {result.address ? <span className="mt-0.5 block text-xs text-muted-foreground">{result.address}</span> : null}
        </span>
      </span>
      <span className="flex shrink-0 justify-end pl-11 sm:pl-0">
        {added ? (
          visible(added) ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={locationPath(added)}>
                <Check aria-hidden className="text-success" /> Already added <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Managed by another team member</span>
          )
        ) : (
          <Button size="sm" variant="secondary" disabled={adding !== null} aria-busy={adding === result.place_id} onClick={() => onAdd(result)}>
            {adding === result.place_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
            {adding === result.place_id ? "Adding…" : "Add"}
          </Button>
        )}
      </span>
    </li>
  );
}

export default AddLocationPage;
