import { apiErrorData, bindGbpPick, createLocation, isApiError, type LocationSlotQuote, type LocationStatus } from "@/api";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";

export const LOCATION_STATUS_LABEL: Record<LocationStatus, string> = {
  active: "Active",
  setup_required: "Setup required",
  gbp_not_connected: "No GBP",
  gbp_disconnected: "GBP disconnected",
  reconnect_required: "Reconnect Google",
};

/** Runs a Bind or a Places add; resolves with the new (or linked) location's id. */
export async function runLocationAction(action: PendingLocationAction): Promise<string> {
  if (action.kind === "bind") return (await bindGbpPick(action.pickId, action.clientId)).location.location_id;
  return (await createLocation(action.placeId, action.clientId)).location.location_id;
}

/** Where a new or linked location continues: its setup screen. */
export function locationSetupPath(locationId: string) {
  return `/locations/${encodeURIComponent(locationId)}/setup`;
}

/** How the UI should react to a billing gate on adding a location, or null for other errors. */
export type LocationBillingGate =
  | { kind: "subscription_required" }
  | { kind: "location_payment_required"; quote: LocationSlotQuote | null }
  | { kind: "enterprise_required" }
  | { kind: "organization_suspended" };

export function locationBillingGate(err: unknown): LocationBillingGate | null {
  switch (isApiError(err) ? err.reason : undefined) {
    case "subscription_required":
      return { kind: "subscription_required" };
    case "location_payment_required":
      return { kind: "location_payment_required", quote: (apiErrorData(err).quote as LocationSlotQuote | undefined) ?? null };
    case "enterprise_required":
      return { kind: "enterprise_required" };
    case "organization_suspended":
      return { kind: "organization_suspended" };
    default:
      return null;
  }
}
