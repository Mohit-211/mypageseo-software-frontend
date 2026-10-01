import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { clearAccessToken, getRefreshToken } from "../token-storage";
import { setSelectedOrganizationId } from "../organization-storage";

/** Ends the session on the server. The local token is cleared even if the call fails. */
export async function logout(): Promise<void> {
  try {
    await api.post<void>(ENDPOINTS.auth.logout, { refresh_token: getRefreshToken() });
  } finally {
    clearAccessToken();
    setSelectedOrganizationId(null);
  }
}
