/**
 * The app's windows (dialogs, alert dialogs, sheets, the phone navigation and the search) and the toasts drawn above
 * them (sonner's `[data-sonner-toaster]`, above every window).
 *
 * - Each window counts itself while it is open (`useWindowOnScreen`, through `WindowOnScreen` in ui/dialog.tsx,
 *   rendered inside its Radix `Content`, which is mounted only while the window is open or closing). Read by what
 *   must not act over an open window: a press on a toast keeps the focus in the window (ui/sonner.tsx); "Open it" on a
 *   post's toast never opens over a window, and a sticky post toast steps aside while one is open, so it never
 *   covers the window's buttons (lib/posts/open-post.ts).
 * - `keepOpenOnToasts`: a press or focus on a toast never closes the window under it (and with it, e.g., a post's
 *   unsaved changes).
 */
import { useEffect } from "react";

let windows = 0;
const listeners = new Set<() => void>();

function count(by: 1 | -1): void {
  windows += by;
  for (const listener of listeners) listener();
}

/** Whether a window is open now. */
export function windowOnScreen(): boolean {
  return windows > 0;
}

/** Calls `listener` whenever a window opens or closes. */
export function subscribeToWindows(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Counts the window it is called in while it is mounted: call it from a component inside the window's Radix `Content`. */
export function useWindowOnScreen(): void {
  useEffect(() => {
    count(1);
    return () => count(-1);
  }, []);
}

/** True for an event target inside a toast. */
export function inToast(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-sonner-toaster]") !== null;
}

/**
 * An "outside" press or focus that is on a toast leaves the window open: a click on a toast's button or close button
 * never closes the dialog or sheet under it. The caller's own handler runs first, as Radix composes its own after it.
 * For `onPointerDownOutside` and `onInteractOutside` of a Radix dialog's content.
 */
export function keepOpenOnToasts<E extends Event>(handler: ((event: E) => void) | undefined): (event: E) => void {
  return (event) => {
    handler?.(event);
    if (inToast(event.target)) event.preventDefault();
  };
}
