import { ApiError, api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { clearAccessToken, getValidRefreshToken, setAuthTokens } from "../token-storage";
import type { AuthTokens, RefreshTokenResponse } from "../types/auth";

/** Shared in-flight refresh, so parallel 401s trigger a single refresh call. */
let pending: Promise<AuthTokens> | null = null;

/**
 * Exchanges the stored refresh token (`REFRESH_KEY`) for a new token pair and
 * stores it, keeping the session's "Remember me" choice. Ends the session when
 * there is no refresh token or the backend rejects it.
 */
export function refreshToken(): Promise<AuthTokens> {
  pending ??= doRefresh().finally(() => {
    pending = null;
  });
  return pending;
}

async function doRefresh(): Promise<AuthTokens> {
  const refresh = getValidRefreshToken();
  if (!refresh) {
    clearAccessToken();
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  let response: RefreshTokenResponse;
  try {
    response = await api.post<RefreshTokenResponse>(
      ENDPOINTS.auth.refresh,
      { refresh_token: refresh },
      { auth: false },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) clearAccessToken();
    throw error;
  }

  const data = response?.data;
  const tokens = data && "tokens" in data ? data.tokens : data;
  if (!tokens?.access?.token) {
    throw new ApiError("Refresh response did not include an access token.", 500, { details: response });
  }
  setAuthTokens({ access: tokens.access.token, refresh: tokens.refresh?.token });
  return tokens;
}
