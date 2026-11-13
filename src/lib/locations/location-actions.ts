import { apiErrorData, bindGbpPick, createLocation, isApiError, type LocationSlotQuote, type LocationStatus } from "@/api";
import type { PendingLocationAction } from "@/lib/billing/pending-location-payment";
import { LOCATION_STATUS_META } from "./location-status";

/** The status names (see `LOCATION_STATUS_META` for tone and help text). */
export const LOCATION_STATUS_LABEL = Object.fromEntries(
  Object.entries(LOCATION_STATUS_META).map(([status, meta]) => [status, meta.label]),
) as Record<LocationStatus, string>;

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
