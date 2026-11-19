/**
 * The router, for code that runs outside the routes or after the page that set it up is gone:
 * - `appNavigate`: a toast's action (the Toaster is app-wide, outside the routes, and a toast outlives the page that
 *   showed it), e.g. "Open it" on a post's toast. A page's own `useNavigate` belongs to that page.
 * - `appPathname`: the page on screen, as the router has it. The browser's address can differ for a moment: a Back
 *   that a leave question holds changes it until the router puts it back, while the page stays (ui/focus-return.ts).
 *
 * The router registers itself here (router.tsx), as it does for preloading (app/route-preload.ts): this file imports
 * nothing from the app, so it makes no import cycle.
 */

/** The parts of the router this file uses. */
type AppRouter = {
  navigate: (to: string) => Promise<void>;
  readonly state: { readonly location: { readonly pathname: string } };
};

let router: AppRouter | null = null;

export function registerAppRouter(next: AppRouter): void {
  router = next;
}

/** Goes to `to` (an address in the app) as a link does: a new history entry, without reloading the page. */
export function appNavigate(to: string): void {
  if (router) void router.navigate(to);
  else window.location.assign(to);
}

/** The path of the page on screen (the router's; the browser's before the router is set up). */
export function appPathname(): string {
  return router?.state.location.pathname ?? window.location.pathname;
}
