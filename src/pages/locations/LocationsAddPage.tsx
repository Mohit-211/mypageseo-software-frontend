import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, LoaderCircle, MapPin, Search } from "lucide-react";
import { apiErrorData, isApiError, searchPlaces, type PlaceSearchResponse, type PlaceSearchResult } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { ClientSelect } from "@/components/location/client-select";
import { LocationSlotDialog } from "@/components/location/location-billing";
import { locationSetupPath, runLocationAction } from "@/lib/locations/location-actions";
import { useLocationBillingGate } from "@/lib/locations/use-location-billing-gate";
import { GoogleBusinessConnection } from "@/components/location/location-setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { LOCATIONS_QUERY_KEY, useClients } from "@/lib/locations/use-locations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

/**
 * Add a location: (a) through Google — the connect modal picks profiles, which are
 * bound from the Locations page; or (b) from a Places search, added here directly.
 */
function AddLocationPage() {
  const { connect } = useGbpConnect();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link>
        </Button>

        <PageHeader
          title="Add a location"
          description="A location is a business that Mypageseo tracks for local search performance."
        />

        <GoogleBusinessConnection state="disconnected" onConnect={() => connect()} onRetry={() => connect()} />
        <p className="text-sm text-muted-foreground">
          Profiles you pick from Google appear on the Locations page as "Not bound"; press Bind to add each one.
        </p>

        <PlacesSearchAdd />
      </div>
    </AppShell>
  );
}

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
  const [selected, setSelected] = useState<PlaceSearchResult | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const gate = useLocationBillingGate();

  // Each search is one paid Places call, so it runs on submit, not while typing.
  const search = async () => {
    const q = query.trim();
    if (q.length < 2 || q.length > 100) {
      setSearchError("Enter 2–100 characters, e.g. the business name and city.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      setResults(await searchPlaces(q));
    } catch (err) {
      setResults(null);
      setSearchError(
        isApiError(err) && err.status === 429
          ? "The daily search limit is reached. Try again tomorrow."
          : isApiError(err) && err.reason === "subscription_required"
            ? "A subscription is needed to search for new locations."
            : "The search failed. Try again.",
      );
    } finally {
      setSearching(false);
    }
  };

  const add = async (action: PendingLocationAction) => {
    setAdding(true);
    try {
      const locationId = await runLocationAction(action);
      await queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
      navigate(locationSetupPath(locationId));
    } catch (err) {
      if (gate.handle(err, action)) return;
      if (isApiError(err) && err.reason === "duplicate_place") {
        const existing = apiErrorData(err).location_id;
        toast.error(`${action.title} is already one of your locations.`, {
          ...(typeof existing === "string"
            ? { action: { label: "Open", onClick: () => navigate(`/locations/${existing}`) } }
            : {}),
        });
      } else {
        toast.error(isApiError(err) && err.message ? err.message : `${action.title} could not be added. Try again.`);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <Panel title="Or find the business on Google Maps" description="For businesses without a Business Profile you manage. US and Canada only.">
      <div className="space-y-4">
        <form
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
              placeholder="Business name and city"
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchError(null);
              }}
            />
          </div>
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? <LoaderCircle aria-hidden className="animate-spin" /> : <Search aria-hidden />} Search
          </Button>
        </form>

        {searchError ? <p role="alert" className="text-sm text-critical">{searchError}</p> : null}

        {results ? (
          results.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing found. Try the business name with its city.</p>
          ) : (
            <div className="space-y-2">
              <ul className="divide-y divide-border rounded-md border border-border">
                {results.results.map((result) => {
                  const added = result.already_added ?? null;
                  const isSelected = selected?.place_id === result.place_id;
                  return (
                    <li key={result.place_id}>
                      {added ? (
                        <div className="flex items-center justify-between gap-3 p-3">
                          <PlaceText result={result} />
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/locations/${added}`}>Already added</Link>
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelected(result)}
                          className={cn("flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/40", isSelected && "bg-brand-tint")}
                        >
                          <PlaceText result={result} />
                          {isSelected ? <StatusBadge tone="brand"><CheckCircle2 className="size-3" aria-hidden /> Selected</StatusBadge> : null}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {results.attribution ? <p className="text-[11px] text-muted-foreground">{results.attribution.text}</p> : null}
            </div>
          )
        ) : null}

        {selected ? (
          <div className="space-y-4 border-t border-border pt-4">
            {agency && clients.length > 0 ? (
              <div className="max-w-sm">
                <ClientSelect id="add-client" clients={clients} value={clientId} onChange={setClientId} />
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button
                disabled={adding}
                onClick={() =>
                  void add({ kind: "add", placeId: selected.place_id, title: selected.name, ...(clientId ? { clientId } : {}) })
                }
              >
                {adding ? <LoaderCircle aria-hidden className="animate-spin" /> : <CheckCircle2 aria-hidden />}
                Add {selected.name}
              </Button>
            </div>
          </div>
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
    </Panel>
  );
}

function PlaceText({ result }: { result: PlaceSearchResult }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm font-medium text-foreground">{result.name}</span>
      {result.address ? (
        <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
          {result.address}
        </span>
      ) : null}
    </span>
  );
}

export default AddLocationPage;
