import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { SignupRequest, SignupResult } from "../types/auth";

/** Creates the account and emails a verification link. 409 `email_taken`; 400 with the password rule. */
export async function signup(payload: SignupRequest): Promise<SignupResult> {
  return unwrapData(await api.post(ENDPOINTS.auth.signup, payload, { auth: false }));
}
