import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, LoaderCircle, Settings2 } from "lucide-react";
import { getTrackingEstimate, isApiError, updateTracking } from "@/api";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistance, formatDuration } from "@/lib/rankings/format";
import { rankingsKey, useTracking } from "@/lib/rankings/use-rankings";
import { cn } from "@/lib/utils";

const SIZES = [3, 5, 7, 9, 11, 13];
const MIN_RADIUS_KM = 0.5;
const MAX_RADIUS_KM = 15;
/** Common coverage choices (center to edge). */
const PRESETS_KM = [2, 5, 8, 15];

/** "Grid settings": how many points and how far out the rankings are measured. */
export function GridSettingsButton({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 aria-hidden /> Grid settings
      </Button>
      {open ? <GridSettingsDialog locationId={locationId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function GridSettingsDialog({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const tracking = useTracking(locationId);
  const saved = tracking.data?.tracking.grid;
  const [size, setSize] = useState<number | null>(null);
  const [radiusText, setRadiusText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from the saved settings once they load.
  const currentSize = size ?? saved?.size ?? 7;
  const currentRadiusText = radiusText ?? String(saved?.radius_km ?? 8);
  const radius = Number(currentRadiusText);
  const radiusValid = Number.isFinite(radius) && radius >= MIN_RADIUS_KM && radius <= MAX_RADIUS_KM;
  const keywordCount = tracking.data?.tracking.keywords.length ?? 0;

  const debouncedSize = useDebounced(currentSize);
  const debouncedRadius = useDebounced(radius);
  const estimate = useQuery({
    queryKey: [...rankingsKey(locationId), "estimate", debouncedSize, debouncedRadius, keywordCount],
    queryFn: ({ signal }) =>
      getTrackingEstimate(locationId, { size: debouncedSize, radius_km: debouncedRadius, keywords: Math.max(1, keywordCount) }, signal),
    enabled: radiusValid && Boolean(tracking.data),
    retry: false,
  });
  const estimateFresh = estimate.data && debouncedSize === currentSize && debouncedRadius === radius;
  const overCap = Boolean(estimate.data?.over_cap);
  const invalidGrid = isApiError(estimate.error) && estimate.error.reason === "invalid_grid";
  const unchanged = saved && saved.size === currentSize && saved.radius_km === radius;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateTracking(locationId, { grid: { size: currentSize, radius_km: radius } });
      await queryClient.invalidateQueries({ queryKey: rankingsKey(locationId) });
      toast.success("Grid saved. It's used from the next ranking run.");
      onClose();
    } catch (err) {
      setError(
        isApiError(err) && err.reason === "invalid_grid"
          ? err.message || "That combination of size and radius isn't allowed."
          : isApiError(err) && err.reason === "read_only"
            ? "Your access is read-only."
            : "The grid couldn't be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const spacing = currentSize > 1 && radiusValid ? radius / ((currentSize - 1) / 2) : null;

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grid settings</DialogTitle>
          <DialogDescription>
            The grid is the set of points around your business where rankings are measured. Changes apply from the next run.
          </DialogDescription>
        </DialogHeader>

        {tracking.isPending ? (
          <LoaderCircle aria-label="Loading settings" className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="grid-size">Grid size</Label>
                <Select value={String(currentSize)} onValueChange={(value) => setSize(Number(value))}>
                  <SelectTrigger id="grid-size" className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} × {value} ({value * value} points)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grid-radius">Distance from center to edge (km)</Label>
                <Input
                  id="grid-radius"
                  inputMode="decimal"
                  value={currentRadiusText}
                  aria-invalid={!radiusValid}
                  onChange={(event) => setRadiusText(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Common distances">
              {PRESETS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => setRadiusText(String(km))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs",
                    radius === km ? "border-primary bg-brand-tint text-primary" : "border-border text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {formatDistance(km)}
                </button>
              ))}
            </div>
            {!radiusValid ? (
              <p className="text-xs text-critical">Enter a distance from {MIN_RADIUS_KM} to {MAX_RADIUS_KM} km.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Covers {formatDistance(radius)} from the center in every direction
                {spacing ? `, with points about ${spacing < 1 ? `${Math.round(spacing * 1000)} m` : `${spacing.toFixed(1)} km`} apart` : ""}.
              </p>
            )}

            <div className="rounded-md border border-border bg-surface-strong p-3 text-sm">
              {!radiusValid ? null : estimate.isFetching && !estimateFresh ? (
                <p className="flex items-center gap-2 text-muted-foreground"><LoaderCircle aria-hidden className="size-4 animate-spin" /> Checking…</p>
              ) : invalidGrid ? (
                <p className="text-critical">{(estimate.error as Error).message || "That size and distance can't be combined."}</p>
              ) : estimate.data ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Searches per keyword</dt>
                  <dd className="text-right tabular">{estimate.data.points_per_keyword}</dd>
                  <dt className="text-muted-foreground">Keywords</dt>
                  <dd className="text-right tabular">{estimate.data.keywords}</dd>
                  <dt className="text-muted-foreground">Expected run time</dt>
                  <dd className="text-right">{formatDuration(estimate.data.expected_duration_ms)}</dd>
                  <dt className="text-muted-foreground">Manual refresh</dt>
                  <dd className="text-right">{estimate.data.token_cost.rankings} token{estimate.data.token_cost.rankings === 1 ? "" : "s"}</dd>
                </dl>
              ) : estimate.isError ? (
                <p className="text-muted-foreground">The estimate isn't available right now.</p>
              ) : null}
              {overCap ? (
                <p role="alert" className="mt-2 flex items-start gap-2 text-critical">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                  This grid needs more searches than one run may make. Choose a smaller grid or fewer keywords.
                </p>
              ) : null}
              {estimate.data?.dev_capped ? <p className="mt-2 text-xs text-muted-foreground">Development server: runs are limited to 3 × 3.</p> : null}
            </div>
            {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => void save()}
            disabled={saving || !radiusValid || !estimateFresh || overCap || invalidGrid || Boolean(unchanged)}
          >
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save grid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
