import { ApiError, api } from "../client";
import { ENDPOINTS } from "../endpoints";
import {
  clearAccessToken,
  getRefreshToken,
  getTokenExpiry,
  getValidAccessToken,
  isTokenExpired,
  setAuthTokens,
} from "../token-storage";
import type { AuthTokens } from "../types/auth";
import { withAuthLock } from "./auth-lock";

/** `POST auth/refresh` → `{ tokens: { access, refresh } }` in the usual envelope. */
type RefreshTokenResponse = { data?: { tokens?: AuthTokens } };

/**
 * Why renewal is coordinated: the backend rotates refresh tokens (each refresh
 * returns a new pair and deletes the token it was given), and a kept session
 * lives in localStorage, shared by every tab. Two tabs renewing together would
 * send the same token; the second gets a 401 and, if it cleared the tokens,
 * would sign every tab out. So a renewal:
 * 1. notes the refresh token it starts from, before waiting;
 * 2. waits its turn for the cross-tab auth lock (./auth-lock.ts);
 * 3. holding it, checks storage again: when the refresh token changed meanwhile,
 *    another tab already renewed the session, and if that tab's access token is
 *    valid it is used as is, with no API call;
 * 4. otherwise calls the API and stores the new pair;
 * 5. on a refusal, ends the session only when the refused token is still the
 *    stored one (one that another tab or a new sign-in already replaced is no
 *    reason to sign out).
 * Within a tab, parallel callers share one renewal.
 */
let pending: Promise<AuthTokens> | null = null;

/**
 * Exchanges the stored refresh token for a new token pair and stores it, keeping
 * the session's "Keep me signed in" choice. Ends the session when there is no
 * usable refresh token or the backend refuses it.
 */
export function refreshToken(): Promise<AuthTokens> {
  if (!pending) {
    const startedFrom = getRefreshToken();
    pending = withAuthLock(() => renew(startedFrom)).finally(() => {
      pending = null;
    });
  }
  return pending;
}

function expiresAt(token: string): string {
  const expiry = getTokenExpiry(token);
  return expiry === null ? "" : new Date(expiry).toISOString();
}

/** The stored session as a token pair, when its access token is still valid. */
function storedSession(): AuthTokens | null {
  const access = getValidAccessToken();
  if (!access) return null;
  const refresh = getRefreshToken();
  return {
    access: { token: access, expires: expiresAt(access) },
    ...(refresh ? { refresh: { token: refresh, expires: expiresAt(refresh) } } : {}),
  };
}

function sessionEnded(): ApiError {
  return new ApiError("Your session has ended. Please sign in again.", 401);
}

/** One renewal, run while holding the auth lock. */
async function renew(startedFrom: string | null): Promise<AuthTokens> {
  const refresh = getRefreshToken();
  if (refresh !== startedFrom) {
    // Renewed (or replaced by a new sign-in) while this tab waited its turn.
    const current = storedSession();
    if (current) return current;
  }
  if (!refresh || isTokenExpired(refresh)) {
    clearAccessToken();
    throw sessionEnded();
  }

  let response: RefreshTokenResponse;
  try {
    response = await api.post<RefreshTokenResponse>(ENDPOINTS.auth.refresh, { refresh_token: refresh }, { auth: false });
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      if (getRefreshToken() === refresh) clearAccessToken();
      else {
        const current = storedSession();
        if (current) return current;
      }
    }
    throw error;
  }

  const tokens = response?.data?.tokens;
  if (!tokens?.access?.token) {
    throw new ApiError("Refresh response did not include an access token.", 500, { details: response });
  }
  const stored = getRefreshToken();
  if (stored !== refresh) {
    // The session was signed out or replaced while this call was out: never bring an ended one back.
    const current = storedSession();
    if (current) return current;
    throw sessionEnded();
  }
  setAuthTokens({ access: tokens.access.token, refresh: tokens.refresh?.token });
  return tokens;
}
