/**
 * The location add that answered 402 `location_payment_required`, kept across the
 * PayPal redirect so the billing page can retry it after capturing the order.
 */
export type PendingLocationAction =
  | { kind: "bind"; pickId: string; title: string; clientId?: string }
  | { kind: "add"; placeId: string; title: string; clientId?: string };

const KEY = "mypageseo.pending-location-payment";
/** A retry older than this is dropped (the user abandoned the payment). */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function savePendingLocationAction(action: PendingLocationAction) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ action, savedAt: Date.now() }));
  } catch {
    // Without storage the user presses Bind / Add again after paying.
  }
}

/** Returns and forgets the pending action. */
export function takePendingLocationAction(): PendingLocationAction | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { action?: PendingLocationAction; savedAt?: number };
    if (!parsed.action || !parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.action;
  } catch {
    return null;
  }
}
