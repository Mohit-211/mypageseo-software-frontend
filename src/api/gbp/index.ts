import { api, isApiError } from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  GbpConnection,
  GetGbpResponse,
  GbpConnectionResponse,
  GbpConnectUrlResponse,
} from "../types/gbp";

/** Accepts a bare string, `{ url }`, or a `{ data: ... }` envelope. */
function unwrapUrl(payload: GbpConnectUrlResponse): string | undefined {
  if (typeof payload === "string") return payload;
  const source = typeof payload?.data === "string" ? payload.data : (payload?.data ?? payload);
  if (typeof source === "string") return source;
  return source?.url ?? source?.authUrl ?? source?.auth_url;
}

/**
 * Returns the Google sign-in URL that starts the Google Business Profile connection.
 * `redirectUrl` is the frontend page the backend sends the browser to when the
 * connection finishes, so it returns to the same origin (localhost, staging, production).
 * Rejects with an `ApiError` when the backend refuses or returns no URL.
 */
export async function getGbpConnectUrl(redirectUrl: string, signal?: AbortSignal): Promise<string> {
  const payload = await api.get<GbpConnectUrlResponse>(ENDPOINTS.gbp.connectUrl, {
    query: { redirect_url: redirectUrl },
    ...(signal ? { signal } : {}),
  });
  const url = unwrapUrl(payload);
  if (!url) throw new Error("Google connection URL was not returned.");
  return url;
}

/** Backend messages such as "Please connect with Google Business Profile". */
const NOT_CONNECTED_MESSAGE = /connect/i;

/**
 * Returns the current Google Business Profile connection, or `null` when none exists
 * (empty payload or 404). When the backend explains that no profile is connected
 * (e.g. "Please connect with Google Business Profile"), returns `{ connected: false, message }`.
 */
export async function getGbp(signal?: AbortSignal): Promise<GbpConnection | null> {
  try {
    const payload = await api.get<GetGbpResponse>(ENDPOINTS.gbp.get, signal ? { signal } : {});
    if (!payload || typeof payload !== "object") return null;
    if ("data" in payload) {
      const data = (payload.data as GbpConnection | null | undefined) ?? null;
      const message = typeof payload.message === "string" ? payload.message : undefined;
      if (!data && message && NOT_CONNECTED_MESSAGE.test(message)) return { connected: false, message };
      return data;
    }
    return payload as GbpConnection;
  } catch (err) {
    if (isApiError(err) && err.status >= 400 && err.status < 500 && NOT_CONNECTED_MESSAGE.test(err.message)) {
      return { connected: false, message: err.message };
    }
    if (isApiError(err) && err.status === 404) return null;
    throw err;
  }
}

/** Revokes the Google Business Profile connection for the current account. */
export function disconnectGbp(): Promise<GbpConnectionResponse> {
  return api.post<GbpConnectionResponse>(ENDPOINTS.gbp.disconnect);
}
