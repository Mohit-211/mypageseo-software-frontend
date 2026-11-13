import { API_TIMEOUT_MS } from "../config";

/**
 * One lock for everything that uses or replaces the stored refresh token
 * (renewing the session, signing out), shared by every tab of the app.
 *
 * The backend rotates refresh tokens: each one works once. With the session in
 * localStorage, tabs share the token, so two tabs renewing at the same moment
 * would send the same token and the second would be refused. Holding this lock
 * makes them take turns (see ./refresh-token.ts for what each turn checks).
 */
const LOCK_NAME = "mypageseo-auth-refresh";

/**
 * The longest wait for another tab's turn: its work is one API call (capped by
 * the request timeout). Past that we go ahead anyway rather than leave requests
 * hanging behind a lock that should already be free.
 */
const LOCK_WAIT_MS = API_TIMEOUT_MS + 10_000;

/** Without Web Locks (older browsers, plain-http origins): this tab's turns still run one at a time. */
let tabQueue: Promise<unknown> = Promise.resolve();

function inTabTurn<T>(task: () => Promise<T>): Promise<T> {
  const run = tabQueue.then(task, task);
  tabQueue = run.catch(() => undefined);
  return run;
}

/** Runs `task` while holding the cross-tab auth lock and resolves with its result. */
export function withAuthLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks || typeof locks.request !== "function") return inTabTurn(task);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOCK_WAIT_MS);
  let started = false;
  const locked = locks.request(LOCK_NAME, { mode: "exclusive", signal: controller.signal }, () => {
    clearTimeout(timer);
    started = true;
    return task();
  }) as Promise<T>;
  return locked.catch((error: unknown) => {
    clearTimeout(timer);
    // The task failed: that is its own error to report.
    if (started) throw error;
    // The lock never came (waited too long, or the browser refused it): run in this tab's queue instead.
    return inTabTurn(task);
  });
}
