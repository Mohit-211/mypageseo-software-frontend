/**
 * Staff session state: the stored admin token and the signed-in staff member.
 * The token can't be renewed, so it is dropped the moment it expires.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AUDIT_PERMISSION, clearStaffToken, getStaffMe, getStaffToken, getTokenExpiry, subscribeToStaffToken } from "@/api";

/** Browsers fire a setTimeout longer than this (~24.8 days) immediately. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/** The valid staff token, or null. Re-renders on sign-in, sign-out and expiry. */
export function useStaffToken(): string | null {
  const token = useSyncExternalStore(subscribeToStaffToken, getStaffToken, () => null);
  useEffect(() => {
    if (!token) return;
    const expiry = getTokenExpiry(token);
    if (expiry === null) return;
    const timer = window.setTimeout(clearStaffToken, Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMEOUT_MS));
    return () => window.clearTimeout(timer);
  }, [token]);
  return token;
}

/** The signed-in staff member (`GET /admin/auth/me`), keyed by token so a new sign-in refetches. */
export function useStaffMe(token: string | null) {
  return useQuery({
    queryKey: ["staff", "me", token],
    queryFn: ({ signal }) => getStaffMe(signal),
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function canRunAudits(permissions: string[] | undefined): boolean {
  return Boolean(permissions?.includes(AUDIT_PERMISSION));
}

export type StaffRedirectState = { from?: string };
