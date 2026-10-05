/**
 * Staff dashboard API: admin sign-in and the sales audit (Phase 19).
 *
 * These routes take the staff (admin) token, never the customer one, so they
 * go out with `auth: false` and their own Authorization header. A 401 ends the
 * staff session (admin tokens aren't refreshed).
 */
import { ApiError, request, unwrapData, type RequestOptions } from "../client";
import type { Attribution } from "../types/locations";
import type { AuditPlaceSuggestion, SalesAudit, StaffAdmin } from "../types/staff";
import { clearStaffToken, getStaffToken, setStaffToken } from "./session";

export { clearStaffToken, getStaffToken, subscribeToStaffToken } from "./session";

/** Permission the sales audit needs. */
export const AUDIT_PERMISSION = "audits.run";

async function staffRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getStaffToken();
  try {
    return await request<T>(path, {
      ...options,
      auth: false,
      headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) clearStaffToken();
    throw error;
  }
}

export async function staffLogin(input: { email: string; password: string; remember: boolean }): Promise<StaffAdmin> {
  const data = unwrapData<{ admin: StaffAdmin; token: string }>(
    await request("admin/auth/login", { method: "POST", auth: false, body: { email: input.email, password: input.password } }),
  );
  setStaffToken(data.token, input.remember);
  return data.admin;
}

export async function getStaffMe(signal?: AbortSignal): Promise<StaffAdmin> {
  return unwrapData(await staffRequest("admin/auth/me", signal ? { signal } : {}));
}

export async function searchAuditPlaces(
  input: string,
  session: string,
  signal?: AbortSignal,
): Promise<{ suggestions: AuditPlaceSuggestion[]; attribution?: Attribution }> {
  return unwrapData(await staffRequest("staff/audits/places/autocomplete", { query: { input, session }, ...(signal ? { signal } : {}) }));
}

/** The caller's open audits, newest first, without results. */
export async function listSalesAudits(signal?: AbortSignal): Promise<SalesAudit[]> {
  const data = unwrapData<{ audits: SalesAudit[] }>(await staffRequest("staff/audits", signal ? { signal } : {}));
  return data.audits;
}

export async function startSalesAudit(input: { place_id: string; session?: string; keyword: string }): Promise<SalesAudit> {
  return unwrapData(await staffRequest("staff/audits", { method: "POST", body: input }));
}

export async function getSalesAudit(auditId: string, signal?: AbortSignal): Promise<SalesAudit> {
  return unwrapData(await staffRequest(`staff/audits/${encodeURIComponent(auditId)}`, signal ? { signal } : {}));
}

export async function downloadSalesAuditPdf(auditId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await staffRequest<Response>(`staff/audits/${encodeURIComponent(auditId)}/pdf`, { responseType: "blob", timeoutMs: 90_000 });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? `audit-${auditId}.pdf` };
}

export async function closeSalesAudit(auditId: string): Promise<void> {
  await staffRequest(`staff/audits/${encodeURIComponent(auditId)}`, { method: "DELETE" });
}

export function signOutStaff() {
  clearStaffToken();
}
