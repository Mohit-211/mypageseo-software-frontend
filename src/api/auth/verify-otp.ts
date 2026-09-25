import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { VerifyOtpRequest, VerifyOtpResponse } from "../types/auth";

/**
 * Confirms a new account using the one-time code emailed after register.
 * A wrong or expired code rejects with an `ApiError`.
 */
export function verifyOtp(payload: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return api.post<VerifyOtpResponse>(ENDPOINTS.auth.verifyOtp, payload, { auth: false });
}
