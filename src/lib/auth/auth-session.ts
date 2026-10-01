/**
 * Signed-in state derived from the stored tokens.
 *
 * Access tokens last 1 day and refresh tokens 30 days, so a session is usable
 * while either is valid. When the access token runs out it is renewed with the
 * refresh token (POST auth/refresh); only a failed refresh, or no valid refresh
 * token, signs the user out. Clearing notifies every `useIsAuthenticated`
 * caller, so the route guards redirect straight away.
 */
import { useEffect, useSyncExternalStore } from "react";
import { refreshToken } from "@/api/auth/refresh-token";
import {
  clearAccessToken,
  getAccessToken,
  getTokenExpiry,
  getValidRefreshToken,
  hasUsableSession,
  isTokenExpired,
  subscribeToAccessToken,
} from "@/api/token-storage";
import { getOnboardingSession } from "./onboarding-state";

/** Browsers fire a setTimeout longer than this (~24.8 days) immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** Renews the access token, or signs out when that isn't possible. */
function renewOrSignOut() {
  if (!getValidRefreshToken()) {
    clearAccessToken();
    return;
  }
  // refreshToken() clears the session itself when the server rejects the refresh token.
  refreshToken().catch(() => undefined);
}

/** Whether the user has a usable session. Re-renders when tokens are set, cleared or renewed. */
export function useIsAuthenticated(): boolean {
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasUsableSession, () => false);
  // Re-arm the timer whenever the access token changes (a refresh issues a new one).
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);

  useEffect(() => {
    if (!authenticated) return;
    // No access token, or a stale one (e.g. the tab reopened after a day): renew now.
    if (!token || isTokenExpired(token)) {
      renewOrSignOut();
      return;
    }
    const expiry = getTokenExpiry(token);
    if (expiry === null) return;
    const timer = setTimeout(renewOrSignOut, Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [authenticated, token]);

  return authenticated;
}

/** Router state set on the /login redirect: the protected page the user was bounced from. */
export type AuthRedirectState = { from?: string };

/**
 * Where a signed-in user belongs: an unfinished setup first, then the page they
 * were bounced from, then the dashboard. Used by `GuestOnly` and the login page
 * so both land on the same place.
 */
export function getPostLoginPath(state: unknown): string {
  const onboarding = getOnboardingSession();
  if (onboarding && !onboarding.finishedAt) return "/onboarding";
  const from = (state as AuthRedirectState | null)?.from;
  // Only same-app paths; never bounce back to an auth page.
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    if (!/^\/(login|signup)(\/|\?|#|$)/.test(from)) return from;
  }
  return "/dashboard";
}
