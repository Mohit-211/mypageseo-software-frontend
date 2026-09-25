/**
 * Deterministic demo integration state.
 *
 * Used only while the integrations backend is unavailable. It mirrors the
 * shared demo organization (Riverside Dental Group / Northbound Digital) so
 * connection state matches the locations shown elsewhere in the product.
 */

import {
  DEMO_CLIENTS,
  DEMO_LOCATIONS,
  type DemoLocationFacts,
} from "./entities";
import type {
  GoogleConnectionState,
  IntegrationsResult,
  LocationConnection,
} from "../integrations";

const CLIENT_NAMES = new Map<string, string>(DEMO_CLIENTS.map((client) => [client.id, client.name]));

/** Google accounts that authorized each demo client's locations. */
const CLIENT_ACCOUNTS: Record<string, string> = {
  cl_riverside: "operations@riversidedental.com",
  cl_hearth: "marketing@hearthandoak.com",
  cl_summit: "owner@summitautocare.com",
  cl_lumen: "admin@lumenfamilylaw.com",
};

/** Locations whose demo Google grant has expired. */
const REAUTH_REQUIRED = new Set(["loc_riverside_south"]);

const LAST_SYNC: Record<string, string> = {
  loc_riverside_north: "2026-09-11T07:40:00.000Z",
  loc_riverside_south: "2026-08-29T06:15:00.000Z",
  loc_riverside_round_rock: "2026-09-10T07:38:00.000Z",
  loc_hearth_downtown: "2026-09-11T07:41:00.000Z",
  loc_hearth_cherry: "2026-09-11T07:41:00.000Z",
  loc_summit_main: "2026-09-11T07:42:00.000Z",
  loc_lumen_main: "2026-06-18T05:02:00.000Z",
};

function stateFor(location: DemoLocationFacts): GoogleConnectionState {
  if (REAUTH_REQUIRED.has(location.id)) return "reconnect_required";
  if (location.state_ === "disconnected") return "disconnected";
  if (location.state_ === "setup_required") return "not_configured";
  return "connected";
}

function issueFor(state: GoogleConnectionState): string | null {
  switch (state) {
    case "reconnect_required":
      return "Google access token expired. Profile, review and post data stopped updating.";
    case "disconnected":
      return "The Google account no longer grants Mypageseo access to this profile.";
    case "not_configured":
      return "This location has not been matched to a Google Business Profile yet.";
    default:
      return null;
  }
}

function connectionFor(location: DemoLocationFacts): LocationConnection {
  const state = stateFor(location);
  return {
    locationId: location.id,
    locationName: location.businessName,
    area: location.area,
    clientId: location.clientId,
    clientName: CLIENT_NAMES.get(location.clientId) ?? null,
    state,
    account: state === "not_configured" ? null : (CLIENT_ACCOUNTS[location.clientId] ?? null),
    lastSync: state === "not_configured" ? null : (LAST_SYNC[location.id] ?? null),
    issue: issueFor(state),
  };
}

export function DEMO_INTEGRATIONS(
  accountType: "business" | "agency",
  activeClientId: string | null,
): IntegrationsResult {
  const scoped = DEMO_LOCATIONS.filter((location) => {
    if (accountType === "business") return location.clientId === "cl_riverside";
    if (activeClientId) return location.clientId === activeClientId;
    return true;
  });

  return {
    status: "ready",
    google: {
      id: "google_business_profile",
      name: "Google Business Profile",
      purpose:
        "Authorizes Mypageseo to read and manage the Google Business Profiles behind your locations.",
      usedFor: [
        "Profile details, categories and hours",
        "Reviews and review replies",
        "Google posts",
        "Profile performance used in rankings and reporting",
      ],
      organizationAccount:
        accountType === "agency" ? "integrations@northbounddigital.com" : "operations@riversidedental.com",
      organizationState: "connected",
      locations: scoped.map(connectionFor),
      capabilities: {
        // Google authorization runs through OAuth, which is not connected to
        // this frontend yet. Keep these false until the flow is available.
        canConnect: false,
        canReconnect: false,
        canDisconnect: false,
        canManage: true,
      },
    },
  };
}
