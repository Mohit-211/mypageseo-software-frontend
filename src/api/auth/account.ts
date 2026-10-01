import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import { clearAccessToken } from "../token-storage";
import type { AuthTokens } from "../types/auth";
import { storeSessionTokens } from "./session";

/**
 * Changes the password while signed in. Every other session ends; this one continues
 * with the returned tokens. 400 `wrong_password` / `same_password`, or the password rule.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const result = unwrapData<{ tokens: AuthTokens }>(
    await api.post(ENDPOINTS.auth.changePassword, { current_password: currentPassword, new_password: newPassword }),
  );
  // Keep the session where it already lives ("Remember me" or this tab only).
  storeSessionTokens(result.tokens, undefined, result);
}

/** Deletes the account (Google accounts disconnected, memberships ended). 400 `wrong_password`. */
export async function deactivateAccount(password: string): Promise<void> {
  await api.post(ENDPOINTS.auth.deactivate, { password });
  clearAccessToken();
}
