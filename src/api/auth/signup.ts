import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import { setAccessToken } from "../token-storage";
import type { SignupRequest, SignupResponse } from "../types/auth";

/** Creates a Business or Agency account, storing the token if the backend signs the user in. */
export async function signup(payload: SignupRequest): Promise<SignupResponse> {
  const response = await api.post<SignupResponse>(ENDPOINTS.auth.signup, payload, { auth: false });
  if (response?.accessToken) setAccessToken(response.accessToken);
  return response;
}
