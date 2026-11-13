import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ClientRecord, ClientsListResponse, LocationRow } from "../types/locations";

const one = (clientId: string) => `clients/${encodeURIComponent(clientId)}`;

/** `GET clients` returns at most 100 per page. */
const CLIENTS_PAGE_SIZE = 100;

type ClientsQuery = { search?: string; status?: "ACTIVE" | "INACTIVE" };

/**
 * One page of clients (the first unless `page` is given; up to 100). Agency only: a business
 * organization gets 403 `agency_only`. A client_user sees only its own clients.
 */
export async function getClients(signal?: AbortSignal, query: ClientsQuery & { page?: number } = {}): Promise<ClientsListResponse> {
  return unwrapData(await api.get(ENDPOINTS.clients.list, { query: { limit: CLIENTS_PAGE_SIZE, ...query }, ...(signal ? { signal } : {}) }));
}

/**
 * Every client, all pages (`getClients` stops at the first 100). Use it wherever the list is
 * treated as complete: totals, pickers, grouping locations by client, sorting in the browser.
 */
export async function loadAllClients(signal?: AbortSignal, query: ClientsQuery = {}): Promise<Pick<ClientsListResponse, "clients" | "total">> {
  const clients: ClientRecord[] = [];
  let total = 0;
  for (let page = 1; ; page += 1) {
    const result = await getClients(signal, { ...query, page });
    clients.push(...result.clients);
    total = result.total;
    if (clients.length >= result.total || result.clients.length === 0) break;
  }
  return { clients, total: Math.max(total, clients.length) };
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
