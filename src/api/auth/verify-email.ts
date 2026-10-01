import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { VerifyEmailResult } from "../types/auth";
import { storeSessionTokens } from "./session";

/**
 * Confirms the email from the link's token. The first time it signs the user in
 * (the tokens are stored); a used link answers `already_verified` without tokens.
 * 400 `link_expired` / `link_invalid`.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const result = unwrapData<VerifyEmailResult>(await api.post(ENDPOINTS.auth.verifyEmail, { token }, { auth: false }));
  if (!result.already_verified) storeSessionTokens(result.tokens, true, result);
  return result;
}

/** Sends a new verification link. Same answer for every email; 429 `rate_limited`. */
export async function resendVerification(email: string): Promise<{ email_verification: string }> {
  return unwrapData(await api.post(ENDPOINTS.auth.resendVerification, { email }, { auth: false }));
}
