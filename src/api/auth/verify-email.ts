// api/auth/verifyEmail.ts
import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { VerifyEmailRequest, VerifyEmailResponse } from "../types/auth";

/**
 * Confirms a new account using the token from the verification link
 * emailed after register. An invalid or expired token rejects with an `ApiError`.
 */
export function verifyEmail(payload: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  return api.post<VerifyEmailResponse>(ENDPOINTS.auth.verifyEmail, payload, { auth: false });
}