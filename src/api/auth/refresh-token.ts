import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { setAccessToken } from "../token-storage";
import type { AuthSession } from "../types/auth";

/** Exchanges the refresh cookie for a new access token. */
export async function refreshToken(remember = false): Promise<AuthSession> {
  const session = await api.post<AuthSession>(ENDPOINTS.auth.refresh, undefined, { auth: false });
  setAccessToken(session.accessToken, remember);
  return session;
}
