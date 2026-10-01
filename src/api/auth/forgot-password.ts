import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";

/** Emails a reset link. The answer is the same whether or not the account exists. */
export async function forgotPassword(email: string): Promise<{ reset: string }> {
  return unwrapData(await api.post(ENDPOINTS.auth.forgotPassword, { email }, { auth: false }));
}
