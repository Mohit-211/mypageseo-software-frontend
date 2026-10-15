import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";

/**
 * White-label client links (Phase 23, agency with the `white_label` plan feature): one link per location
 * on a neutral domain, showing the agency's branding and the selected reports. 403 `agency_only`,
 * `read_only` (client user), `feature_not_included`; writes 402 `subscription_required` / 403 `organization_suspended`.
 */
export type WhiteLabelReportType = "rank_tracker" | "gbp_audit" | "competitor_analysis" | "citation" | "reputation";

export type WhiteLabelBrandingOverride = {
  name: string | null;
  website_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo: { mime: string; bytes: number; url: string } | null;
};

export type WhiteLabelLink = {
  url: string;
  reports: WhiteLabelReportType[];
  branding_override: WhiteLabelBrandingOverride | null;
  views: number;
  last_viewed_at: string | null;
  created_at: string;
  rotated_at: string | null;
};

export type WhiteLabelLinkState = {
  link: WhiteLabelLink | null;
  /** `available` is null before the location's first edition; a type without data is hidden on the page. */
  types: { type: WhiteLabelReportType; selected: boolean; available: boolean | null; reason: string | null }[];
  /** Newest first (≤ 50). Open one with `<url>?e=<key>`. */
  editions: { key: string; generated_at: string; trigger: "link_created" | "refresh" }[];
};

/** `null` clears the override (logo included); `""` clears one field; omitted keeps it. */
export type WhiteLabelLinkInput = {
  reports: WhiteLabelReportType[];
  branding_override?: Partial<Record<"name" | "website_url" | "primary_color" | "secondary_color", string>> | null;
};

export type WhiteLabelLinkRow = {
  location: { id: string; name: string; city: string | null; state: string | null; client_id: string | null };
  url: string;
  reports: WhiteLabelReportType[];
  branding_override: boolean;
  views: number;
  last_viewed_at: string | null;
  last_edition_at: string | null;
  created_at: string;
};

export type WhiteLabelLinkList = { results: WhiteLabelLinkRow[]; page: number; limit: number; total: number };

export async function getWhiteLabelLinks(query: { page?: number; limit?: number }, signal?: AbortSignal): Promise<WhiteLabelLinkList> {
  return unwrapData(await api.get(ENDPOINTS.whiteLabel.list, { query, ...(signal ? { signal } : {}) }));
}

export async function getWhiteLabelLink(locationId: string, signal?: AbortSignal): Promise<WhiteLabelLinkState> {
  return unwrapData(await api.get(ENDPOINTS.whiteLabel.link(locationId), signal ? { signal } : {}));
}

/** Creates the link (and its first edition) or updates it. */
export async function saveWhiteLabelLink(locationId: string, input: WhiteLabelLinkInput): Promise<WhiteLabelLinkState> {
  return unwrapData(await api.put(ENDPOINTS.whiteLabel.link(locationId), input));
}

/** A new URL; the old one stops working at once. 404 `no_link`. */
export async function rotateWhiteLabelLink(locationId: string): Promise<WhiteLabelLinkState> {
  return unwrapData(await api.post(ENDPOINTS.whiteLabel.rotate(locationId)));
}

/** Turns the link off; its editions are kept and come back with a new link. 404 `no_link`. */
export async function revokeWhiteLabelLink(locationId: string): Promise<{ revoked: true }> {
  return unwrapData(await api.delete(ENDPOINTS.whiteLabel.link(locationId)));
}

/** The override logo is private, so it's fetched with the session. */
export async function getWhiteLabelLinkLogo(locationId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await api.get<Response>(ENDPOINTS.whiteLabel.logo(locationId), { responseType: "blob", ...(signal ? { signal } : {}) });
  return response.blob();
}

/** PNG or JPEG ≤ 512 KB as a data URL. 400 `logo_type`, `logo_too_large`; 404 `no_link`. */
export async function uploadWhiteLabelLinkLogo(locationId: string, dataUrl: string): Promise<WhiteLabelLinkState> {
  return unwrapData(await api.put(ENDPOINTS.whiteLabel.logo(locationId), { data: dataUrl }));
}

export async function deleteWhiteLabelLinkLogo(locationId: string): Promise<WhiteLabelLinkState> {
  return unwrapData(await api.delete(ENDPOINTS.whiteLabel.logo(locationId)));
}
