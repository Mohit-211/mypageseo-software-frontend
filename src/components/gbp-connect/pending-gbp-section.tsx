import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import { isApiError, removeGbpPick, type ClientRecord, type PendingGbpPick } from "@/api";
import { ClientSelect } from "@/components/location/client-select";
import { LocationSlotDialog } from "@/components/location/location-billing";
import { locationSetupPath, runLocationAction } from "@/lib/locations/location-actions";
import { useLocationBillingGate } from "@/lib/locations/use-location-billing-gate";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { invalidateGbpQueries } from "@/lib/gbp/use-gbp-connect";

/**
 * Picked Business Profile locations that aren't locations yet (`GET locations` →
 * `pending_gbp`). Bind creates or links the location (billing applies), then the
 * location continues on its setup screen.
 */
export function PendingGbpSection({ picks, clients }: { picks: PendingGbpPick[]; clients: ClientRecord[] }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [choosingClient, setChoosingClient] = useState<PendingGbpPick | null>(null);
  const gate = useLocationBillingGate();

  const bind = async (action: PendingLocationAction) => {
    setBusy(action.kind === "bind" ? action.pickId : null);
    try {
      const locationId = await runLocationAction(action);
      await invalidateGbpQueries(queryClient);
      navigate(locationSetupPath(locationId));
    } catch (err) {
      if (gate.handle(err, action)) return;
      if (isApiError(err) && err.reason === "already_bound") {
        toast.error(`${action.title} is already bound to a location.`);
        void invalidateGbpQueries(queryClient);
      } else if (isApiError(err) && err.reason === "place_id_mismatch") {
        toast.error(`${action.title} doesn't match the Google place of the existing location, so it can't be linked.`);
      } else {
        toast.error(isApiError(err) && err.message ? err.message : `${action.title} could not be bound. Try again.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const startBind = (pick: PendingGbpPick) => {
    // Linking an existing location keeps its client; otherwise offer one when the agency has clients.
    if (clients.length > 0 && !pick.existing_location_id) setChoosingClient(pick);
    else void bind({ kind: "bind", pickId: pick.pick_id, title: pick.title });
  };

  const remove = async (pick: PendingGbpPick) => {
    setBusy(pick.pick_id);
    try {
      await removeGbpPick(pick.pick_id);
      await invalidateGbpQueries(queryClient);
    } catch (err) {
      const bound = isApiError(err) && err.reason === "already_bound";
      toast.error(bound ? `${pick.title} is already bound. Unbind the location instead.` : `${pick.title} could not be removed. Try again.`);
      if (bound) void invalidateGbpQueries(queryClient);
    } finally {
      setBusy(null);
    }
  };

  if (picks.length === 0) return null;

  return (
    <>
      <Panel
        title="Not bound yet"
        description="Business Profiles you picked from Google. Bind one to start tracking it as a location."
        className="mb-4"
      >
        <ul className="-m-4 divide-y divide-border">
          {picks.map((pick) => (
            <li key={pick.pick_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {pick.title}
                  <StatusBadge tone="warning">Not bound</StatusBadge>
                  {pick.existing_location_id ? <StatusBadge tone="info">Links to an existing location</StatusBadge> : null}
                </p>
                {pick.address ?? pick.city ? (
                  <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {pick.address ?? pick.city}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">Google: {pick.google_email}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => void remove(pick)}>
                  <Trash2 aria-hidden /> Remove
                </Button>
                <Button size="sm" disabled={busy !== null} aria-busy={busy === pick.pick_id} onClick={() => startBind(pick)}>
                  {busy === pick.pick_id ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2 aria-hidden />}
                  Bind
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {choosingClient ? (
        <BindClientDialog
          pick={choosingClient}
          clients={clients}
          onClose={() => setChoosingClient(null)}
          onBind={(clientId) => {
            const pick = choosingClient;
            setChoosingClient(null);
            void bind({ kind: "bind", pickId: pick.pick_id, title: pick.title, ...(clientId ? { clientId } : {}) });
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
            void bind(action);
          }}
        />
      ) : null}
    </>
  );
}

function BindClientDialog({
  pick,
  clients,
  onClose,
  onBind,
}: {
  pick: PendingGbpPick;
  clients: ClientRecord[];
  onClose: () => void;
  onBind: (clientId: string | null) => void;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bind {pick.title}</DialogTitle>
          <DialogDescription>Optionally group this location under a client. You can change it later.</DialogDescription>
        </DialogHeader>
        <ClientSelect id="bind-client" clients={clients} value={clientId} onChange={setClientId} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onBind(clientId)}>
            <Link2 aria-hidden /> Bind
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
