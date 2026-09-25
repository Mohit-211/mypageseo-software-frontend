import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { MessageResponse, ResetPasswordRequest } from "../types/auth";

/** Sets a new password using the token from the reset link. */
export function resetPassword(payload: ResetPasswordRequest): Promise<MessageResponse> {
  return api.post<MessageResponse>(ENDPOINTS.auth.resetPassword, payload, { auth: false });
}
