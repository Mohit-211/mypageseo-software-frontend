/**
 * Route-code preloading, so a page's code is already downloaded when it is opened and the
 * click shows the page at once instead of waiting on the network.
 *
 * The router registers itself here (`registerRouter`, called from router.tsx) instead of this
 * file importing the router, which would make an import cycle with every page that preloads.
 * Each route's `lazy()` is the same `import()` the router calls, so a preloaded file is
 * fetched once; the router drops `lazy` once a route has loaded, which stops repeat calls.
 */
import { matchRoutes, type DataRouteObject } from "react-router-dom";

/** The parts of the router this file reads. */
type PreloadRouter = {
  readonly routes: DataRouteObject[];
  readonly state: { readonly initialized: boolean; readonly navigation: { readonly state: string } };
};

/** Id of the signed-in shell layout route in router.tsx: everything under it is preloaded at idle. */
export const APP_ROUTE_ID = "app";

let router: PreloadRouter | null = null;
/** Routes whose code is being (or has been) fetched by us. */
const started = new WeakSet<DataRouteObject>();
let idlePreloadStarted = false;

export function registerRouter(next: PreloadRouter): void {
  router = next;
}

/** Calls the route's own `lazy()` once. A failed download may be tried again later. */
function startLazy(route: DataRouteObject): Promise<void> {
  const lazy: unknown = route.lazy;
  if (typeof lazy !== "function" || started.has(route)) return Promise.resolve();
  started.add(route);
  try {
    return Promise.resolve((lazy as () => unknown)()).then(
      () => undefined,
      () => {
        started.delete(route);
      },
    );
  } catch {
    started.delete(route);
    return Promise.resolve();
  }
}

/**
 * Starts downloading the code of every route that `path` matches (call on hover, focus or
 * touch of a link). A no-op for routes already loaded; never throws.
 */
export function preloadPath(path: string): void {
  if (!router) return;
  try {
    const pathname = path.split(/[?#]/, 1)[0] || "/";
    for (const { route } of matchRoutes(router.routes, pathname) ?? []) void startLazy(route);
  } catch {
    // Preloading is an optimisation only.
  }
}

/** Every lazy route under `root`, parents before children (the order a page needs them). */
function lazyRoutesUnder(root: DataRouteObject): DataRouteObject[] {
  const found: DataRouteObject[] = [];
  const walk = (routes: DataRouteObject[] | undefined) => {
    for (const route of routes ?? []) {
      if (typeof route.lazy === "function") found.push(route);
      walk(route.children);
    }
  };
  walk(root.children);
  return found;
}

function findRoute(routes: DataRouteObject[], id: string): DataRouteObject | null {
  for (const route of routes) {
    if (route.id === id) return route;
    const child = findRoute(route.children ?? [], id);
    if (child) return child;
  }
  return null;
}

/** Data saver on, or a 2G connection: don't spend the user's bandwidth on pages they may not open. */
function connectionIsConstrained(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType ?? "");
}

function whenIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(callback, { timeout: 4_000 });
  else window.setTimeout(callback, 200);
}

/**
 * Downloads every signed-in page's code during idle time, one page at a time, so later clicks
 * never wait on the network (and an open tab keeps working after a release). Call once after the
 * app shell mounts; later calls do nothing. It pauses while a navigation is loading, and skips
 * entirely with Data Saver or on 2G.
 */
export function preloadAppRoutes(): void {
  if (idlePreloadStarted || typeof window === "undefined") return;
  idlePreloadStarted = true;
  if (connectionIsConstrained()) return;

  let queue: DataRouteObject[] | null = null;
  const next = () => {
    if (!router) return;
    // Never compete with the page the user is opening right now.
    if (!router.state.initialized || router.state.navigation.state !== "idle") {
      window.setTimeout(() => whenIdle(next), 500);
      return;
    }
    if (!queue) {
      const app = findRoute(router.routes, APP_ROUTE_ID);
      queue = app ? lazyRoutesUnder(app) : [];
    }
    const route = queue.shift();
    if (!route) return;
    void startLazy(route).finally(() => whenIdle(next));
  };
  whenIdle(next);
}
