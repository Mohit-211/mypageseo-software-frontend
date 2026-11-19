/**
 * Toasts over open windows (ui/open-windows.ts: dialogs, alerts, sheets, the phone navigation, the search): a toast
 * never takes a press meant for a window, at any width, with a mouse or a finger.
 *
 * - A toast with a button (an action such as "Open it" or "Try again", or a close button) waits while a window is
 *   open: one on screen steps aside when a window opens, and one that arrives meanwhile isn't shown. Once every window
 *   is closed, each comes back once, for its full time. Nothing is lost and nothing shows twice.
 * - A toast without buttons still shows over the window, and presses go through it to the window (ui/sonner.tsx).
 *
 * A waiting toast moves to a toaster that isn't on screen (sonner's `toasterId`): sonner keeps it as it is, runs no
 * clock for it and calls none of its callbacks; it comes back by moving again. One made while a window is open goes
 * there at once (sonner's toast functions are wrapped here, as every toast in the app goes through them), so it is
 * never drawn, not even hidden. `toast.dismiss` is wrapped too: it moves a waiting toast back first, so sonner removes
 * it for good (a toast no Toaster shows is never removed, and a later one with its id would merge into it unseen).
 */
import { useEffect, useSyncExternalStore } from "react";
import { toast, useSonner, type ExternalToast, type ToastT } from "sonner";
import { subscribeToWindows, windowOnScreen } from "./open-windows";

/** The toaster of the waiting toasts: no Toaster shows it. */
const WAITING = "waiting-for-windows";

const hasButton = (item: ExternalToast) => Boolean(item.action || item.cancel || item.closeButton);

/** A toast with a button made while a window is open waits from the start (an explicit `toasterId` is left alone). */
function waitIfWindowOpen(data: ExternalToast | undefined): ExternalToast | undefined {
  return data && !("toasterId" in data) && hasButton(data) && windowOnScreen() ? { ...data, toasterId: WAITING } : data;
}

// Sonner's own functions, kept once (a hot reload of this file must not wrap them twice).
const ORIGINALS = Symbol.for("mypageseo.toast-hold");
const NAMES = ["success", "info", "warning", "error", "message", "loading"] as const;
const store = toast as typeof toast & { [ORIGINALS]?: Pick<typeof toast, (typeof NAMES)[number]> & Partial<Pick<typeof toast, "dismiss">> };
const originals = (store[ORIGINALS] ??= { success: toast.success, info: toast.info, warning: toast.warning, error: toast.error, message: toast.message, loading: toast.loading });
for (const name of NAMES) {
  const original = originals[name];
  toast[name] = (message, data) => original(message, waitIfWindowOpen(data));
}
const originalDismiss = (originals.dismiss ??= toast.dismiss);
toast.dismiss = (id) => {
  // Out of sight while sonner removes it (it would fade out on screen if the windows closed meanwhile).
  for (const item of current()) if (item.toasterId === WAITING && (id === undefined || item.id === id)) move(item, undefined, { style: { ...item.style, display: "none" } });
  return originalDismiss(id);
};

/** The toasts sonner has now and hasn't closed, oldest first (its own record, ahead of what a Toaster shows). */
function current(): ToastT[] {
  return toast.getToasts().filter((item): item is ToastT => !("dismiss" in item));
}

/** Moves a toast to another toaster (undefined: the one on screen), keeping everything else about it (but `extra`). */
function move(item: ToastT, toasterId: string | undefined, extra: ExternalToast = {}): void {
  const data = { id: item.id, toasterId, dismissible: item.dismissible, ...extra };
  switch (item.type) {
    case "success":
    case "info":
    case "warning":
    case "error":
    case "loading":
      toast[item.type](item.title, data);
      return;
    default:
      toast.message(item.title, data);
  }
}

/**
 * For the Toaster: while a window is open, its toasts with a button wait; once every window is closed (not one
 * handing over to the next, nor React's second mount in development), they come back. Returns whether a window is
 * open, for the toasts' look.
 */
export function useToastsWaitForWindows(): boolean {
  const windowOpen = useSyncExternalStore(subscribeToWindows, windowOnScreen, () => false);
  // A new or changed toast runs the effect again.
  const { toasts } = useSonner();
  useEffect(() => {
    if (windowOpen) {
      for (const item of current()) if (!item.toasterId && hasButton(item)) move(item, WAITING);
      return undefined;
    }
    const timer = setTimeout(() => {
      if (windowOnScreen()) return;
      for (const item of current()) if (item.toasterId === WAITING) move(item, undefined);
    }, 0);
    return () => clearTimeout(timer);
  }, [windowOpen, toasts]);
  return windowOpen;
}

/** Closes a toast for good, waiting or not (`toast.dismiss` does the same; see the file comment). */
export function dismissToast(id: string | number): void {
  toast.dismiss(id);
}
