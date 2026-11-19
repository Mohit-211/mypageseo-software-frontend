import { api, unwrapData } from "../client";
import type {
  AiFact,
  AiFactInput,
  AiFactKind,
  AiFactPatch,
  AiFactsList,
  AiReadiness,
  AiSettings,
  AiSettingsUpdate,
  BriefPatch,
  BriefRefreshAnswer,
  BriefSuggestionAnswer,
  BusinessBriefView,
  LocationLogoInput,
  LocationLogoView,
} from "../types/ai";

/**
 * AI per location (Phase 25a): facts the AI may state and how it writes. No AI, no tokens. Phase 25b/25c: the
 * business brief, the readiness checklist and the logo. Reads for every member (a client user too); changes for
 * owners and members (403 `read_only`).
 */
const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/ai`;
const logo = (locationId: string) => `locations/${encodeURIComponent(locationId)}/logo`;

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
 * Phase 25b/25c: `style_memo: { dismiss | restore }` ("Don't use" a learned preference) and `image_style`.
 */
export async function updateAiSettings(locationId: string, update: AiSettingsUpdate): Promise<AiSettings> {
  return unwrapData(await api.put(`${base(locationId)}/settings`, update));
}

/* -------------------------------------------------------------------------- */
/* Business brief (Phase 25b; shown only when `feature` is `on`)               */
/* -------------------------------------------------------------------------- */

/** What the business's website says about it, checked for the AI. Poll it while `status` is `queued`/`building` or `refresh.pending`. */
export async function getBusinessBrief(locationId: string, signal?: AbortSignal): Promise<BusinessBriefView> {
  return unwrapData(await api.get(`${base(locationId)}/brief`, signal ? { signal } : {}));
}

/**
 * The owner's corrections (≤ 50 changes), kept through every rebuild; answers the whole view. 400
 * `invalid_change` (+ `field`), `too_many_items`, `invalid_input`; 404 `brief_item_not_found`; 409
 * `brief_changed` (reload and try again).
 */
export async function updateBusinessBrief(locationId: string, patch: BriefPatch): Promise<BusinessBriefView> {
  return unwrapData(await api.patch(`${base(locationId)}/brief`, patch));
}

/**
 * "Read my website again" (free; once per 24 h): 202, then poll `getBusinessBrief`. 403 `brief_not_available`
 * (+ `state`); 429 `refresh_too_soon` (+ `next_allowed_at`); 402 `subscription_required`; 503
 * `ai_not_configured`, `refresh_not_queued` (try again; the 24 h limit isn't used up).
 */
export async function refreshBusinessBrief(locationId: string): Promise<BriefRefreshAnswer> {
  return unwrapData(await api.post(`${base(locationId)}/brief/refresh`));
}

/**
 * Confirm (it becomes an owner fact, `source_ref: "brief:<itemId>"`) or dismiss a proof point (`pp_…`) or a
 * research item (`rs_…`). 404 `suggestion_not_found`; 409 `already_confirmed` (+ `fact_id`: reload),
 * `brief_changed`; 400 `too_many_facts` (100 per location).
 */
export async function decideBriefSuggestion(locationId: string, itemId: string, action: "confirm" | "dismiss"): Promise<BriefSuggestionAnswer> {
  return unwrapData(await api.post(`${base(locationId)}/brief/suggestions/${encodeURIComponent(itemId)}`, { action }));
}

/** "Get the AI ready · N of M done": the available checks, what to do next, and their details. */
export async function getAiReadiness(locationId: string, signal?: AbortSignal): Promise<AiReadiness> {
  return unwrapData(await api.get(`${base(locationId)}/readiness`, signal ? { signal } : {}));
}

/* -------------------------------------------------------------------------- */
/* The logo (`/locations/:locationId/logo`, Phase 25c)                          */
/* -------------------------------------------------------------------------- */

/** The location's logo (`logo: null` until set; show it from `data_url`), the website's `candidates`, and whether it can go to every location. */
export async function getLocationLogo(locationId: string, signal?: AbortSignal): Promise<LocationLogoView> {
  return unwrapData(await api.get(logo(locationId), signal ? { signal } : {}));
}

/**
 * Sets the logo from an upload (`data`) or a website candidate (`candidate_url`), with `attest: true`. An AI check
 * reads it (free; about 55 s at most): 422 `logo_rejected` (+ `issues`: say what to remove); 400
 * `attestation_required`, `logo_type`, `logo_too_large`, `logo_unreadable`, `logo_blank`, `logo_too_small`,
 * `logo_too_wide` (ask for a stacked or square version), `logo_too_tall` (a horizontal or square one),
 * `logo_candidate_unknown`, `logo_fetch_failed`; 403 `owner_only`, `business_only` (`apply_to` in an agency);
 * 402; 503 `ai_*` / 502 `ai_failed` (nothing saved: try again).
 */
export async function setLocationLogo(locationId: string, input: LocationLogoInput): Promise<LocationLogoView> {
  return unwrapData(await api.put(logo(locationId), input, { timeoutMs: 90_000 }));
}

/** Removes the logo; answers the view with `logo: null`. */
export async function deleteLocationLogo(locationId: string): Promise<LocationLogoView> {
  return unwrapData(await api.delete(logo(locationId)));
}
