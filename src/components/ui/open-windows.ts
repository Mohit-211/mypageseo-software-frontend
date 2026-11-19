/**
 * The app's windows (dialogs, alert dialogs, sheets, the phone navigation and the search) and the toasts drawn above
 * them (sonner's `[data-sonner-toaster]`, above every window).
 *
 * - Each window counts itself while it is open (`useWindowOnScreen`, through `WindowOnScreen` in ui/dialog.tsx,
 *   rendered inside its Radix `Content`, which is mounted only while the window is open or closing). Read by what
 *   must not act over an open window: a toast with a button waits while one is open and a toast without buttons lets
 *   presses through (ui/toast-hold.ts, ui/sonner.tsx); "Open it" on a post's toast never opens over a window
 *   (lib/posts/open-post.ts).
 * - Windows that hold nothing to lose (the phone navigation, the search) give way: `closeWindowsThatGiveWay` closes
 *   them for "Open it", which then goes on.
 * - `keepOpenOnToasts`: a press or focus on a toast never closes the window under it (and with it, e.g., a post's
 *   unsaved changes).
 */
import { useEffect, useLayoutEffect, useRef } from "react";

/** The open windows, each with how to close it when it gives way (null: it doesn't). */
const windows = new Set<{ giveWay: (() => void) | null }>();
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

/** Whether a window is open now. */
export function windowOnScreen(): boolean {
  return windows.size > 0;
}

/**
 * When every open window gives way (`onGiveWay`), closes them and returns true; otherwise closes nothing and returns
 * false (a dialog, an alert or a sheet may hold what was typed).
 */
export function closeWindowsThatGiveWay(): boolean {
  const open = [...windows];
  if (open.length === 0 || open.some((entry) => entry.giveWay === null)) return false;
  for (const entry of open) entry.giveWay?.();
  return true;
}

/** Calls `listener` whenever a window opens or closes. */
export function subscribeToWindows(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Counts the window it is called in while it is mounted: call it from a component inside the window's Radix
 * `Content`. `onGiveWay` closes a window that holds nothing to lose (see `closeWindowsThatGiveWay`).
 */
export function useWindowOnScreen(onGiveWay?: () => void): void {
  const latest = useRef(onGiveWay);
  useLayoutEffect(() => {
    latest.current = onGiveWay;
  });
  const givesWay = onGiveWay !== undefined;
  useEffect(() => {
    const entry = { giveWay: givesWay ? () => latest.current?.() : null };
    windows.add(entry);
    changed();
    return () => {
      windows.delete(entry);
      changed();
    };
  }, [givesWay]);
}

/** True for an event target inside a toast. */
export function inToast(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-sonner-toaster]") !== null;
}

/**
 * True for a press on a toast: inside one, or at its place (a toast without buttons lets presses through while a
 * window is open, ui/sonner.tsx, so the press lands on what is under it). For a mouse or pointer event, or Radix's
 * "outside" event that carries one.
 */
export function pressOnToast(event: Event): boolean {
  if (inToast(event.target)) return true;
  const detail: unknown = event instanceof CustomEvent ? event.detail : null;
  const press = event instanceof MouseEvent ? event : detail && typeof detail === "object" && "originalEvent" in detail ? detail.originalEvent : null;
  if (!(press instanceof MouseEvent)) return false;
  for (const toast of document.querySelectorAll("[data-sonner-toast]")) {
    const box = toast.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && press.clientX >= box.left && press.clientX <= box.right && press.clientY >= box.top && press.clientY <= box.bottom) return true;
  }
  return false;
}

/**
 * An "outside" press or focus that is on a toast leaves the window open: a click on a toast's button or close button,
 * or on a toast without buttons over the backdrop, never closes the dialog or sheet under it. The caller's own handler
 * runs first, as Radix composes its own after it. For `onPointerDownOutside` and `onInteractOutside` of a Radix
 * dialog's content.
 */
export function keepOpenOnToasts<E extends Event>(handler: ((event: E) => void) | undefined): (event: E) => void {
  return (event) => {
    handler?.(event);
    if (pressOnToast(event)) event.preventDefault();
  };
}
