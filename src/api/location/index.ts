import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { City, Country, State } from "../types/location";

type ListPayload<T> =
  | T[]
  | { data?: T[] | { docs?: T[]; items?: T[]; data?: T[] } }
  | undefined;

/** Accepts a bare array, a `{ data: [...] }` envelope, or a paginated `{ data: { docs | items | data } }`. */
function unwrapList<T>(payload: ListPayload<T>): T[] {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  return data?.docs ?? data?.items ?? data?.data ?? [];
}

/** Every country in one page — the list is small enough to load up front. */
export async function getCountries(signal?: AbortSignal): Promise<Country[]> {
  const payload = await api.get<ListPayload<Country>>(ENDPOINTS.location.countries, {
    auth: false,
    query: { limit: 1000, page: 1 },
    ...(signal ? { signal } : {}),
  });
  return unwrapList(payload);
}

export async function getStates(countryId: string, signal?: AbortSignal): Promise<State[]> {
  const payload = await api.get<ListPayload<State>>(ENDPOINTS.location.statesByCountry(countryId), {
    auth: false,
    ...(signal ? { signal } : {}),
  });
  return unwrapList(payload);
}

export async function getCities(stateId: string, signal?: AbortSignal): Promise<City[]> {
  const payload = await api.get<ListPayload<City>>(ENDPOINTS.location.citiesByState(stateId), {
    auth: false,
    ...(signal ? { signal } : {}),
  });
  return unwrapList(payload);
}
