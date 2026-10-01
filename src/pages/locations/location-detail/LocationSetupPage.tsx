import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, LoaderCircle, MapPin, Plus, Search, Star, X } from "lucide-react";
import {
  completeOnboarding,
  getCompetitorSuggestions,
  getRankRun,
  getTracking,
  isApiError,
  searchPlaces,
  setLocationCenter,
  updateTracking,
  type LocationCenterResult,
  type LocationHeader,
  type LocationOnboardingStep,
  type PlaceSearchResult,
} from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PinsMap } from "@/components/ranking/rank-map";
import { PlaceAutocomplete } from "@/components/location/place-autocomplete";
import { useRequiredParams } from "@/hooks/use-required-params";
import { LOCATIONS_QUERY_KEY, useLocation } from "@/lib/locations/use-locations";
import { cn } from "@/lib/utils";

/**
 * Setup for a new or linked location (FLOWS.md flow 1, steps 4–8): business
 * center (service-area businesses only) → keywords → competitors → finish, which
 * queues the first rank run; the run is then polled until it ends.
 */
type Stage = "center" | "keywords" | "competitors" | "finish";

const MAX_KEYWORDS = 20;
const MAX_COMPETITORS = 5;
const RUN_POLL_MS = 10_000;

function stageFor(step: LocationOnboardingStep | undefined): Stage | "done" {
  switch (step) {
    case "center_needed":
      return "center";
    case "keywords_set":
      return "competitors";
    case "competitors_set":
      return "finish";
    case "completed":
      return "done";
    default:
      return "keywords";
  }
}

function errorText(err: unknown, fallback: string) {
  return isApiError(err) && err.message ? err.message : fallback;
}

function LocationSetupPage() {
  const { locationId } = useRequiredParams("locationId");
  const location = useLocation(locationId);

  if (location.isPending) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }
  if (location.isError) {
    const notFound = isApiError(location.error) && location.error.status === 404;
    return (
      <AppShell>
        {notFound ? (
          <EmptyState
            title="Location not found"
            description="It may have been deleted. Choose one from your locations list."
            action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
          />
        ) : (
          <ErrorState description="We couldn't load this location." onRetry={() => void location.refetch()} />
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SetupFlow key={location.data.location_id} location={location.data} />
    </AppShell>
  );
}

function SetupFlow({ location }: { location: LocationHeader }) {
  const queryClient = useQueryClient();
  const step = location.onboarding?.step;
  const serviceArea = step === "center_needed" || step === "center_set";
  const [stage, setStage] = useState<Stage | "done">(() =>
    location.onboarding ? stageFor(step) : location.status === "setup_required" ? "keywords" : "done",
  );
  const [runId, setRunId] = useState<string | null>(null);

  const stages: { id: Stage; label: string }[] = [
    ...(serviceArea ? [{ id: "center" as const, label: "Business center" }] : []),
    { id: "keywords", label: "Keywords" },
    { id: "competitors", label: "Competitors" },
    { id: "finish", label: "Finish" },
  ];
  const currentIndex = stage === "done" ? stages.length : stages.findIndex((entry) => entry.id === stage);

  const advance = (next: Stage | "done") => {
    void queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY });
    setStage(next);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={`/locations/${location.location_id}`}><ArrowLeft aria-hidden /> {location.name}</Link>
      </Button>
      <PageHeader
        title={stage === "done" ? "Setup complete" : `Set up ${location.name}`}
        description={[location.address ?? location.city, location.country].filter(Boolean).join(" · ")}
      />

      <ol className="flex flex-wrap gap-2" aria-label="Setup steps">
        {stages.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              // Earlier steps can be revisited; later ones open in order.
              disabled={index > currentIndex || stage === "done"}
              onClick={() => setStage(entry.id)}
              aria-current={entry.id === stage ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                entry.id === stage
                  ? "border-primary bg-brand-tint text-primary"
                  : index < currentIndex
                    ? "border-border text-foreground hover:bg-muted/40"
                    : "border-border text-muted-foreground",
              )}
            >
              {index < currentIndex ? <CheckCircle2 aria-hidden className="size-3.5 text-success" /> : <span aria-hidden>{index + 1}.</span>}
              {entry.label}
            </button>
          </li>
        ))}
      </ol>

      {stage === "center" ? (
        <CenterStep locationId={location.location_id} onDone={() => advance("keywords")} />
      ) : stage === "keywords" ? (
        <KeywordsStep locationId={location.location_id} onDone={() => advance("competitors")} />
      ) : stage === "competitors" ? (
        <CompetitorsStep locationId={location.location_id} onDone={() => advance("finish")} />
      ) : stage === "finish" ? (
        <FinishStep
          locationId={location.location_id}
          onBack={() => setStage("competitors")}
          onCenterMissing={serviceArea ? () => setStage("center") : undefined}
          onKeywordsMissing={() => setStage("keywords")}
          onDone={(nextRunId) => {
            setRunId(nextRunId);
            advance("done");
          }}
        />
      ) : (
        <DoneStep locationId={location.location_id} runId={runId} />
      )}
    </div>
  );
}

function CenterStep({ locationId, onDone }: { locationId: string; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the city / ZIP resolved to, shown for confirmation before continuing. */
  const [resolved, setResolved] = useState<LocationCenterResult | null>(null);

  const saveCenter = async (input: { query: string } | { place_id: string; session: string }) => {
    setSaving(true);
    setError(null);
    try {
      setResolved(await setLocationCenter(locationId, input));
    } catch (err) {
      const status = isApiError(err) ? err.status : 0;
      setError(
        status === 404
          ? "Nothing was found for that city or ZIP. Pick one from the list, or try another."
          : status === 429
            ? "The daily search limit is reached. Try again tomorrow."
            : errorText(err, "The center could not be saved. Try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  // Free text is the fallback when no suggestion was picked.
  const saveTyped = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setError("Pick a city or ZIP from the list, or type it in full (2–100 characters).");
      return;
    }
    void saveCenter({ query: trimmed });
  };

  if (resolved) {
    return (
      <Panel title="Is this the right place?" description="Rankings will be measured from points around this center.">
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Centered on <span className="font-semibold">{resolved.center_label}</span>
          </p>
          <PinsMap
            className="h-64 w-full rounded-md"
            pins={[{ key: "center", lat: resolved.lat, lng: resolved.lng, rank: 1, name: resolved.center_label, kind: "self" }]}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setResolved(null)}>Use a different place</Button>
            <Button onClick={onDone}>Looks right, continue</Button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Where does this business serve customers?" description="It's a service-area business without a public address, so rankings are measured around the city or ZIP you choose.">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          saveTyped();
        }}
      >
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="setup-center">City or ZIP / postal code</Label>
          <PlaceAutocomplete
            id="setup-center"
            locationId={locationId}
            value={query}
            disabled={saving}
            invalid={Boolean(error)}
            onChange={(value) => {
              setQuery(value);
              setError(null);
            }}
            onPick={(suggestion, session) => void saveCenter({ place_id: suggestion.place_id, session })}
          />
          <p className="text-xs text-muted-foreground">Pick from the list so we know exactly which place you mean.</p>
        </div>
        {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Use what I typed
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function KeywordsStep({ locationId, onDone }: { locationId: string; onDone: () => void }) {
  const tracking = useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "tracking", locationId],
    queryFn: ({ signal }) => getTracking(locationId, signal),
  });
  const [edited, setEdited] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const keywords = edited ?? tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];

  const addDraft = () => {
    const value = draft.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length < 2 || value.length > 80) return setError("Each keyword needs 2–80 characters.");
    if (keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())) return setError("That keyword is already in the list.");
    if (keywords.length >= MAX_KEYWORDS) return setError(`Up to ${MAX_KEYWORDS} keywords.`);
    setEdited([...keywords, value]);
    setDraft("");
    setError(null);
  };

  const save = async () => {
    if (keywords.length === 0) return setError("Add at least one keyword.");
    setSaving(true);
    setError(null);
    try {
      await updateTracking(locationId, { keywords });
      onDone();
    } catch (err) {
      setError(errorText(err, "The keywords could not be saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Keywords to track" description="The local searches customers use to find this business, e.g. “emergency plumber”. Up to 20.">
      {tracking.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addDraft();
            }}
          >
            <Input
              aria-label="New keyword"
              value={draft}
              maxLength={80}
              placeholder="emergency plumber"
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
            />
            <Button type="submit" variant="outline"><Plus aria-hidden /> Add</Button>
          </form>
          {keywords.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <li key={keyword}>
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {keyword}
                    <button
                      type="button"
                      aria-label={`Remove ${keyword}`}
                      className="rounded p-0.5 hover:bg-muted"
                      onClick={() => setEdited(keywords.filter((item) => item !== keyword))}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No keywords yet.</p>
          )}
          {tracking.isError ? <p className="text-xs text-muted-foreground">Saved keywords couldn't be loaded; anything you save here replaces them.</p> : null}
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          <div className="flex justify-end">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save and continue
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

type Candidate = { place_id: string; name: string; address: string | null; detail?: string };

function suggestionsErrorText(err: unknown) {
  if (!isApiError(err)) return "Suggestions couldn't be loaded.";
  if (err.reason === "keywords_required") return "Add keywords first; suggestions are based on them.";
  if (err.status === 429) return "The daily search limit is reached, so no suggestions today. You can continue without competitors.";
  if (err.status === 502) return "Google didn't answer. Try again, or continue without competitors.";
  return err.message || "Suggestions couldn't be loaded.";
}

function CompetitorsStep({ locationId, onDone }: { locationId: string; onDone: () => void }) {
  const tracking = useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "tracking", locationId],
    queryFn: ({ signal }) => getTracking(locationId, signal),
  });
  const suggestions = useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "competitor-suggestions", locationId],
    queryFn: ({ signal }) => getCompetitorSuggestions(locationId, signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [edited, setEdited] = useState<string[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = edited ?? tracking.data?.tracking.competitors ?? [];
  const known = new Map<string, Candidate>();
  for (const suggestion of suggestions.data?.suggestions ?? []) {
    known.set(suggestion.place_id, {
      place_id: suggestion.place_id,
      name: suggestion.name,
      address: suggestion.address,
      ...(suggestion.best_position != null ? { detail: `Best position #${suggestion.best_position}` } : {}),
    });
  }
  for (const result of searchResults ?? []) {
    if (!known.has(result.place_id)) known.set(result.place_id, { place_id: result.place_id, name: result.name, address: result.address });
  }

  const toggle = (placeId: string, checked: boolean) => {
    if (checked && selected.length >= MAX_COMPETITORS) return setError(`Up to ${MAX_COMPETITORS} competitors.`);
    setError(null);
    setEdited(checked ? [...selected, placeId] : selected.filter((id) => id !== placeId));
  };

  const search = async () => {
    const q = searchQuery.trim();
    if (q.length < 2 || q.length > 100) return setError("Enter 2–100 characters to search.");
    setSearching(true);
    setError(null);
    try {
      setSearchResults((await searchPlaces(q, { locationId })).results);
    } catch (err) {
      setError(isApiError(err) && err.status === 429 ? "The daily search limit is reached. Try again tomorrow." : errorText(err, "The search failed. Try again."));
    } finally {
      setSearching(false);
    }
  };

  const save = async (competitors: string[]) => {
    setSaving(true);
    setError(null);
    try {
      await updateTracking(locationId, { competitors });
      onDone();
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      setError(
        reason === "too_many_competitors"
          ? `Up to ${MAX_COMPETITORS} competitors.`
          : reason === "own_place_id"
            ? "Your own business can't be a competitor."
            : reason === "invalid_place_id"
              ? "One of the selected businesses isn't valid anymore. Search for it again."
              : errorText(err, "The competitors could not be saved. Try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (candidate: Candidate) => {
    const checked = selected.includes(candidate.place_id);
    const id = `competitor-${candidate.place_id}`;
    return (
      <li key={candidate.place_id} className="flex items-start gap-3 p-3">
        <Checkbox id={id} className="mt-0.5" checked={checked} onCheckedChange={(value) => toggle(candidate.place_id, value === true)} />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-medium text-foreground">{candidate.name}</span>
          <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            {candidate.address ? <><MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />{candidate.address}</> : null}
            {candidate.detail ? <span className="ml-auto shrink-0">{candidate.detail}</span> : null}
          </span>
        </label>
      </li>
    );
  };

  const suggestionRows = suggestions.data?.suggestions ?? [];
  // Saved competitors that are in neither list still show (by place id) so they can be removed.
  const unknownSelected = selected.filter((id) => !known.has(id));
  const attribution = suggestions.data?.attribution?.text;

  return (
    <Panel title="Competitors to compare against" description={`Pick up to ${MAX_COMPETITORS} nearby businesses. This step is optional.`}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested for your keywords</p>
          {suggestions.isPending ? (
            <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : suggestions.isError ? (
            <p className="text-sm text-muted-foreground">
              {suggestionsErrorText(suggestions.error)}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => void suggestions.refetch()}>Try again</button>
            </p>
          ) : suggestionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions found nearby. Search for a competitor below.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {suggestionRows.map((suggestion) => renderRow(known.get(suggestion.place_id)!))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search for a competitor</p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <Input aria-label="Competitor name" value={searchQuery} maxLength={100} placeholder="Competitor name" onChange={(event) => setSearchQuery(event.target.value)} />
            <Button type="submit" variant="outline" disabled={searching}>
              {searching ? <LoaderCircle aria-hidden className="animate-spin" /> : <Search aria-hidden />} Search
            </Button>
          </form>
          {searchResults ? (
            searchResults.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing found.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                {searchResults.filter((result) => !suggestionRows.some((s) => s.place_id === result.place_id)).map((result) => renderRow(known.get(result.place_id)!))}
              </ul>
            )
          ) : null}
        </div>

        {unknownSelected.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Already saved</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {unknownSelected.map((placeId) => {
                const saved = tracking.data?.competitors?.find((entry) => entry.place_id === placeId);
                return renderRow({ place_id: placeId, name: saved?.name ?? "Saved competitor", address: saved?.address ?? null });
              })}
            </ul>
          </div>
        ) : null}

        {attribution ? <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Star aria-hidden className="size-3" /> {attribution}</p> : null}
        {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={() => void save([])}>Continue without competitors</Button>
          <Button disabled={saving || selected.length === 0} onClick={() => void save(selected)}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save {selected.length} and continue
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function FinishStep({
  locationId,
  onBack,
  onCenterMissing,
  onKeywordsMissing,
  onDone,
}: {
  locationId: string;
  onBack: () => void;
  onCenterMissing: (() => void) | undefined;
  onKeywordsMissing: () => void;
  onDone: (runId: string) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ message: string; billing?: boolean; center?: boolean; keywords?: boolean } | null>(null);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await completeOnboarding(locationId);
      onDone(result.rank_run.run_id);
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      if (reason === "subscription_required") {
        setError({ message: "A subscription is needed to start tracking.", billing: true });
      } else if (reason === "center_required") {
        setError({ message: "Set the business center (city or ZIP) first.", center: true });
      } else if (reason === "keywords_required") {
        setError({ message: "Add at least one keyword first.", keywords: true });
      } else {
        setError({ message: errorText(err, "Tracking could not be started. Try again.") });
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <Panel title="Start tracking" description="The first ranking run starts now and takes a few minutes. Rankings refresh automatically every month after that.">
      <div className="space-y-3">
        {error ? (
          <div role="alert" className="space-y-2 text-sm text-critical">
            <p>{error.message}</p>
            {error.billing ? <Button asChild variant="outline" size="sm"><Link to="/settings/billing">Go to billing</Link></Button> : null}
            {error.center && onCenterMissing ? <Button variant="outline" size="sm" onClick={onCenterMissing}>Set the business center</Button> : null}
            {error.keywords ? <Button variant="outline" size="sm" onClick={onKeywordsMissing}>Add keywords</Button> : null}
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onBack} disabled={starting}>Back</Button>
          <Button onClick={() => void start()} disabled={starting}>
            {starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <CheckCircle2 aria-hidden />} Finish setup
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function DoneStep({ locationId, runId }: { locationId: string; runId: string | null }) {
  const run = useQuery({
    queryKey: [...LOCATIONS_QUERY_KEY, "rank-run", locationId, runId],
    queryFn: ({ signal }) => getRankRun(locationId, runId!, signal),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return !status || status === "queued" || status === "running" ? RUN_POLL_MS : false;
    },
  });
  const status = run.data?.status;
  const finished = status === "done" || status === "partial";

  return (
    <Panel>
      <div className="space-y-3">
        {!runId ? (
          <p className="text-sm text-muted-foreground">This location is set up. Rankings refresh automatically every month.</p>
        ) : status === "failed" ? (
          <p className="text-sm text-critical">
            The first ranking run failed{run.data?.failure_reason ? `: ${run.data.failure_reason}` : "."} It will run again with the next refresh.
          </p>
        ) : finished ? (
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 aria-hidden className="size-4 text-success" /> The first ranking run is done{status === "partial" ? " (some searches failed)" : ""}.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            The first ranking run is {status === "running" ? "running" : "queued"}. This takes a few minutes; you can leave this page.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline"><Link to="/locations">All locations</Link></Button>
          <Button asChild><Link to={`/locations/${locationId}`}>Open location</Link></Button>
        </div>
      </div>
    </Panel>
  );
}

export default LocationSetupPage;
