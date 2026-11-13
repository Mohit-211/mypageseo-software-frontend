/**
 * Route guards driven by the stored tokens (see ./auth-session.ts).
 *
 * - `RequireAuth` wraps signed-in pages: no usable session (or one that ends while a page is
 *   open, e.g. signing out) sends the user to /login, remembering where they were headed.
 * - `GuestOnly` wraps Sign In / Sign Up. A visitor who is already signed in is sent into the
 *   app by the route's loader (`guestOnlyLoader` in src/app/route-loaders.ts) before anything
 *   renders, and the login page navigates itself after a successful sign-in, so this component
 *   only renders the page: it never swaps the form for an empty screen.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useIsAuthenticated, type AuthRedirectState } from "./auth-session";

export function RequireAuth() {
  const authenticated = useIsAuthenticated();
  const location = useLocation();

  if (!authenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return (
      <>
        <Navigate to="/login" replace state={{ from } satisfies AuthRedirectState} />
        {/* Shown while the sign-in page's code loads, instead of an empty window. */}
        <div role="status" aria-label="Opening sign in" className="flex min-h-screen items-center justify-center bg-background">
          <span className="size-8 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none" />
        </div>
      </>
    );
  }
  return <Outlet />;
}

export function GuestOnly() {
  return <Outlet />;
}
