/**
 * Staff (platform admin) session token, kept apart from the customer session.
 *
 * Admin tokens last 12 hours and can't be refreshed: when one expires or is
 * rejected, the staff member signs in again. "Keep me signed in" stores it in
 * `localStorage`, otherwise `sessionStorage` (dropped when the tab closes).
 */
import { isTokenExpired } from "../token-storage";

const KEY = "mypageseo.staff.token";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToStaffToken(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The stored staff token if it hasn't expired. */
export function getStaffToken(): string | null {
  let token: string | null;
  try {
    token = window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  return token && !isTokenExpired(token) ? token : null;
}

export function setStaffToken(token: string, remember: boolean) {
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(KEY, token);
  } catch {
    // Storage blocked: the session can't be kept.
  }
  for (const listener of listeners) listener();
}

export function clearStaffToken() {
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  for (const listener of listeners) listener();
}
