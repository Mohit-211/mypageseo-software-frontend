import { api, unwrapData } from "../client";
import type { CitationChangesResponse, CitationStatus, CitationsResponse } from "../types/citations";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/citations`;

/** The Citations page: Citation Health, counts, recent changes and the table. `{ available: false }` before the list exists. */
export async function getCitations(locationId: string, status?: CitationStatus, signal?: AbortSignal): Promise<CitationsResponse> {
  return unwrapData(await api.get(base(locationId), { ...(status ? { query: { status } } : {}), ...(signal ? { signal } : {}) }));
}

/** The full change history, newest first. */
export async function getCitationChanges(
  locationId: string,
  query: { page?: number; limit?: number },
  signal?: AbortSignal,
): Promise<CitationChangesResponse> {
  return unwrapData(await api.get(`${base(locationId)}/changes`, { query, ...(signal ? { signal } : {}) }));
}
