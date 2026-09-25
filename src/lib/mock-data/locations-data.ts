import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { DEMO_LOCATIONS } from "../mypageseo/demo/entities";
import type { Client, LocationSummary } from "../mypageseo/workspace";

export type LocationStatus = "active" | "setup_required" | "disconnected";

export type ManagedLocation = LocationSummary & {
  clientName?: string;
  visibility: number | null;
  visibilityChange: number | null;
  gbpHealth: number | null;
  averageRank: number | null;
  status: LocationStatus;
};

type LocationMetrics = Pick<
  ManagedLocation,
  "visibility" | "visibilityChange" | "gbpHealth" | "averageRank" | "status"
>;

const FALLBACK_METRICS: LocationMetrics = {
  visibility: null,
  visibilityChange: null,
  gbpHealth: null,
  averageRank: null,
  status: "setup_required",
};

/**
 * List metrics for a location. The backend read is not connected in this
 * frontend, so the shared demo layer supplies the operational values; swap
 * `real` for the backend response to retire the fallback.
 */
function metricsFor(locationId: string): LocationMetrics {
  const real: LocationMetrics | null = null;
  return withDemoFallback(real, () => {
    const demo = DEMO_LOCATIONS.find((l) => l.id === locationId);
    if (!demo) return FALLBACK_METRICS;
    return {
      visibility: demo.visibility,
      visibilityChange: demo.visibilityChange,
      gbpHealth: demo.gbpHealth,
      averageRank: demo.averageRank,
      status: demo.state_,
    };
  });
}

export function buildManagedLocations(
  locations: LocationSummary[],
  clients: Client[],
): ManagedLocation[] {
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));
  return locations.map((location) => {
    const clientName = location.clientId ? clientNames.get(location.clientId) : undefined;
    return {
      ...location,
      ...(clientName ? { clientName } : {}),
      ...metricsFor(location.id),
    };
  });
}