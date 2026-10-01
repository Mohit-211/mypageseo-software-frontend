import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ClientsListResponse } from "../types/locations";

/** Agency only: a business organization gets 403 `agency_only`. */
export async function getClients(signal?: AbortSignal): Promise<ClientsListResponse> {
  return unwrapData(await api.get(ENDPOINTS.clients.list, { query: { limit: 100 }, ...(signal ? { signal } : {}) }));
}
