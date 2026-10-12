import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ClientRecord, ClientsListResponse, LocationRow } from "../types/locations";

const one = (clientId: string) => `clients/${encodeURIComponent(clientId)}`;

/** Agency only: a business organization gets 403 `agency_only`. A client_user sees only its own clients. */
export async function getClients(signal?: AbortSignal, query: { search?: string; status?: "ACTIVE" | "INACTIVE" } = {}): Promise<ClientsListResponse> {
  return unwrapData(await api.get(ENDPOINTS.clients.list, { query: { limit: 100, ...query }, ...(signal ? { signal } : {}) }));
}

export type ClientInput = { name: string; website?: string | null; contact_email?: string | null };

export type ClientDetail = {
  client: ClientRecord;
  locations: LocationRow[];
  /** Averages over the locations with data. */
  summary: { locations: number; avg_rank: number | null; avg_gbp_score: number | null; gbp_connected: number };
};

export async function getClient(clientId: string, signal?: AbortSignal): Promise<ClientDetail> {
  return unwrapData(await api.get(one(clientId), signal ? { signal } : {}));
}

export async function createClient(input: ClientInput): Promise<ClientRecord> {
  return unwrapData(await api.post(ENDPOINTS.clients.list, input));
}

export async function updateClient(clientId: string, patch: Partial<ClientInput> & { status?: "ACTIVE" | "INACTIVE" }): Promise<ClientRecord> {
  return unwrapData(await api.patch(one(clientId), patch));
}

/** Its locations stay in the organization, unassigned. */
export async function deleteClient(clientId: string): Promise<{ deleted: boolean; locations_unassigned: number }> {
  return unwrapData(await api.delete(one(clientId)));
}

export async function assignClientLocation(clientId: string, locationId: string): Promise<unknown> {
  return unwrapData(await api.post(`${one(clientId)}/locations`, { location_id: locationId }));
}

export async function unassignClientLocation(clientId: string, locationId: string): Promise<unknown> {
  return unwrapData(await api.delete(`${one(clientId)}/locations/${encodeURIComponent(locationId)}`));
}
