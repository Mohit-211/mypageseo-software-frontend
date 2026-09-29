/**
 * Signed-in state derived from the stored access token.
 *
 * Login survives a refresh because the token lives in web storage. An expired
 * token is cleared, both on load and by a timer while the user is on a page;
 * any 401 from the API also clears it (api/client.ts). Clearing notifies every
 * `useIsAuthenticated` caller, so the route guards redirect straight away.
 */
import { useEffect, useSyncExternalStore } from "react";
import {
  clearAccessToken,
  getAccessToken,
  getTokenExpiry,
  isTokenExpired,
  subscribeToAccessToken,
} from "@/api/token-storage";
import { getOnboardingSession } from "./onboarding-state";

/** Browsers fire a setTimeout longer than this (~24.8 days) immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647;

function hasValidToken(): boolean {
  const token = getAccessToken();
  return token !== null && !isTokenExpired(token);
}

/** Whether the user has a usable access token. Re-renders when it is set, cleared or expires. */
export function useIsAuthenticated(): boolean {
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasValidToken, () => false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    // Drop a token that is already stale (e.g. the tab reopened after expiry).
    if (isTokenExpired(token)) {
      clearAccessToken();
      return;
    }
    const expiry = getTokenExpiry(token);
    if (expiry === null) return;
    const timer = setTimeout(clearAccessToken, Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [authenticated]);

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
