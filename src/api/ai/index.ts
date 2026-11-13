import { api, unwrapData } from "../client";
import type { AiFact, AiFactInput, AiFactKind, AiFactPatch, AiFactsList, AiSettings, AiSettingsUpdate } from "../types/ai";

/** AI per location (Phase 25a): facts the AI may state and how it writes. No AI, no tokens. */
const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/ai`;

/** The location's facts, offers, events and contests (newest first), and whether offers are allowed. */
export async function getAiFacts(locationId: string, kind?: AiFactKind, signal?: AbortSignal): Promise<AiFactsList> {
  return unwrapData(await api.get(`${base(locationId)}/facts`, { ...(kind ? { query: { kind } } : {}), ...(signal ? { signal } : {}) }));
}

/**
 * Adds a fact (201). 400 `invalid_fact` (`issues: [{ field, code, message }]`), `invalid_input`,
 * `offer_not_allowed_for_lodging`, `offer_not_allowed_for_regulated` (`sector`, and `term` when the
 * offer's own words name a regulated product), `too_many_facts` (`limit`).
 */
export async function createAiFact(locationId: string, input: AiFactInput): Promise<AiFact> {
  return unwrapData(await api.post(`${base(locationId)}/facts`, input));
}

/** Changes a fact (not its kind); `null` or "" clears a field and the whole fact is checked again. 404 `fact_not_found`. */
export async function updateAiFact(locationId: string, factId: string, patch: AiFactPatch): Promise<AiFact> {
  return unwrapData(await api.patch(`${base(locationId)}/facts/${encodeURIComponent(factId)}`, patch));
}

export async function deleteAiFact(locationId: string, factId: string): Promise<{ deleted: true; fact_id: string }> {
  return unwrapData(await api.delete(`${base(locationId)}/facts/${encodeURIComponent(factId)}`));
}

/** The settings in force, which are defaults, and restricted mode's state. */
export async function getAiSettings(locationId: string, signal?: AbortSignal): Promise<AiSettings> {
  return unwrapData(await api.get(`${base(locationId)}/settings`, signal ? { signal } : {}));
}

/**
 * Saves any of the settings (`null` or "" = back to the default) and answers the whole object.
 * Restricted mode off: the owner only, with `attest: true` (403 `owner_only`, 400 `attestation_required`).
 */
export async function updateAiSettings(locationId: string, update: AiSettingsUpdate): Promise<AiSettings> {
  return unwrapData(await api.put(`${base(locationId)}/settings`, update));
}
