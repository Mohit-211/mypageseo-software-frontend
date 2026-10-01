import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, LoaderCircle, MapPin, Search } from "lucide-react";
import {
  apiErrorData,
  exchangeGbpCode,
  getGbpAccountLocations,
  getGbpPopupConfig,
  isApiError,
  saveGbpPicks,
  type GbpAccountLocation,
  type GbpAccountLocationsResponse,
} from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createGbpCodeClient, loadGoogleIdentity, type GisCodeResponse } from "@/lib/gbp/google-identity";
import { useGbpConnections } from "@/lib/gbp/use-gbp";
import {
  closeGbpConnect,
  invalidateGbpQueries,
  useGbpConnectModal,
  type GbpConnectTarget,
} from "@/lib/gbp/use-gbp-connect";

/** The popup `state` lasts 10 minutes; fetch a new one a little earlier. */
const CONFIG_MAX_AGE_MS = 9 * 60 * 1000;
/** Show a filter above the checklist once it gets long. */
const FILTER_THRESHOLD = 8;

/** Rendered once at the app root; screens open it with `useGbpConnect().connect()`. */
export function GbpConnectDialogHost() {
  const state = useGbpConnectModal();
  if (!state.open) return null;
  return <GbpConnectDialog key={state.key} initialTarget={state.target} />;
}

type Stage =
  | { name: "account" }
  | { name: "pick"; target: GbpConnectTarget }
  | { name: "saved"; target: GbpConnectTarget; pending: number };

function GbpConnectDialog({ initialTarget }: { initialTarget: GbpConnectTarget | null }) {
  const [stage, setStage] = useState<Stage>(
    initialTarget ? { name: "pick", target: initialTarget } : { name: "account" },
  );

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : closeGbpConnect())}>
      <DialogContent className="sm:max-w-xl">
        {stage.name === "account" ? (
          <AccountStep onConnected={(target) => setStage({ name: "pick", target })} />
        ) : stage.name === "pick" ? (
          <PickStep
            target={stage.target}
            onSaved={(pending) => setStage({ name: "saved", target: stage.target, pending })}
          />
        ) : (
          <SavedStep
            target={stage.target}
            pending={stage.pending}
            onConnectAnother={() => setStage({ name: "account" })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Copy for `data.reason` on the connect calls. */
function connectErrorMessage(err: unknown): string {
  if (!isApiError(err)) return err instanceof Error ? err.message : "Google could not be connected. Try again.";
  switch (err.reason) {
    case "google_account_limit": {
      const limit = Number(apiErrorData(err).limit) || 3;
      return `You can connect up to ${limit} Google accounts. Disconnect one first.`;
    }
    case "subscription_required":
      return "Your subscription isn't active, so Google can't be connected right now. Update billing to continue.";
    case "organization_suspended":
      return "This account is suspended. Contact support.";
    default:
      return err.message || "Google could not be connected. Try again.";
  }
}

function AccountStep({ onConnected }: { onConnected: (target: GbpConnectTarget) => void }) {
  const queryClient = useQueryClient();
  const { connections, limit } = useGbpConnections();
  const [error, setError] = useState<{ message: string; reason?: string } | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const gis = useQuery({
    queryKey: ["gbp", "gis"],
    queryFn: loadGoogleIdentity,
    staleTime: Infinity,
    retry: false,
  });
  // Each state works once: never share a cached config, and replace it before it expires.
  const config = useQuery({
    queryKey: ["gbp", "connect", "popup"],
    queryFn: ({ signal }) => getGbpPopupConfig(signal),
    gcTime: 0,
    staleTime: CONFIG_MAX_AGE_MS,
    refetchInterval: CONFIG_MAX_AGE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const handleCode = (response: GisCodeResponse, issuedState: string) => {
    const state = response.state ?? issuedState;
    if (response.error || !response.code || !state) {
      setError({
        message:
          response.error === "access_denied"
            ? "Google access wasn't granted, so nothing was connected."
            : "Google didn't return a sign-in code. Try again.",
      });
      void config.refetch();
      return;
    }
    setExchanging(true);
    setError(null);
    exchangeGbpCode(response.code, state)
      .then(async (result) => {
        await invalidateGbpQueries(queryClient);
        onConnected({ googleSub: result.google_sub, googleEmail: result.google_email });
      })
      .catch((err: unknown) => {
        setError({ message: connectErrorMessage(err), ...(isApiError(err) && err.reason ? { reason: err.reason } : {}) });
        void config.refetch();
      })
      .finally(() => setExchanging(false));
  };

  const requestCode = () => {
    if (!gis.data || !config.data) return;
    const popupConfig = config.data;
    setError(null);
    // Built and opened synchronously inside the click, or the browser blocks the popup.
    createGbpCodeClient(gis.data, popupConfig, {
      onCode: (response) => handleCode(response, popupConfig.state),
      onError: (gisError) => {
        setError({
          message:
            gisError.type === "popup_failed_to_open"
              ? "Your browser blocked the Google window. Allow pop-ups for this site and try again."
              : "The Google window was closed before the connection finished.",
        });
      },
    }).requestCode();
  };

  const loadError = gis.error ?? config.error;
  const ready = Boolean(gis.data && config.data);
  const preparing = !ready && !loadError;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Connect Google Business Profile</DialogTitle>
        <DialogDescription>
          Sign in with the Google account that manages your businesses. You'll choose which locations to add next.
        </DialogDescription>
      </DialogHeader>

      {connections.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Connected: {connections.map((connection) => connection.google_email).join(", ")} ({connections.length} of{" "}
          {limit}). Signing in with one of these again refreshes it.
        </p>
      ) : null}

      {loadError ? (
        <Alert className="border-critical/25 bg-critical-surface/40">
          <AlertCircle aria-hidden />
          <AlertDescription>
            <p>{connectErrorMessage(loadError)}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                if (gis.error) void gis.refetch();
                if (config.error) void config.refetch();
              }}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert className="border-critical/25 bg-critical-surface/40" role="alert">
          <AlertCircle aria-hidden />
          <AlertDescription>
            <p>{error.message}</p>
            {error.reason === "subscription_required" ? (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/settings/billing" onClick={closeGbpConnect}>
                  Go to billing
                </Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={closeGbpConnect}>
          Cancel
        </Button>
        <Button
          disabled={!ready || exchanging || config.isFetching}
          aria-busy={preparing || exchanging}
          onClick={requestCode}
        >
          {preparing || exchanging ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2 aria-hidden />}
          {exchanging ? "Connecting…" : preparing ? "Preparing…" : "Choose Google account"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Copy for `data.reason` when saving picks. */
function pickErrorMessage(err: unknown): string {
  if (!isApiError(err)) return "Your selection could not be saved. Try again.";
  switch (err.reason) {
    case "unknown_location":
      return "One of the selected locations is no longer in this Google account. The list has been refreshed.";
    case "unsupported_region":
      return "Only US and Canadian businesses can be added. The list has been refreshed.";
    case "picked_by_other":
      return "A teammate picked one of these locations first. The list has been refreshed.";
    default:
      return err.message || "Your selection could not be saved. Try again.";
  }
}

function rowLockReason(location: GbpAccountLocation): string | null {
  if (location.bound_location_id) return "Bound";
  if (location.picked_by_other) return "Picked by a teammate";
  if (!location.supported) return "US and Canada only";
  return null;
}

function PickStep({ target, onSaved }: { target: GbpConnectTarget; onSaved: (pending: number) => void }) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["gbp", "connections", target.googleSub, "locations"],
    queryFn: ({ signal }) => getGbpAccountLocations(target.googleSub, signal),
    refetchOnWindowFocus: false,
  });
  // User edits apply to the list they were made on; a reload starts again from the saved picks.
  const [edits, setEdits] = useState<{ base: GbpAccountLocationsResponse; selected: Set<string> } | null>(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected =
    edits && edits.base === list.data
      ? edits.selected
      : new Set(
          (list.data?.locations ?? [])
            .filter((location) => location.picked && !rowLockReason(location))
            .map((location) => location.gbpLocationId),
        );

  const locations = list.data?.locations ?? [];
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? locations.filter((location) =>
        `${location.title} ${location.address ?? ""} ${location.city ?? ""}`.toLowerCase().includes(needle),
      )
    : locations;

  const toggle = (id: string, checked: boolean) => {
    if (!list.data) return;
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setEdits({ base: list.data, selected: next });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveGbpPicks(target.googleSub, [...selected]);
      await invalidateGbpQueries(queryClient);
      onSaved(result.locations.filter((location) => location.picked && !location.bound_location_id).length);
    } catch (err) {
      setError(pickErrorMessage(err));
      if (isApiError(err) && err.status < 500) void list.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Choose locations</DialogTitle>
        <DialogDescription>
          Connected as <span className="font-medium text-foreground">{target.googleEmail}</span>. Tick the locations to
          add; they'll appear on the Locations page, where you bind each one.
        </DialogDescription>
      </DialogHeader>

      {list.isPending ? (
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : list.isError ? (
        <Alert className="border-critical/25 bg-critical-surface/40">
          <AlertCircle aria-hidden />
          <AlertDescription>
            <p>
              {isApiError(list.error) && list.error.reason === "google_account_not_connected"
                ? "This Google account is no longer connected. Connect it again."
                : list.error.message || "This account's locations could not be loaded."}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void list.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : locations.length === 0 ? (
        <p className="rounded-md border border-border bg-surface-strong p-4 text-sm text-muted-foreground">
          This Google account doesn't manage any Business Profile locations. Try another account.
        </p>
      ) : (
        <div className="space-y-3">
          {locations.length > FILTER_THRESHOLD ? (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Filter locations"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by name or city"
                className="h-9 pl-9"
              />
            </div>
          ) : null}
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {visible.map((location) => {
              const lock = rowLockReason(location);
              const checked = location.bound_location_id ? true : selected.has(location.gbpLocationId);
              const id = `gbp-pick-${location.gbpLocationId}`;
              return (
                <li key={location.gbpLocationId} className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={id}
                    className="mt-0.5"
                    checked={checked}
                    disabled={Boolean(lock) || saving}
                    onCheckedChange={(value) => toggle(location.gbpLocationId, value === true)}
                  />
                  <label htmlFor={id} className={lock ? "min-w-0 flex-1 opacity-70" : "min-w-0 flex-1 cursor-pointer"}>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {location.title}
                      {lock ? <StatusBadge tone={location.bound_location_id ? "success" : "neutral"}>{lock}</StatusBadge> : null}
                    </span>
                    {location.address ? (
                      <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                        {location.address}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
          {list.data && list.data.errors.length > 0 ? (
            <p className="text-xs text-warning-foreground">
              Some business accounts in this Google account couldn't be listed, so a few locations may be missing.
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={closeGbpConnect} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving || !list.data}>
          {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          {saving ? "Saving…" : `Save selection (${selected.size})`}
        </Button>
      </DialogFooter>
    </>
  );
}

function SavedStep({
  target,
  pending,
  onConnectAnother,
}: {
  target: GbpConnectTarget;
  pending: number;
  onConnectAnother: () => void;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 aria-hidden className="size-5 text-success" /> Selection saved
        </DialogTitle>
        <DialogDescription>
          {pending === 0
            ? `No locations from ${target.googleEmail} are waiting to be bound.`
            : `${pending} location${pending === 1 ? " is" : "s are"} waiting on the Locations page. Press Bind on each one to start tracking it.`}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onConnectAnother}>
          Connect another account
        </Button>
        <Button
          onClick={() => {
            closeGbpConnect();
            if (pathname !== "/locations") navigate("/locations");
          }}
        >
          {pathname === "/locations" ? "Done" : "Go to Locations"}
        </Button>
      </DialogFooter>
    </>
  );
}
