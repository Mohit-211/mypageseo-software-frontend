import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import { clearAccessToken } from "../token-storage";
import type { ResetPasswordRequest } from "../types/auth";

/**
 * Sets a new password from the reset link's token. Every session ends, including
 * one open in this browser. 400 `link_expired` / `link_invalid` /
 * `passwords_do_not_match`, or the broken password rule.
 */
export async function resetPassword(payload: ResetPasswordRequest): Promise<{ reset: boolean }> {
  const result = unwrapData<{ reset: boolean }>(await api.post(ENDPOINTS.auth.resetPassword, payload, { auth: false }));
  clearAccessToken();
  return result;
}
