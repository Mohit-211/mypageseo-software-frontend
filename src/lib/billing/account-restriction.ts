import { useSyncExternalStore } from "react";
import { isApiError } from "@/api/client";

/**
 * Account restrictions seen on any call: 403 `organization_suspended` or 402
 * `subscription_required`. Lets the banner show them to users who can't read
 * billing (a client_user) and right after the state changes.
 */
export type AccountRestriction = "suspended" | "read_only" | null;

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

/** Cleared on organization switch and sign-out. */
export function resetAccountRestriction() {
  if (restriction === null) return;
  restriction = null;
  for (const listener of listeners) listener();
}

export function useAccountRestriction(): AccountRestriction {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => restriction,
  );
}
