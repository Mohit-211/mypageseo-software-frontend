import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, LoaderCircle, MapPin, Plus, Trash2 } from "lucide-react";
import { isApiError, removeGbpPick, type ClientRecord, type PendingGbpPick } from "@/api";
import { ClientSelect } from "@/components/location/client-select";
import { LocationSlotDialog } from "@/components/location/location-billing";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNow } from "@/hooks/use-now";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { clientErrorText, useClientRequired } from "@/lib/clients/clients";
import { formatRelative } from "@/lib/datetime";
import { invalidateGbpQueries } from "@/lib/gbp/use-gbp-connect";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { useLocationBillingGate } from "@/lib/locations/use-location-billing-gate";
import { byText, byTime, sortRows } from "@/lib/sort";
import { addOrBindLocation, bindSyncText } from "./bind-result";

/**
 * Business Profiles picked from Google that aren't locations yet (`GET locations` →
 * `pending_gbp`), newest pick first. "Add" creates the location (or links an existing one;
 * billing applies), then it continues on its setup screen.
 *
 * `primary`: adding a pick is the page's main action (the add page, or a Locations page with no
 * location yet), so the Add buttons are filled.
 */
export function PendingGbpSection({ picks, clients, primary = false }: { picks: PendingGbpPick[]; clients: ClientRecord[]; primary?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [choosingClient, setChoosingClient] = useState<PendingGbpPick | null>(null);
  const gate = useLocationBillingGate();
  const clientRequired = useClientRequired();

  const add = async (action: PendingLocationAction) => {
    setBusy(action.kind === "bind" ? action.pickId : null);
    try {
      const { locationId, gbpSync } = await addOrBindLocation(action);
      await invalidateGbpQueries(queryClient);
      // A location that was already set up: its first Google sync runs in the background (2026-11-17).
      const synced = bindSyncText(action.title, gbpSync);
      if (synced) toast.success(synced.title, { description: synced.description });
      navigate(locationSetupPath(locationId));
    } catch (err) {
      if (gate.handle(err, action)) return;
      if (isApiError(err) && err.reason === "already_bound") {
        toast.error(`${action.title} is already one of your locations.`);
        void invalidateGbpQueries(queryClient);
      } else if (isApiError(err) && err.reason === "place_id_mismatch") {
        toast.error(`${action.title} doesn't match the Google place of the existing location, so it can't be linked.`);
      } else if (isApiError(err) && ["client_required", "client_not_assigned"].includes(err.reason ?? "")) {
        toast.error(clientErrorText(err, `${action.title} could not be added.`));
      } else {
        toast.error(isApiError(err) && err.message ? err.message : `${action.title} could not be added. Try again.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const startAdd = (pick: PendingGbpPick) => {
    // Linking an existing location keeps its client; otherwise offer one when the agency has clients
    // (always for a member limited to its clients, who must pick one).
    if ((clients.length > 0 || clientRequired) && !pick.existing_location_id) setChoosingClient(pick);
    else void add({ kind: "bind", pickId: pick.pick_id, title: pick.title });
  };

  const remove = async (pick: PendingGbpPick) => {
    setBusy(pick.pick_id);
    try {
      await removeGbpPick(pick.pick_id);
      await invalidateGbpQueries(queryClient);
      toast.success(`${pick.title} removed from the list`);
    } catch (err) {
      const bound = isApiError(err) && err.reason === "already_bound";
      toast.error(bound ? `${pick.title} is already a location. Disconnect it from the locations table instead.` : `${pick.title} could not be removed. Try again.`);
      if (bound) void invalidateGbpQueries(queryClient);
    } finally {
      setBusy(null);
    }
  };

  if (picks.length === 0) return null;
  // Newest pick first, then A–Z.
  const ordered = sortRows(
    picks,
    byTime((pick) => pick.picked_at),
    byText((pick) => pick.title),
  );

  return (
    <>
      <section aria-labelledby="ready-to-add-title" className="min-w-0 overflow-hidden rounded-xl border border-primary/25 bg-card shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-linear-to-r from-brand-tint via-card to-card px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <IconChip icon={Building2} tone="gbp" size="md" className="-mt-0.5" />
            <div className="min-w-0">
              <h2 id="ready-to-add-title" className="text-[15px] font-semibold leading-6 text-foreground">
                Ready to add
              </h2>
              <p className="text-[13px] text-muted-foreground">Google Business Profiles you picked. Add one to start tracking it.</p>
            </div>
          </div>
          <StatusBadge tone="brand" dot>
            {picks.length} waiting
          </StatusBadge>
        </header>
        <ul className="divide-y divide-border">
          {ordered.map((pick) => (
            <li key={pick.pick_id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  {pick.title}
                  {pick.existing_location_id ? (
                    <StatusBadge tone="info" size="sm">
                      Links to an existing location
                    </StatusBadge>
                  ) : null}
                </p>
                {(pick.address ?? pick.city) ? (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {pick.address ?? pick.city}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  From {pick.google_email} · picked {formatRelative(pick.picked_at, now)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void remove(pick)}>
                  <Trash2 aria-hidden /> Remove
                </Button>
                <Button size="sm" variant={primary ? "default" : "secondary"} disabled={busy !== null} aria-busy={busy === pick.pick_id} onClick={() => startAdd(pick)}>
                  {busy === pick.pick_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
                  {busy === pick.pick_id ? "Adding…" : "Add"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {choosingClient ? (
        <AddClientDialog
          pick={choosingClient}
          clients={clients}
          onClose={() => setChoosingClient(null)}
          onAdd={(clientId) => {
            const pick = choosingClient;
            setChoosingClient(null);
            void add({ kind: "bind", pickId: pick.pick_id, title: pick.title, ...(clientId ? { clientId } : {}) });
          }}
        />
      ) : null}

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
    </>
  );
}

function AddClientDialog({
  pick,
  clients,
  onClose,
  onAdd,
}: {
  pick: PendingGbpPick;
  clients: ClientRecord[];
  onClose: () => void;
  onAdd: (clientId: string | null) => void;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  const required = useClientRequired();
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {pick.title}</DialogTitle>
          <DialogDescription>
            {required ? "Choose which of your clients this location belongs to." : "Optionally group this location under a client. You can change it later."}
          </DialogDescription>
        </DialogHeader>
        <ClientSelect id="add-pick-client" clients={clients} value={clientId} onChange={setClientId} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={required && !clientId} onClick={() => onAdd(clientId)}>
            <Plus aria-hidden /> Add location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
