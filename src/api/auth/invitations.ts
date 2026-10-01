import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { InvitationAcceptResult, InvitationInfo } from "../types/auth";
import { startSession } from "./session";

/** 404 unknown token; 410 `{ reason: expired | revoked | accepted }`. */
export async function inspectInvitation(token: string): Promise<InvitationInfo> {
  return unwrapData(await api.post(ENDPOINTS.auth.inspectInvitation, { token }, { auth: false }));
}

/**
 * New email: `{ token, name, password }` creates a verified account and signs in.
 * Existing account: `{ token }` adds the membership; the user then logs in.
 * 400 `account_details_required`.
 */
export async function acceptInvitation(body: {
  token: string;
  name?: string;
  password?: string;
}): Promise<InvitationAcceptResult> {
  const result = unwrapData<InvitationAcceptResult>(await api.post(ENDPOINTS.auth.acceptInvitation, body, { auth: false }));
  if (!result.login_required) startSession(result.tokens, false, result);
  return result;
}
