import { useRef, type FocusEvent } from "react";

type AutoFocusHandler = (event: Event) => void;
type FocusHandler = (event: FocusEvent<HTMLDivElement>) => void;

/** What opened each dialog that is on screen (keyed by its content element). */
const openers = new WeakMap<Element, HTMLElement | null>();

/**
 * The opener a dialog should return to, from what had focus as it opened. A menu item counts as
 * its menu's button (the menu closes with it), and a button in a dialog that is closing (a picker
 * handing over to the next step) counts as whatever opened that dialog.
 */
function openerFrom(focused: EventTarget | null): HTMLElement | null {
  let element = focused instanceof HTMLElement ? focused : null;
  const menu = element?.closest('[role="menu"]');
  if (menu) element = document.getElementById(menu.getAttribute("aria-labelledby") ?? "") ?? element;
  const dialog = element?.closest('[role="dialog"], [role="alertdialog"]');
  if (dialog && dialog.getAttribute("data-state") === "closed" && openers.has(dialog)) element = openers.get(dialog) ?? null;
  return element && element !== document.body ? element : null;
}

/**
 * Where focus goes when nothing that opened the dialog is left to return to: the page's heading,
 * the same place the shell puts it after a page change (AppLayout), else the page area. Null
 * outside the signed-in shell, where Radix's own handling stays.
 */
function pageHeading(): HTMLElement | null {
  const main = document.getElementById("main-content");
  return main?.querySelector<HTMLElement>("[data-page-header] h1") ?? main;
}

/**
 * Focus return for dialogs, sheets and drawers. Radix only returns focus to a `*Trigger`, and almost
 * every dialog here opens from state or the URL without one, so on close focus fell to <body> and
 * keyboard and screen-reader users restarted at the top of the page. This remembers what had focus
 * when the dialog opened and focuses it again on close. A dialog opened by arriving on its address
 * (`?new=1`, `?keyword=`…) has no opener, or one from the page before that is gone: its focus goes
 * to the page's heading instead, so the next Tab continues in the page.
 *
 * It stays out of the way when the caller's own `onCloseAutoFocus` prevented the default, when the
 * page changed while the dialog was open (a link inside it: the page's own focus handling wins), and
 * when focus has already moved somewhere on purpose (e.g. into another dialog). Pass the caller's
 * handlers in; spread the returned ones onto the Radix `Content`.
 */
export function useFocusReturn({
  onOpenAutoFocus,
  onCloseAutoFocus,
  onFocusCapture,
}: {
  onOpenAutoFocus?: AutoFocusHandler | undefined;
  onCloseAutoFocus?: AutoFocusHandler | undefined;
  onFocusCapture?: FocusHandler | undefined;
}) {
  const opened = useRef<{ opener: HTMLElement | null; pathname: string } | null>(null);
  const remember = (content: EventTarget | null, opener: HTMLElement | null) => {
    opened.current = { opener, pathname: window.location.pathname };
    if (content instanceof Element) openers.set(content, opener);
  };
  return {
    onOpenAutoFocus: (event: Event) => {
      // Radix dispatches this on the dialog's content element.
      remember(event.currentTarget, openerFrom(document.activeElement));
      onOpenAutoFocus?.(event);
    },
    onFocusCapture: (event: FocusEvent<HTMLDivElement>) => {
      onFocusCapture?.(event);
      // A field with `autoFocus` takes focus as the dialog mounts, and Radix then skips the open
      // event above: the opener is where that first focus came from.
      if (opened.current) return;
      const from = event.relatedTarget;
      remember(event.currentTarget, from instanceof Node && event.currentTarget.contains(from) ? null : openerFrom(from));
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const from = opened.current;
      opened.current = null;
      if (event.defaultPrevented) return;
      const active = document.activeElement;
      if ((from && from.pathname !== window.location.pathname) || (active && active !== document.body)) {
        // Leave focus where the new page or the next dialog put it (and keep Radix from moving it).
        event.preventDefault();
        return;
      }
      const target = from?.opener?.isConnected ? from.opener : pageHeading();
      if (!target) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}
