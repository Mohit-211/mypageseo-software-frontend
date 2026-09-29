/**
 * Route guards driven by the stored access token (see ./auth-session.ts).
 *
 * - `RequireAuth` wraps signed-in pages: no token (or an expired one) sends the
 *   user to /login, remembering where they were headed.
 * - `GuestOnly` wraps Sign In / Sign Up: an already signed-in user goes straight
 *   into the app without hitting the login API again.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getPostLoginPath, useIsAuthenticated, type AuthRedirectState } from "./auth-session";

export function RequireAuth() {
  const authenticated = useIsAuthenticated();
  const location = useLocation();

  if (!authenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies AuthRedirectState} />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  const authenticated = useIsAuthenticated();
  const location = useLocation();
  if (authenticated) return <Navigate to={getPostLoginPath(location.state)} replace />;
  return <Outlet />;
}
