import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  GbpAccountLocationsResponse,
  GbpBindResult,
  GbpConnectCodeResult,
  GbpConnectionsResponse,
  GbpConnectUrlResponse,
  GbpDisconnectResult,
  GbpPopupConfig,
  GbpSavePicksResponse,
  GbpUnbindResult,
} from "../types/gbp";

/** Accepts a bare string, `{ url }`, or a `{ data: ... }` envelope. */
function unwrapUrl(payload: GbpConnectUrlResponse): string | undefined {
  if (typeof payload === "string") return payload;
  const source = typeof payload?.data === "string" ? payload.data : (payload?.data ?? payload);
  if (typeof source === "string") return source;
  return source?.url ?? source?.authUrl ?? source?.auth_url;
}

/**
 * Redirect-flow fallback: the Google consent URL. The backend finishes the
 * connection and sends the browser to `/gbp/connect/callback`.
 */
export async function getGbpConnectUrl(signal?: AbortSignal): Promise<string> {
  const payload = await api.get<GbpConnectUrlResponse>(ENDPOINTS.gbp.connectUrl, signal ? { signal } : {});
  const url = unwrapUrl(payload);
  if (!url) throw new Error("Google connection URL was not returned.");
  return url;
}

/** Config for the Google Identity Services code client. The `state` works once, for 10 minutes. */
export async function getGbpPopupConfig(signal?: AbortSignal): Promise<GbpPopupConfig> {
  return unwrapData(await api.get(ENDPOINTS.gbp.connectPopup, signal ? { signal } : {}));
}

/** Exchanges the popup's code. 409 `google_account_limit` when 3 accounts are already connected. */
export async function exchangeGbpCode(code: string, state: string): Promise<GbpConnectCodeResult> {
  return unwrapData(await api.post(ENDPOINTS.gbp.connectCode, { code, state }));
}

/** The user's connected Google accounts (up to `limit`). */
export async function getGbpConnections(signal?: AbortSignal): Promise<GbpConnectionsResponse> {
  return unwrapData(await api.get(ENDPOINTS.gbp.connections, signal ? { signal } : {}));
}

/** One Google account's Business Profile locations, for the connect modal's checklist. */
export async function getGbpAccountLocations(
  googleSub: string,
  signal?: AbortSignal,
): Promise<GbpAccountLocationsResponse> {
  return unwrapData(await api.get(ENDPOINTS.gbp.connectionLocations(googleSub), signal ? { signal } : {}));
}

/** Saves the full selection for one account: unticked unbound picks are removed. */
export async function saveGbpPicks(googleSub: string, gbpLocationIds: string[]): Promise<GbpSavePicksResponse> {
  return unwrapData(
    await api.put(ENDPOINTS.gbp.connectionPicks(googleSub), { gbp_location_ids: gbpLocationIds }),
  );
}

/** The Bind button: creates or links the location. Subscription-gated (402 / 403). */
export async function bindGbpPick(pickId: string, clientId?: string): Promise<GbpBindResult> {
  return unwrapData(await api.post(ENDPOINTS.gbp.bindPick(pickId), clientId ? { client_id: clientId } : {}));
}

/** Removes an unbound pick from the locations page. */
export async function removeGbpPick(pickId: string): Promise<{ removed: boolean; pick_id: string }> {
  return unwrapData(await api.delete(ENDPOINTS.gbp.pick(pickId)));
}

/** Unbinds one location. The location stays; the Google account stays connected. */
export async function unbindGbpLocation(locationId: string): Promise<GbpUnbindResult> {
  return unwrapData(await api.post(ENDPOINTS.gbp.unbind, { location_id: locationId }));
}

/** Disconnects one Google account: its locations stay without GBP, its picks are removed. */
export async function disconnectGbp(googleSub: string): Promise<GbpDisconnectResult> {
  return unwrapData(await api.post(ENDPOINTS.gbp.disconnect, { google_sub: googleSub }));
}
