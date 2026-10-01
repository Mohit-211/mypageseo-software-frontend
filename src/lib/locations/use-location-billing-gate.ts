import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { LocationSlotQuote } from "@/api";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { locationBillingGate } from "./location-actions";

/**
 * Handles the billing gates on adding a location (Bind or Places add):
 * 402 `subscription_required` → billing page; 402 `location_payment_required` →
 * `payment` is set so the caller shows `LocationSlotDialog`; 403
 * `enterprise_required` / `organization_suspended` → a message. `handle` returns
 * false for other errors so the caller can show its own copy.
 */
export function useLocationBillingGate() {
  const navigate = useNavigate();
  const [payment, setPayment] = useState<{ action: PendingLocationAction; quote: LocationSlotQuote } | null>(null);

  const handle = (err: unknown, action: PendingLocationAction): boolean => {
    const gate = locationBillingGate(err);
    switch (gate?.kind) {
      case "subscription_required":
        toast.error("A subscription is needed to add locations.");
        navigate("/settings/billing");
        return true;
      case "location_payment_required":
        if (gate.quote) setPayment({ action, quote: gate.quote });
        else toast.error("Your plan's locations are all in use. Add a location slot from billing.");
        return true;
      case "enterprise_required":
        toast.error("You've reached the plan's location limit. Contact us to move to an enterprise plan.");
        return true;
      case "organization_suspended":
        toast.error("This account is suspended. Contact support.");
        return true;
      default:
        return false;
    }
  };

  return { handle, payment, closePayment: () => setPayment(null) };
}
