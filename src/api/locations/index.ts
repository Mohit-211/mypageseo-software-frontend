import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  CompetitorSuggestionsResponse,
  CreateLocationResult,
  LocationCenterResult,
  LocationHeader,
  LocationOverview,
  LocationsListParams,
  LocationsListResponse,
  PlaceSearchResponse,
  PlaceSuggestion,
  RankRun,
  TrackingEstimate,
  TrackingResponse,
} from "../types/locations";

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** `GET locations`: the table page plus `pending_gbp` (outside the filters and pagination). */
export async function getLocationsList(
  params: LocationsListParams = {},
  signal?: AbortSignal,
): Promise<LocationsListResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.list, { query: params, ...withSignal(signal) }));
}

export async function getLocation(locationId: string, signal?: AbortSignal): Promise<LocationHeader> {
  return unwrapData(await api.get(ENDPOINTS.locations.detail(locationId), withSignal(signal)));
}

export async function getLocationOverview(locationId: string, signal?: AbortSignal): Promise<LocationOverview> {
  return unwrapData(await api.get(ENDPOINTS.locations.overview(locationId), withSignal(signal)));
}

/** Adds a location from a Places search result. 409 `duplicate_place`; 402 / 403 billing gates. */
export async function createLocation(placeId: string, clientId?: string): Promise<CreateLocationResult> {
  return unwrapData(
    await api.post(ENDPOINTS.locations.list, { place_id: placeId, ...(clientId ? { client_id: clientId } : {}) }),
  );
}

/** `PATCH locations/:id`; `client_id: null` unassigns. Returns the header. */
export async function updateLocation(
  locationId: string,
  patch: { client_id?: string | null; name?: string; timezone?: string },
): Promise<LocationHeader> {
  return unwrapData(await api.patch(ENDPOINTS.locations.detail(locationId), patch));
}

/** Soft delete. */
export async function deleteLocation(locationId: string): Promise<{ deleted: boolean }> {
  return unwrapData(await api.delete(ENDPOINTS.locations.detail(locationId)));
}

/**
 * Sets a service-area business's center: a suggestion picked from `getPlaceSuggestions`
 * (`{ place_id, session }`, recommended) or free text (`{ query }`, 2–100 characters).
 */
export async function setLocationCenter(
  locationId: string,
  input: { query: string } | { place_id: string; session: string },
): Promise<LocationCenterResult> {
  return unwrapData(await api.put(ENDPOINTS.locations.center(locationId), input));
}

/**
 * City / region / ZIP suggestions. Send the same `session` with every keystroke and with
 * the pick, then start a new one. 429 `rate_limited` above 120 per user per hour.
 */
export async function getPlaceSuggestions(
  q: string,
  session: string,
  options: { locationId?: string; signal?: AbortSignal } = {},
): Promise<{ suggestions: PlaceSuggestion[]; attribution?: { provider: string; text: string } }> {
  return unwrapData(
    await api.get(ENDPOINTS.places.autocomplete, {
      query: { q, session, ...(options.locationId ? { locationId: options.locationId } : {}) },
      ...withSignal(options.signal),
    }),
  );
}

export async function getTracking(locationId: string, signal?: AbortSignal): Promise<TrackingResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.tracking(locationId), withSignal(signal)));
}

/**
 * Partial update: only the fields sent change. `grid` takes `radius_km` or `spacing_km`
 * (400 `invalid_grid`); competitors are place IDs (400 `too_many_competitors`,
 * `own_place_id`, `invalid_place_id`).
 */
export async function updateTracking(
  locationId: string,
  patch: {
    keywords?: string[];
    competitors?: string[];
    grid?: { size: number; radius_km: number };
  },
): Promise<TrackingResponse> {
  return unwrapData(await api.put(ENDPOINTS.locations.tracking(locationId), patch));
}

export async function getCompetitorSuggestions(
  locationId: string,
  signal?: AbortSignal,
): Promise<CompetitorSuggestionsResponse> {
  return unwrapData(await api.get(ENDPOINTS.locations.competitorSuggestions(locationId), withSignal(signal)));
}

/**
 * Places search: without `locationId` it's the add-location search (`already_added`);
 * with it, a competitor search near that location (excluding it).
 */
export async function searchPlaces(
  q: string,
  options: { locationId?: string; signal?: AbortSignal } = {},
): Promise<PlaceSearchResponse> {
  return unwrapData(
    await api.get(ENDPOINTS.places.search, {
      query: { q, ...(options.locationId ? { locationId: options.locationId } : {}) },
      ...withSignal(options.signal),
    }),
  );
}

export async function getRankRun(locationId: string, runId: string, signal?: AbortSignal): Promise<RankRun> {
  return unwrapData(await api.get(ENDPOINTS.locations.rankRun(locationId, runId), withSignal(signal)));
}

/** What a run would need with these settings (no Google calls, nothing saved). */
export async function getTrackingEstimate(
  locationId: string,
  params: { size?: number; radius_km?: number; keywords?: number },
  signal?: AbortSignal,
): Promise<TrackingEstimate> {
  return unwrapData(await api.get(ENDPOINTS.locations.trackingEstimate(locationId), { query: params, ...withSignal(signal) }));
}
