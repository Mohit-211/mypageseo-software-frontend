import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { clearAccessToken, getRefreshToken } from "../token-storage";
import { setSelectedOrganizationId } from "../organization-storage";
import { withAuthLock } from "./auth-lock";

/**
 * Ends the session on the server (`POST auth/logout` revokes the refresh token),
 * then locally. Always resolves: the local tokens are cleared even when the call
 * fails (offline, or a token the server already dropped), and a token that only
 * the server still knows can't be used by anyone.
 *
 * It takes the same lock as renewal, so a renewal running in another tab
 * finishes first and the token revoked here is the newest one (revoking the one
 * it was about to replace would leave the new session alive). The call goes
 * without the bearer token: the endpoint only needs the refresh token, and an
 * expired access token would otherwise trigger a renewal right before the
 * sign-out.
 */
export function logout(): Promise<void> {
  return withAuthLock(async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await api.post<void>(ENDPOINTS.auth.logout, { refresh_token: refresh }, { auth: false });
    } catch {
      // Signed out locally below either way.
    } finally {
      clearAccessToken();
      setSelectedOrganizationId(null);
    }
  });
}
