import { useSyncExternalStore } from "react";
import { isApiError } from "@/api/client";

/**
 * Account restrictions seen on any call: 403 `organization_suspended` or 402
 * `subscription_required`. A short-lived hint that shows the state the moment a
 * refusal arrives: noting one also makes `GET organization/usage` re-read
 * (app/query-client.ts), and a fresh answer that the account is open clears it
 * (`useOrganizationUsage`). A 402 can come from an account that isn't read-only
 * (e.g. a trial's location allowance used up), so the hint must not outlive that answer.
 */
export type AccountRestriction = "suspended" | "read_only" | null;

/** The part of `GET organization/usage`'s `billing` block that says whether the account is restricted. */
export type AccountBillingState = { state?: string | null; read_only?: boolean | null } | null | undefined;

/**
 * The account's restriction from the usage billing state plus a refusal seen since. One rule
 * for the shell banner, `useWriteBlock` and `useAiStatus`, so they always agree.
 */
export function resolveAccountRestriction(billing: AccountBillingState, seen: AccountRestriction): AccountRestriction {
  if (billing?.state === "suspended_by_admin" || seen === "suspended") return "suspended";
  if (billing?.state === "inactive" || billing?.read_only || seen === "read_only") return "read_only";
  return null;
}

let restriction: AccountRestriction = null;
const listeners = new Set<() => void>();

export function noteAccountError(error: unknown) {
  if (!isApiError(error)) return;
  const next: AccountRestriction =
    error.reason === "organization_suspended" ? "suspended" : error.reason === "subscription_required" ? "read_only" : null;
  if (!next || next === restriction || restriction === "suspended") return;
  restriction = next;
  for (const listener of listeners) listener();
}

/**
 * Forgets the refusal seen. Called when the organization changes or another user's session
 * replaces this one (app/query-client.ts), on sign-out (WorkspaceProvider), and when a fresh
 * `GET organization/usage` says the account is open (`useOrganizationUsage`).
 */
export function resetAccountRestriction() {
  if (restriction === null) return;
  restriction = null;
  for (const listener of listeners) listener();
}

/** The refusal seen, outside React (see `useAccountRestriction`). */
export function getAccountRestriction(): AccountRestriction {
  return restriction;
}

/** Calls `listener` when the refusal seen changes (noted or forgotten). */
export function subscribeToAccountRestriction(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccountRestriction(): AccountRestriction {
  return useSyncExternalStore(subscribeToAccountRestriction, getAccountRestriction);
}
