import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, MapPin } from "lucide-react";
import { apiErrorData, isApiError, setLocationCenter, type LocationHeader } from "@/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlaceAutocomplete } from "@/components/location/place-autocomplete";
import { useCanEdit } from "@/hooks/use-access";
import { LOCATIONS_QUERY_KEY, useLocation } from "@/lib/locations/use-locations";
import { centerDescription } from "@/lib/rankings/format";
import { rankingsKey, useRefreshState } from "@/lib/rankings/use-rankings";

/** The new center, chosen but not saved yet (saving re-runs the rankings, so it's confirmed first). */
type Choice =
  | { kind: "place"; place_id: string; session: string; label: string }
  | { kind: "query"; query: string; label: string }
  | { kind: "business"; label: string };

type SaveError = { message: string; tokens?: boolean };

function inputOf(choice: Choice) {
  if (choice.kind === "place") return { place_id: choice.place_id, session: choice.session };
  if (choice.kind === "query") return { query: choice.query };
  return { use_business_location: true as const };
}

function errorOf(err: unknown, choice: Choice): SaveError {
  const status = isApiError(err) ? err.status : 0;
  const reason = isApiError(err) ? err.reason : undefined;
  if (reason === "insufficient_tokens") {
    const data = apiErrorData(err);
    return {
      message: `Not enough tokens to re-run the rankings: it costs ${String(data.cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`,
      tokens: true,
    };
  }
  if (reason === "read_only") return { message: "Your access is read-only." };
  if (reason === "no_place_id" || reason === "no_business_location")
    return { message: "Google Maps has no position for this business; pick a city or ZIP instead." };
  if (status === 404 && choice.kind !== "business") return { message: "Nothing was found for that city or ZIP. Pick one from the list, or try another." };
  if (status === 429) return { message: "The daily search limit is reached. Try again tomorrow." };
  // A 502 can reach the browser as a network error (no CORS headers through Cloudflare).
  if (status === 0 || status >= 500) return { message: "Search is unavailable right now. Try again in a moment." };
  return { message: isApiError(err) && err.message ? err.message : "The center couldn't be changed. Try again." };
}

/** "Change": moves the business center chosen at setup and re-runs the rankings around it at once. */
function ChangeCenterButtonEditor({ locationId, className }: { locationId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" className={className ?? "h-auto p-0 text-xs"} onClick={() => setOpen(true)}>
        Change
      </Button>
      {open ? <ChangeCenterDialog locationId={locationId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChangeCenterDialog({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const location = useLocation(locationId);
  const refresh = useRefreshState(locationId);
  const [query, setQuery] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<SaveError | null>(null);

  const header: LocationHeader | undefined = location.data;
  const current = centerDescription(header?.center);
  const businessOption = Boolean(header?.place_id && header.address && header.center?.source !== "place");
  // During setup the first run starts at Finish, so nothing is re-run (or charged) here.
  const setUp = header ? !header.onboarding || header.onboarding.step === "completed" : false;
  const cost = refresh.data?.tokens.cost.rankings ?? null;
  const balance = refresh.data?.tokens.balance ?? null;
  const activeRun = refresh.data?.rankings.active_run ?? null;

  const save = async (rerun: boolean) => {
    if (!choice) return;
    setSaving(true);
    setError(null);
    try {
      const result = await setLocationCenter(locationId, { ...inputOf(choice), rerun });
      const label = result.center_label ?? (choice.kind === "business" ? "the business address" : choice.label);
      if (result.rank_run) {
        toast.success(`Rankings are running again around ${label}.`, { description: "The new run takes a few minutes; reports made after it use the new center." });
      } else if (result.rank_run_error) {
        toast.warning(`Center changed to ${label}, but the rankings couldn't be re-run.`, { description: result.rank_run_error.message });
      } else {
        toast.success(`Center changed to ${label}.`, { description: setUp ? "The next ranking run uses it." : undefined });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LOCATIONS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) }),
        queryClient.invalidateQueries({ queryKey: ["billing", "tokens"] }),
      ]);
      onClose();
    } catch (err) {
      setError(errorOf(err, choice));
    } finally {
      setSaving(false);
    }
  };

  const chooseTyped = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      setError({ message: "Pick a city or ZIP from the list, or type it in full (2–100 characters)." });
      return;
    }
    setError(null);
    setChoice({ kind: "query", query: trimmed, label: trimmed });
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change business center</DialogTitle>
          <DialogDescription>
            Rankings are measured from the grid of points around this center.
            {setUp ? " Changing it re-runs the rankings now, and every report from that run on uses the new center." : ""}
          </DialogDescription>
        </DialogHeader>

        {location.isPending ? (
          <LoaderCircle aria-label="Loading" className="size-5 animate-spin text-muted-foreground" />
        ) : choice ? (
          <div className="space-y-3 text-sm">
            <p className="text-foreground">
              Measure rankings around <span className="font-semibold">{choice.kind === "business" ? `the business address (${choice.label})` : choice.label}</span>?
            </p>
            {setUp ? (
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  A new ranking run starts right away
                  {cost != null ? `, using ${cost} token${cost === 1 ? "" : "s"}${balance != null ? ` (balance ${balance})` : ""}` : ""}. It isn't held back by the 24-hour wait between refreshes.
                </li>
                {activeRun ? <li>The run in progress measures around the old center, so it's stopped and its tokens are refunded.</li> : null}
                <li>Earlier runs keep the center they were measured from.</li>
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            {current ? <p className="text-sm text-foreground">Now: {current.replace(/^Measured around: /, "")}</p> : null}
            {businessOption && header ? (
              <div className="space-y-2 border-b border-border pb-4">
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left sm:w-auto"
                  onClick={() => setChoice({ kind: "business", label: header.address ?? "" })}
                >
                  <MapPin aria-hidden />
                  <span>Use the business address ({header.address})</span>
                </Button>
                <p className="text-xs text-muted-foreground">Or measure around a city or ZIP instead:</p>
              </div>
            ) : null}
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                chooseTyped();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="change-center">City or ZIP / postal code</Label>
                <PlaceAutocomplete
                  id="change-center"
                  locationId={locationId}
                  value={query}
                  invalid={Boolean(error)}
                  onChange={(value) => {
                    setQuery(value);
                    setError(null);
                  }}
                  onPick={(suggestion, session) => setChoice({ kind: "place", place_id: suggestion.place_id, session, label: suggestion.description })}
                />
                <p className="text-xs text-muted-foreground">Pick from the list so we know exactly which place you mean.</p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm">Use what I typed</Button>
              </div>
            </form>
          </div>
        )}

        {error ? (
          <div role="alert" className="space-y-2 text-sm text-critical">
            <p>{error.message}</p>
            {error.tokens ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/settings/billing">Buy tokens</Link></Button>
                <Button variant="outline" size="sm" disabled={saving} onClick={() => void save(false)}>
                  Change the center only (the next run uses it)
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {choice ? (
            <>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setChoice(null);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button onClick={() => void save(setUp)} disabled={saving || Boolean(error?.tokens)}>
                {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                {setUp ? `Change and re-run rankings${cost ? ` (${cost} token${cost === 1 ? "" : "s"})` : ""}` : "Change center"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hidden for a read-only client_user. */
export function ChangeCenterButton(props: { locationId: string; className?: string }) {
  return useCanEdit() ? <ChangeCenterButtonEditor {...props} /> : null;
}
