import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AuthSession, LoginRequest } from "../types/auth";
import { startSession } from "./session";

/**
 * Signs in and stores the tokens. 401 wrong email or password; 403
 * `email_not_verified` / `account_disabled`; 429 `rate_limited`.
 */
export async function login({ rememberMe, ...credentials }: LoginRequest): Promise<AuthSession> {
  const session = unwrapData<AuthSession>(await api.post(ENDPOINTS.auth.login, credentials, { auth: false }));
  startSession(session?.tokens, rememberMe ?? false, session);
  return session;
}
