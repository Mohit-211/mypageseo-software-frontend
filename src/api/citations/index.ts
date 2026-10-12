import { api, unwrapData } from "../client";
import type { CitationChangesPage, CitationStatus, CitationsResponse } from "../types/citations";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/citations`;

/** Read-only; another organization's location is a 404. */
export async function getCitations(locationId: string, status?: CitationStatus, signal?: AbortSignal): Promise<CitationsResponse> {
  return unwrapData(await api.get(base(locationId), { query: { status }, ...(signal ? { signal } : {}) }));
}

export async function getCitationChanges(locationId: string, page = 1, limit = 20, signal?: AbortSignal): Promise<CitationChangesPage> {
  return unwrapData(await api.get(`${base(locationId)}/changes`, { query: { page, limit }, ...(signal ? { signal } : {}) }));
}
