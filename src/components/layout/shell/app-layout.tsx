import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { preloadAppRoutes } from "@/app/route-preload";
import { AccountStateBanner } from "@/components/layout/shared/account-state-banner";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { getPageTitleSnapshot, subscribeToPageTitle } from "@/hooks/use-document-title";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

/**
 * Tells screen readers which page opened after a page change (not on the first load, and not when
 * only filters or the `#section` change): the page's name, as soon as the page has set its title
 * (`useDocumentTitle`, called by every PageHeader).
 */
function RouteAnnouncer({ pathname }: { pathname: string }) {
  const page = useSyncExternalStore(subscribeToPageTitle, getPageTitleSnapshot, getPageTitleSnapshot);
  const [state, setState] = useState(() => ({ pathname, version: page.version, waiting: false, message: "" }));
  // A new path waits for the next title its page sets; that title is then said once.
  let next = state;
  if (next.pathname !== pathname) next = { ...next, pathname, version: page.version, waiting: true };
  if (next.waiting && page.version !== next.version) next = { ...next, version: page.version, waiting: false, message: page.title };
  if (next !== state) setState(next);
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {next.message}
    </p>
  );
}

/** Focus inside a dialog or menu that is closing (the mobile menu after a link was picked). */
const CLOSING_LAYER = '[role="dialog"][data-state="closed"], [role="alertdialog"][data-state="closed"], [role="menu"][data-state="closed"]';

/**
 * After a page change that took keyboard focus away (the link was in the old page, or in the
 * mobile menu that closes), focus goes to the new page's heading, as a page load would put the
 * reader at the top of the page: the next Tab reaches the page, not the skip link. Focus that is
 * still somewhere useful (the sidebar link just used) stays there.
 */
function focusNewPage(): void {
  const active = document.activeElement;
  const lost = !active || active === document.body || !active.isConnected || active.closest(CLOSING_LAYER) !== null;
  if (!lost) return;
  const main = document.getElementById("main-content");
  const heading = main?.querySelector<HTMLElement>("[data-page-header] h1");
  (heading ?? main)?.focus({ preventScroll: true });
}

/**
 * The persistent signed-in frame (sidebar, header, page area). The router renders it once, so it
 * never unmounts between pages; pages render into its outlet. Before the first page's code has
 * arrived (it is also the route's `HydrateFallback`) the page area shows a skeleton, so the frame
 * appears at once instead of a blank screen.
 */
export function AppLayout() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  // The drawer belongs to the page it was opened on: any navigation closes it, no effect needed. It is forgotten
  // then, so coming back to that page (Back, "Open it" on a toast) never opens it again by itself.
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  if (drawerFor !== null && drawerFor !== pathname) setDrawerFor(null);
  const drawerOpen = drawerFor === pathname;
  const preloadStarted = useRef(false);
  const shownPath = useRef<string | null>(null);

  useEffect(() => {
    if (preloadStarted.current) return;
    preloadStarted.current = true;
    // Downloads the other pages' code at idle time, so later clicks don't wait on the network.
    preloadAppRoutes();
  }, []);

  useEffect(() => {
    // Only a change of page: not the first one shown, nor a filter or `#section` change.
    const previous = shownPath.current;
    shownPath.current = pathname;
    if (previous !== null && previous !== pathname) focusNewPage();
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    // Widening the window past the drawer breakpoint hands over to the desktop sidebar.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (wide.matches) setDrawerFor(null);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-raised"
      >
        Skip to main content
      </a>
      <RouteAnnouncer pathname={pathname} />
      {/* Stays in place while the page scrolls; the menu scrolls on its own when it's long. */}
      <Sidebar className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:flex" />
      <MobileNav open={drawerOpen} onOpenChange={(open) => setDrawerFor(open ? pathname : null)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header navOpen={drawerOpen} onOpenNav={() => setDrawerFor(pathname)} />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
            <AccountStateBanner />
            {outlet ?? <PageSkeleton />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
