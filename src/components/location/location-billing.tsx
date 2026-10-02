import { useState } from "react";
import { formatDate } from "@/lib/datetime";
import { LoaderCircle } from "lucide-react";
import { buyLocationSlots, isApiError, type LocationSlotQuote } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  savePendingLocationAction,
  type PendingLocationAction,
} from "@/lib/billing/pending-location-payment";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** 402 `location_payment_required`: pay for one more slot, then the add is retried. */
export function LocationSlotDialog({
  action,
  quote,
  onClose,
  onFulfilled,
}: {
  action: PendingLocationAction;
  quote: LocationSlotQuote;
  onClose: () => void;
  onFulfilled: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periodEnd = formatDate(quote.period_end, "");

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const order = await buyLocationSlots(quote.quantity || 1);
      if (order.fulfilled) {
        onFulfilled();
        return;
      }
      if (order.approve_url) {
        // PayPal returns to the billing page, which captures the order and retries this add.
        savePendingLocationAction(action);
        window.location.assign(order.approve_url);
        return;
      }
      setError("The payment could not be started. Try again.");
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      setError(
        reason === "enterprise_required"
          ? "You've reached the plan's location limit. Contact us to move to an enterprise plan."
          : reason === "subscription_required"
            ? "A subscription is needed first. Open billing to subscribe."
            : "The payment could not be started. Try again.",
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || paying ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a location slot</DialogTitle>
          <DialogDescription>
            Your plan's locations are all in use. Adding {action.title} needs one more location slot.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-surface-strong p-3 text-sm">
          <p className="font-medium text-foreground">{formatMoney(quote.amount, quote.currency)}</p>
          <p className="text-xs text-muted-foreground">
            {quote.quantity} location slot{quote.quantity === 1 ? "" : "s"}
            {periodEnd ? `, prorated to ${periodEnd}` : ""}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={paying}>
            Cancel
          </Button>
          <Button onClick={() => void pay()} disabled={paying}>
            {paying ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
            {paying ? "Starting payment…" : "Pay for a slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
