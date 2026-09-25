import { ApiError, api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { setAuthTokens } from "../token-storage";
import type { LoginRequest, LoginResponse } from "../types/auth";

/** Signs in with email and password and stores the access and refresh tokens. */
export async function login({ rememberMe, ...credentials }: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(ENDPOINTS.auth.login, credentials, {
    auth: false,
    headers: {
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  const tokens = response?.data?.tokens;
  if (!tokens?.access?.token) {
    throw new ApiError("Sign-in response did not include an access token.", 500, { details: response });
  }
  setAuthTokens({ access: tokens.access.token, refresh: tokens.refresh?.token }, rememberMe ?? false);
  return response;
}
