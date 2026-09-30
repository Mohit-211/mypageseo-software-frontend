/**
 * External integrations for the organization.
 *
 * Mypageseo works with one external service today: Google Business Profile.
 * Google access is granted per location — an organization-level Google
 * account can be linked, but each location must be matched to a Google
 * Business Profile individually, so both levels are reported separately.
 *
 * Authorization (connect, reconnect) runs through the Google OAuth flow in
 * lib/gbp/use-gbp-connect.ts; disconnect revokes it via `gbp/disconnect`.
 * Real payloads always win; the demo status is only used while the
 * integrations backend is unavailable.
 */

import { withDemoFallback } from "./demo/demo-mode";
import { DEMO_INTEGRATIONS } from "./demo/integrations";

export type GoogleConnectionState =
  | "connected"
  | "reconnect_required"
  | "disconnected"
  | "not_configured";

export type LocationConnection = {
  locationId: string;
  locationName: string;
  area: string;
  clientId: string | null;
  clientName: string | null;
  state: GoogleConnectionState;
  /** Masked Google account that authorized this location, null when unknown. */
  account: string | null;
  /** ISO timestamp of the last successful sync, null when never synced. */
  lastSync: string | null;
  /** Actual backend detail for a problem state, null when healthy. */
  issue: string | null;
};

export type IntegrationCapabilities = {
  canConnect: boolean;
  canReconnect: boolean;
  canDisconnect: boolean;
  /** Open the location screens that use this integration's data. */
  canManage: boolean;
};

export type GoogleIntegration = {
  id: "google_business_profile";
  name: string;
  purpose: string;
  /** What Mypageseo reads through this integration. */
  usedFor: string[];
  /** Organization-level Google account, null when none is linked. */
  organizationAccount: string | null;
  organizationState: GoogleConnectionState;
  locations: LocationConnection[];
  capabilities: IntegrationCapabilities;
};

export type IntegrationsResult =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable"; reason: string }
  | { status: "ready"; google: GoogleIntegration };

export const CONNECTION_LABEL: Record<GoogleConnectionState, string> = {
  connected: "Connected",
  reconnect_required: "Reconnect required",
  disconnected: "Disconnected",
  not_configured: "Not connected",
};

export const CONNECTION_TONE: Record<GoogleConnectionState, "success" | "warning" | "critical" | "neutral"> = {
  connected: "success",
  reconnect_required: "warning",
  disconnected: "critical",
  not_configured: "neutral",
};

export function getIntegrations(
  accountType: "business" | "agency",
  activeClientId?: string | null,
  real?: IntegrationsResult | null,
): IntegrationsResult {
  return withDemoFallback(real, () => DEMO_INTEGRATIONS(accountType, activeClientId ?? null));
}

/** Mask an email so only the domain and first characters are visible. */
export function maskAccount(account: string | null): string | null {
  if (!account) return null;
  const [local, domain] = account.split("@");
  if (!local || !domain) return account;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function countByState(locations: LocationConnection[], state: GoogleConnectionState): number {
  return locations.filter((location) => location.state === state).length;
}
