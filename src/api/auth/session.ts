import { ApiError } from "../client";
import { setAuthTokens } from "../token-storage";
import { setSelectedOrganizationId } from "../organization-storage";
import type { AuthTokens } from "../types/auth";

/**
 * Stores a session's token pair. `remember` keeps it across browser restarts;
 * leave it undefined to keep wherever the current session already lives.
 */
export function storeSessionTokens(tokens: AuthTokens | undefined, remember: boolean | undefined, details?: unknown) {
  if (!tokens?.access?.token) {
    throw new ApiError("The sign-in response did not include an access token.", 500, { details });
  }
  const pair = { access: tokens.access.token, refresh: tokens.refresh?.token };
  if (remember === undefined) setAuthTokens(pair);
  else setAuthTokens(pair, remember);
}

/** A fresh sign-in (login, verification, invitation): stores the tokens and starts in the default organization. */
export function startSession(tokens: AuthTokens | undefined, remember: boolean, details?: unknown) {
  storeSessionTokens(tokens, remember, details);
  setSelectedOrganizationId(null);
}
