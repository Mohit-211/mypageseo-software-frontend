import { useEffect, useState } from "react";
import { isApiError } from "@/api";
import { useAccess } from "@/hooks/use-access";

/** Every client query (list, detail, the workspace switcher) sits under this prefix. */
export const CLIENTS_KEY = ["clients"] as const;

/** Phase 21 refusals for a member limited to its clients, plus the usual client errors. */
export function clientErrorText(err: unknown, fallback: string): string {
  if (!isApiError(err)) return fallback;
  switch (err.reason) {
    case "client_required":
      return "Choose one of your clients for this location.";
    case "client_not_assigned":
      return "That client isn't one of yours. Choose one of your clients.";
    case "assigned_clients_only":
      return "The account owner creates and deletes clients. You work on the clients assigned to you.";
    case "agency_only":
      return "Clients are for agency accounts.";
    default:
      return err.status === 400 && err.message ? err.message : fallback;
  }
}

/**
 * A member limited to its clients must put every location under one of them
 * (400 `client_required` otherwise), so its client picker has no "No client".
 */
export function useClientRequired(): boolean {
  const access = useAccess();
  return access.role === "member" && access.restricted;
}

/** `value` once it has stopped changing for `ms` (a search box), so each keystroke doesn't send a request. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Retry only failures that may pass on a second try; a 404 (a deleted client) is an answer. */
export function retryUnlessClientError(count: number, err: unknown): boolean {
  return !(isApiError(err) && err.status < 500) && count < 2;
}
