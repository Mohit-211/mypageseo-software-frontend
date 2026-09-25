import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AuthUser } from "../types/auth";

/** Returns the signed-in user. Rejects with a 401 `ApiError` when signed out. */
export function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  return api.get<AuthUser>(ENDPOINTS.auth.me, signal ? { signal } : {});
}
