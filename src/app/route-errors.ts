import { isRouteErrorResponse } from "react-router-dom";

/** A page's code file from an older release is gone after a deploy. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

const RELOAD_KEY = "mypageseo.chunk-reload";

/**
 * After a release the old page files are gone, so a stale-file error reloads the tab once to pick
 * up the new ones instead of showing an error. Only once per path: a second failure shows the
 * error, so a real outage can't loop. Without session storage we can't tell, so we don't reload.
 */
export function canReloadForStaleChunk(error: unknown): boolean {
  if (!isStaleChunkError(error)) return false;
  try {
    return sessionStorage.getItem(RELOAD_KEY) !== window.location.pathname;
  } catch {
    return false;
  }
}

/** Remembers the attempt (see `canReloadForStaleChunk`) and reloads. Call from an effect. */
export function reloadForStaleChunk(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, window.location.pathname);
  } catch {
    return;
  }
  window.location.reload();
}

/** A route error (thrown value, response or render error) as an Error for the error states. */
export function toRouteError(routeError: unknown): Error {
  if (routeError instanceof Error) return routeError;
  return new Error(isRouteErrorResponse(routeError) ? `${routeError.status} ${routeError.statusText}` : String(routeError));
}

/** True for a "no such page" route response (an unknown child path or a loader's 404). */
export function isNotFoundResponse(routeError: unknown): boolean {
  return isRouteErrorResponse(routeError) && routeError.status === 404;
}
