import { withDemoFallback, demoDate, seedFrom } from "./demo/demo-mode";
import { buildManagedLocations, type ManagedLocation } from "../mock-data/locations-data";
import type { Client, LocationSummary } from "./workspace";

export type ClientAccountStatus = "active" | "setup_required" | "disconnected";

export type ManagedClient = {
  id: string;
  name: string;
  locationCount: number;
  /** Portfolio averages, null when no location reports the metric. */
  visibility: number | null;
  gbpHealth: number | null;
  averageRating: number | null;
  reviewCount: number | null;
  /** Locations that still need setup or are disconnected. */
  needsAttention: number;
  status: ClientAccountStatus;
  /**
   * Report status and last activity are supplied by the reporting/activity
   * backend, which is not wired into this frontend, so they stay null.
   */
  reportStatus: string | null;
  lastActivity: string | null;
};

export type ClientCapabilities = {
  canCreate: boolean;
  canInviteUsers: boolean;
  canEdit: boolean;
};

/**
 * Client creation, editing and user invitations require the agency
 * account-management backend, which is not wired into this frontend.
 */
export function getClientCapabilities(): ClientCapabilities {
  return { canCreate: false, canInviteUsers: false, canEdit: false };
}

const REPORT_STATUSES = ["Delivered", "Scheduled", "Draft"] as const;

/**
 * Report status and last activity are supplied by the reporting/activity
 * backend, which is not wired into this frontend, so this falls back to a
 * deterministic demo value scoped to the client.
 */
function reportingFor(clientId: string): { reportStatus: string | null; lastActivity: string | null } {
  const real: { reportStatus: string | null; lastActivity: string | null } | null = null;
  return withDemoFallback(real, () => ({
    reportStatus: REPORT_STATUSES[seedFrom(clientId, "report-status") % REPORT_STATUSES.length]!,
    lastActivity: demoDate(seedFrom(clientId, "last-activity") % 14),
  }));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

/** Aggregates the agency portfolio from the same location records the Locations screen uses. */
export function buildManagedClients(clients: Client[], locations: LocationSummary[]): ManagedClient[] {
  const managed: ManagedLocation[] = buildManagedLocations(locations, clients);

  return clients.map((client) => {
    const owned = managed.filter((location) => location.clientId === client.id);
    const visibility = average(owned.map((l) => l.visibility).filter((v): v is number => v !== null));
    const gbpHealth = average(owned.map((l) => l.gbpHealth).filter((v): v is number => v !== null));
    const ratings = owned.map((l) => l.rating).filter((v): v is number => typeof v === "number");
    const reviews = owned.map((l) => l.reviewCount).filter((v): v is number => typeof v === "number");
    const needsAttention = owned.filter((l) => l.status !== "active").length;
    const status: ClientAccountStatus =
      owned.length === 0
        ? "setup_required"
        : owned.every((l) => l.status === "disconnected")
          ? "disconnected"
          : owned.some((l) => l.status !== "active")
            ? "setup_required"
            : "active";

    return {
      id: client.id,
      name: client.name,
      locationCount: owned.length,
      visibility,
      gbpHealth,
      averageRating: average(ratings),
      reviewCount: reviews.length > 0 ? reviews.reduce((sum, value) => sum + value, 0) : null,
      needsAttention,
      status,
      ...reportingFor(client.id),
    };
  });
}

export const CLIENT_STATUS_LABEL: Record<ClientAccountStatus, string> = {
  active: "Active",
  setup_required: "Setup required",
  disconnected: "Disconnected",
};

export const CLIENTS_PAGE_SIZE = 10;
