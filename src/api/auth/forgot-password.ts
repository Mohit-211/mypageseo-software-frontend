import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ForgotPasswordRequest, MessageResponse } from "../types/auth";

/**
 * Requests a password-reset email. The backend answers the same way for known
 * and unknown addresses, so the result never reveals whether an account exists.
 */
export function forgotPassword(payload: ForgotPasswordRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(ENDPOINTS.auth.forgotPassword, payload, { auth: false });
}
