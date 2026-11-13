import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Flag,
  Grid3x3,
  ListTodo,
  LoaderCircle,
  MapPin,
  PartyPopper,
  Rocket,
  Search,
  Star,
  Swords,
  Tags,
  Users,
} from "lucide-react";
import {
  completeOnboarding,
  getCompetitorSuggestions,
  isApiError,
  isOnboardingPending,
  searchPlaces,
  setLocationCenter,
  updateTracking,
  type LocationCenterResult,
  type LocationHeader,
  type LocationOnboardingStep,
  type PlaceSearchResult,
} from "@/api";
import { PageHeader, Panel } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { KeywordChipList } from "@/components/keywords/keyword-chips";
import { KeywordComposer } from "@/components/keywords/keyword-composer";
import { PlaceAutocomplete } from "@/components/location/place-autocomplete";
import { SetupStepper } from "@/components/location/location-setup";
import { FirstRunProgress } from "@/components/ranking/first-run-progress";
import { PinsMap } from "@/components/ranking/rank-map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanEdit } from "@/hooks/use-access";
import { useRequiredParams } from "@/hooks/use-required-params";
import { plural } from "@/lib/dashboard/format";
import { MAX_KEYWORDS, withoutKeywords } from "@/lib/keywords/keywords";
import { keywordsPath } from "@/lib/keywords/paths";
import { KEYWORD_USAGE } from "@/lib/keywords/usage-rules";
import { trackingKey, useTracking } from "@/lib/keywords/use-keywords";
import { ONBOARDING_QUERY_KEY, onboardingStateQuery } from "@/lib/locations/onboarding-state";
import { LOCATIONS_QUERY_KEY, useLocation } from "@/lib/locations/use-locations";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * Setup for a new or linked location (FLOWS.md flow 1, steps 4–8): business
 * center (service-area businesses only) → keywords → competitors → finish, which
 * queues the first rank run; the run is then polled until it ends.
 */
type Stage = "center" | "keywords" | "competitors" | "finish";

const MAX_COMPETITORS = 5;

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
  const canEdit = useCanEdit();
  // The role is known once the workspace has loaded (until then everyone counts as an owner), so a
  // read-only user never sees the editable steps flash by.
  const workspace = useWorkspace();

  if (location.isPending || workspace.status === "loading") return <PageSkeleton metrics={0} rows={5} columns={2} />;
  if (location.isError) {
    const notFound = isApiError(location.error) && location.error.status === 404;
    return notFound ? (
      <EmptyState
        variant="no-results"
        icon={MapPin}
        title="Location not found"
        description="It may have been deleted. Choose one from your locations list."
        action={
          <Button asChild variant="outline">
            <Link to="/locations">
              <ArrowLeft aria-hidden /> Back to locations
            </Link>
          </Button>
        }
      />
    ) : (
      <ErrorState description="We couldn't load this location." onRetry={() => void location.refetch()} />
    );
  }

  // Read-only users (a client's login) can't save any of this: say who does it, and lead back.
  if (!canEdit) return <ReadOnlySetup location={location.data} />;
  return <SetupFlow key={location.data.location_id} location={location.data} />;
}

function ReadOnlySetup({ location }: { location: LocationHeader }) {
  const pending = location.status === "setup_required";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        icon={Rocket}
        tone="locations"
        showLocation={false}
        title={location.name}
        description={[location.address ?? location.city, location.country].filter(Boolean).join(" · ")}
      />
      <EmptyState
        icon={pending ? ListTodo : Users}
        tone="locations"
        title={pending ? "Your agency sets up this location" : "Your agency manages what's tracked"}
        description={
          pending
            ? "Rankings show after its first ranking run."
            : "They choose the keywords and competitors. You can see them on the location's pages."
        }
        action={
          <Button asChild>
            <Link to={locationPath(location.location_id)}>
              Open location <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
    </div>
  );
}

/** Where an edit of a live location goes back to: `?from=` when it's a location page, else the page that manages it. */
function returnTarget(from: string | null, locationId: string, step: EditStep): string {
  if (from && from.startsWith("/locations/") && !from.includes("/setup")) return from;
  return step === "competitors" ? locationPath(locationId, "competitors") : keywordsPath(locationId);
}

type EditStep = "keywords" | "competitors";

function SetupFlow({ location }: { location: LocationHeader }) {
  const queryClient = useQueryClient();
  const step = location.onboarding?.step;
  const serviceArea = step === "center_needed" || step === "center_set";
  const [params] = useSearchParams();
  // `?step=keywords|competitors` opens that step directly (e.g. "Manage competitors").
  const requested = params.get("step");
  const [stage, setStage] = useState<Stage | "done">(() =>
    requested === "keywords" || requested === "competitors"
      ? requested
      : location.onboarding
        ? stageFor(step)
        : location.status === "setup_required"
          ? "keywords"
          : "done",
  );
  const [runId, setRunId] = useState<string | null>(null);
  // A live location sent here to change its keywords or competitors, not a new one being set up: it
  // gets that one step with Save and Cancel, never the setup steps or "Finish setup". Decided once,
  // when the page opens, because finishing a new location's setup makes it "set up" while its Done
  // step is still on screen.
  const [editing] = useState<EditStep | null>(() => {
    const alreadySetUp = location.status !== "setup_required" && (!location.onboarding || step === "completed");
    return alreadySetUp && (requested === "keywords" || requested === "competitors") ? requested : null;
  });

  if (editing) return <EditTracking location={location} step={editing} returnTo={returnTarget(params.get("from"), location.location_id, editing)} />;

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
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link to={locationPath(location.location_id)}>
          <ArrowLeft aria-hidden /> {location.name}
        </Link>
      </Button>
      <PageHeader
        icon={stage === "done" ? PartyPopper : Rocket}
        tone="locations"
        showLocation={false}
        title={stage === "done" ? "Setup complete" : `Set up ${location.name}`}
        description={[location.address ?? location.city, location.country].filter(Boolean).join(" · ")}
      />

      <SetupStepper
        steps={stages}
        current={currentIndex}
        complete={stage === "done"}
        onSelect={(index) => {
          const target = stages[index];
          if (target) setStage(target.id);
        }}
      />

      {stage === "center" ? (
        <CenterStep location={location} onDone={() => advance("keywords")} />
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
            // The organization's checklist and the dashboard both count set-up locations.
            void queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            advance("done");
          }}
        />
      ) : (
        <DoneStep locationId={location.location_id} runId={runId} />
      )}
    </div>
  );
}

function CenterStep({ location, onDone }: { location: LocationHeader; onDone: () => void }) {
  const locationId = location.location_id;
  const [query, setQuery] = useState("");
  // Hidden after 400 `no_place_id`; after 404 `no_business_location` the city / ZIP field is the way.
  const [businessOption, setBusinessOption] = useState(Boolean(location.place_id && location.address));
  const [noMapPosition, setNoMapPosition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the city / ZIP resolved to, shown for confirmation before continuing. */
  const [resolved, setResolved] = useState<LocationCenterResult | null>(null);

  const saveCenter = async (input: { query: string } | { place_id: string; session: string } | { use_business_location: true }) => {
    setSaving(true);
    setError(null);
    try {
      const result = await setLocationCenter(locationId, input);
      // The business's own position needs no confirmation: it's where the business is.
      if ("use_business_location" in input) onDone();
      else setResolved(result);
    } catch (err) {
      const status = isApiError(err) ? err.status : 0;
      const reason = isApiError(err) ? err.reason : undefined;
      if (reason === "no_place_id") {
        setBusinessOption(false);
        setError(null);
      } else if (reason === "no_business_location") {
        setBusinessOption(false);
        setNoMapPosition(true);
        setError("Google Maps has no position for this business; pick a city or ZIP.");
      } else {
        setError(
          status === 404
            ? "Nothing was found for that city or ZIP. Pick one from the list, or try another."
            : status === 429
              ? "The daily search limit is reached. Try again tomorrow."
              : // A 502 can reach the browser as a network error (no CORS headers through Cloudflare).
                status === 0 || status >= 500
                ? "Search is unavailable right now. Try again in a moment, or use what you typed."
                : errorText(err, "The center could not be saved. Try again."),
        );
      }
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
      <Panel icon={Crosshair} tone="rankings" title="Is this the right place?" description="Rankings will be measured from points around this center.">
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Centered on <span className="font-semibold">{resolved.center_label}</span>
          </p>
          <PinsMap
            className="h-64 w-full"
            pins={[{ key: "center", lat: resolved.lat, lng: resolved.lng, rank: null, name: resolved.center_label ?? "Center", kind: "self" }]}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setResolved(null)}>
              Use a different place
            </Button>
            <Button onClick={onDone}>Looks right, continue</Button>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      icon={Crosshair}
      tone="rankings"
      title="Where does this business serve customers?"
      description={
        location.address || noMapPosition
          ? "We couldn't find this business's position on Google Maps, so rankings are measured around the place you choose."
          : "It's a service-area business without a public address, so rankings are measured around the city or ZIP you choose."
      }
    >
      {businessOption ? (
        <div className="mb-4 space-y-2 border-b border-border pb-4">
          <Button
            variant="outline"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left sm:w-auto"
            disabled={saving}
            onClick={() => void saveCenter({ use_business_location: true })}
          >
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <MapPin aria-hidden />}
            <span>Use the business address ({location.address})</span>
          </Button>
          <p className="text-xs text-muted-foreground">Or measure around a city or ZIP instead:</p>
        </div>
      ) : null}
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
        {error ? (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Use what I typed
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Whether the entry before this one belongs to the app: this page was reached by an in-app link
 * (React Router numbers its entries from 0 in each tab), not a bookmark, a typed address or a new tab.
 * Read on click only, never while rendering.
 */
function canStepBack(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && "idx" in state && typeof state.idx === "number" && state.idx > 0;
}

/**
 * A live location's keywords or competitors, opened from its own pages ("Manage competitors", "Add
 * competitors"): the same picker as setup without the setup steps. Saving or cancelling goes back
 * where the user came from; the next ranking run measures the change.
 */
function EditTracking({ location, step, returnTo }: { location: LocationHeader; step: EditStep; returnTo: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Opened from a page of the app (its "Manage competitors" link, which names itself in `?from=`):
  // step back to it, so it isn't in the history twice and the next Back leaves it. Opened directly
  // (a bookmark, a typed address, a new tab): replace the form with that page, so it doesn't wait
  // one Back away.
  const leave = () => {
    if (canStepBack()) navigate(-1);
    else navigate(returnTo, { replace: true });
  };
  const saved = () => {
    toast.success(step === "competitors" ? "Competitors saved" : "Keywords saved", { description: "They're measured in the next ranking run." });
    // Rankings, the overview and the dashboard count them.
    void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, location.location_id] });
    void queryClient.invalidateQueries({ queryKey: [...LOCATIONS_QUERY_KEY, "overview", location.location_id] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    leave();
  };
  const competitors = step === "competitors";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
        <Link
          to={returnTo}
          replace
          onClick={(event) => {
            // A plain click leaves like Cancel; Ctrl/⌘-click still opens the page in a new tab.
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !canStepBack()) return;
            event.preventDefault();
            navigate(-1);
          }}
        >
          <ArrowLeft aria-hidden /> Back
        </Link>
      </Button>
      <PageHeader
        icon={competitors ? Swords : Tags}
        tone={competitors ? "competitors" : "keywords"}
        showLocation={false}
        title={competitors ? "Manage competitors" : "Manage keywords"}
        description={[location.name, location.address ?? location.city].filter(Boolean).join(" · ")}
      />
      {competitors ? (
        <CompetitorsStep locationId={location.location_id} editing onCancel={leave} onDone={saved} />
      ) : (
        <KeywordsStep locationId={location.location_id} editing onCancel={leave} onDone={saved} />
      )}
    </div>
  );
}

/** Same entries in the same order. Keyword order matters (AI uses the first ones); competitors are compared sorted. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

/** Keywords: the same composer as the Keywords page, adding to a draft that "Save and continue" saves. */
function KeywordsStep({
  locationId,
  onDone,
  editing = false,
  onCancel,
}: {
  locationId: string;
  onDone: () => void;
  /** A live location's keywords: "Save N keywords" and "Cancel" instead of "Save and continue". */
  editing?: boolean;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  // The same tracking query as the Keywords page and the ranking pages (one cache, no second fetch).
  const tracking = useTracking(locationId);
  const [edited, setEdited] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savedKeywords = tracking.data?.tracking.keywords.map((keyword) => keyword.text) ?? [];
  const keywords = edited ?? savedKeywords;
  const changed = edited !== null && !sameList(edited, savedKeywords);

  const save = async () => {
    if (keywords.length === 0) return setError("Add at least one keyword.");
    setSaving(true);
    setError(null);
    try {
      const result = await updateTracking(locationId, { keywords });
      queryClient.setQueryData(trackingKey(locationId), result);
      onDone();
    } catch (err) {
      setError(errorText(err, "The keywords could not be saved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      icon={Tags}
      tone="keywords"
      title="Choose your keywords"
      description={`The local searches customers use to find this business, for example “emergency plumber”. Rank tracking measures them, and AI uses them in your posts and review replies. Up to ${MAX_KEYWORDS}.`}
    >
      {tracking.isPending ? (
        <div className="space-y-3" role="status" aria-label="Loading keywords">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-48" />
        </div>
      ) : (
        <div className="space-y-5">
          <KeywordComposer
            locationId={locationId}
            keywords={keywords}
            // Runs on its own the first time, when there are no keywords yet.
            autoSuggest={tracking.isSuccess && keywords.length === 0}
            hint="Add several at once by separating them with “;”. More keywords take a little longer to measure the first time."
            onAdd={(next) => {
              setEdited(next);
              setError(null);
            }}
          />

          <div className="space-y-2.5 rounded-xl border border-border bg-surface-strong p-3 sm:p-4">
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-foreground">Your keywords</span>
              <span className={keywords.length >= MAX_KEYWORDS ? "text-xs font-medium text-warning-foreground" : "text-xs text-muted-foreground"}>
                {keywords.length} of {MAX_KEYWORDS}
              </span>
            </p>
            {keywords.length > 0 ? (
              <>
                <KeywordChipList keywords={keywords} disabled={saving} onRemove={(keyword) => setEdited(withoutKeywords(keywords, [keyword]))} />
                <p className="text-xs text-muted-foreground">
                  Order matters: AI posts use your first {KEYWORD_USAGE.postDefaultCount} keywords by default and AI replies draw on your first{" "}
                  {KEYWORD_USAGE.replyContextCount}. You can reorder them later on the Keywords page.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No keywords yet. Type one above or pick from the ideas.</p>
            )}
          </div>

          {tracking.isError ? <p className="text-xs text-muted-foreground">Saved keywords couldn't be loaded; anything you save here replaces them.</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
          {editing ? (
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
              <Button disabled={saving || !changed} aria-busy={saving || undefined} onClick={() => void save()}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save {plural(keywords.length, "keyword")}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end border-t border-border pt-4">
              <Button disabled={saving} aria-busy={saving || undefined} onClick={() => void save()}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save and continue
              </Button>
            </div>
          )}
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

function CompetitorsStep({
  locationId,
  onDone,
  editing = false,
  onCancel,
}: {
  locationId: string;
  onDone: () => void;
  /** A live location's competitors: "Save N competitors" and "Cancel" instead of the setup buttons. */
  editing?: boolean;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const tracking = useTracking(locationId);
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

  const savedCompetitors = tracking.data?.tracking.competitors ?? [];
  const selected = edited ?? savedCompetitors;
  const changed = edited !== null && !sameList([...edited].sort(), [...savedCompetitors].sort());
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
      const result = await updateTracking(locationId, { competitors });
      // The ranking pages read the same tracking query: fresh at once.
      queryClient.setQueryData(trackingKey(locationId), result);
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
      <li key={candidate.place_id} className={checked ? "flex items-start gap-3 bg-brand-tint/60 p-3" : "flex items-start gap-3 p-3 hover:bg-accent/60"}>
        <Checkbox id={id} className="mt-0.5" checked={checked} onCheckedChange={(value) => toggle(candidate.place_id, value === true)} />
        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
          <span className="block text-sm font-medium text-foreground">{candidate.name}</span>
          <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            {candidate.address ? (
              <>
                <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                {candidate.address}
              </>
            ) : null}
            {candidate.detail ? <span className="ml-auto shrink-0 font-medium text-foreground">{candidate.detail}</span> : null}
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
    <Panel
      icon={Swords}
      tone="competitors"
      title="Competitors to compare against"
      description={`Pick up to ${MAX_COMPETITORS} nearby businesses to see who ranks above you.${editing ? "" : " This step is optional."}`}
      actions={
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {selected.length} of {MAX_COMPETITORS} selected
        </span>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested for your keywords</p>
          {suggestions.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : suggestions.isError ? (
            <p className="text-sm text-muted-foreground">
              {suggestionsErrorText(suggestions.error)}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => void suggestions.refetch()}>
                Try again
              </button>
            </p>
          ) : suggestionRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suggestions found nearby. Search for a competitor below.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
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
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
                {searchResults.filter((result) => !suggestionRows.some((s) => s.place_id === result.place_id)).map((result) => renderRow(known.get(result.place_id)!))}
              </ul>
            )
          ) : null}
        </div>

        {unknownSelected.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Already saved</p>
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {unknownSelected.map((placeId) => {
                const saved = tracking.data?.competitors?.find((entry) => entry.place_id === placeId);
                return renderRow({ place_id: placeId, name: saved?.name ?? "Saved competitor", address: saved?.address ?? null });
              })}
            </ul>
          </div>
        ) : null}

        {attribution ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star aria-hidden className="size-3" /> {attribution}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        ) : null}

        {editing ? (
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={saving} onClick={onCancel}>
              Cancel
            </Button>
            <Button disabled={saving || !changed} aria-busy={saving || undefined} onClick={() => void save(selected)}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
              {selected.length === 0 ? "Remove all competitors" : `Save ${plural(selected.length, "competitor")}`}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={saving} onClick={() => void save([])}>
              Continue without competitors
            </Button>
            <Button disabled={saving || selected.length === 0} aria-busy={saving || undefined} onClick={() => void save(selected)}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save {selected.length} and continue
            </Button>
          </div>
        )}
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
  /** With the first run's id, or null when there is no run to follow (the Done step says so). */
  onDone: (runId: string | null) => void;
}) {
  const tracking = useTracking(locationId);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ message: string; billing?: boolean; center?: boolean; keywords?: boolean } | null>(null);
  const settings = tracking.data?.tracking;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await completeOnboarding(locationId);
      // A location set up before answers with its last run, or none (`rank_run: null`).
      onDone(result.rank_run?.run_id ?? null);
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
    <Panel
      icon={Flag}
      tone="rankings"
      title="Start tracking"
      description="The first ranking run starts now, and you'll see how long it should take. Rankings refresh automatically every month after that, for free."
    >
      <div className="space-y-4">
        {settings ? (
          <ul className="grid gap-3 sm:grid-cols-3" aria-label="What will be tracked">
            <SummaryItem icon={Tags} label="Keywords" value={`${settings.keywords.length}`} />
            <SummaryItem icon={Swords} label="Competitors" value={`${settings.competitors.length}`} />
            <SummaryItem icon={Grid3x3} label="Grid" value={`${settings.grid.size}×${settings.grid.size}`} />
          </ul>
        ) : null}
        {error ? (
          <div role="alert" className="space-y-2 rounded-lg border border-critical/25 bg-critical-surface p-3 text-sm text-critical">
            <p>{error.message}</p>
            <div className="flex flex-wrap gap-2">
              {error.billing ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings/billing">Go to billing</Link>
                </Button>
              ) : null}
              {error.center && onCenterMissing ? (
                <Button variant="outline" size="sm" onClick={onCenterMissing}>
                  Set the business center
                </Button>
              ) : null}
              {error.keywords ? (
                <Button variant="outline" size="sm" onClick={onKeywordsMissing}>
                  Add keywords
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onBack} disabled={starting}>
            Back
          </Button>
          <Button onClick={() => void start()} disabled={starting} aria-busy={starting || undefined}>
            {starting ? <LoaderCircle aria-hidden className="animate-spin" /> : <CheckCircle2 aria-hidden />} Finish setup
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof Tags; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface-strong px-3 py-2.5">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-base font-semibold tabular-nums text-foreground">{value}</span>
    </li>
  );
}

/**
 * After `POST onboarding/complete`: the first run's wait, shown right away from its run id. While
 * the organization's own setup checklist still has steps (an agency's brand, for one), the main
 * button leads back to it.
 */
function DoneStep({ locationId, runId }: { locationId: string; runId: string | null }) {
  const [setupPending] = useState(isOnboardingPending);
  const onboarding = useQuery({ ...onboardingStateQuery(), enabled: setupPending });
  const backToSetup = setupPending && onboarding.data ? !onboarding.data.organization.completed : false;
  return (
    <Panel icon={PartyPopper} tone="locations" title="You're all set">
      <div className="space-y-4">
        {!runId ? (
          <p className="text-sm text-muted-foreground">This location is set up. Rankings refresh automatically every month.</p>
        ) : (
          <FirstRunProgress
            locationId={locationId}
            runId={runId}
            className="border-0 p-0 shadow-none"
            fallback={
              <p className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 aria-hidden className="size-4 text-success" /> The first ranking run is done. Your GBP report follows within a couple of minutes.
              </p>
            }
          />
        )}
        <p className="text-sm text-muted-foreground">
          You can change your keywords and their order any time on the{" "}
          <Link to={keywordsPath(locationId)} className="font-medium text-primary underline-offset-2 hover:underline">
            Keywords page
          </Link>
          .
        </p>
        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link to="/locations">All locations</Link>
          </Button>
          <Button asChild variant={backToSetup ? "outline" : "default"}>
            <Link to={locationPath(locationId)}>Open location</Link>
          </Button>
          {backToSetup ? (
            <Button asChild>
              <Link to="/onboarding">
                Back to setup <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export default LocationSetupPage;
