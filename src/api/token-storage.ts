/**
 * Auth-token storage: the short-lived access token and the long-lived refresh
 * token that renews it (see api/auth/refresh-token.ts).
 *
 * "Remember me" keeps both in `localStorage`; otherwise they live in
 * `sessionStorage` and are dropped when the tab closes. Storage access is
 * wrapped because it can throw in private windows or with site data blocked.
 *
 * Route guards subscribe to changes (see lib/auth-lib/auth-session.ts), so
 * setting or clearing tokens re-renders them straight away.
 */
const ACCESS_KEY = "mypageseo.auth.token";
const REFRESH_KEY = "mypageseo.auth.refresh";

/** Treat a token as expired slightly early so a request never leaves with a dying token. */
const EXPIRY_SKEW_MS = 10_000;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** Calls `listener` whenever tokens are set or cleared, in this tab or another one. */
export function subscribeToAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACCESS_KEY || event.key === REFRESH_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_KEY);
}

/** Whether the current session was stored with "Remember me". */
function isRemembered(): boolean {
  try {
    return window.localStorage.getItem(ACCESS_KEY) !== null || window.localStorage.getItem(REFRESH_KEY) !== null;
  } catch {
    return false;
  }
}

function clearStoredTokens() {
  try {
    for (const key of [ACCESS_KEY, REFRESH_KEY]) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Stores a new token pair. `remember` defaults to wherever the current session
 * lives, so a refresh keeps "Remember me" as the user chose it at sign-in.
 */
export function setAuthTokens(
  tokens: { access: string; refresh?: string | undefined },
  remember: boolean = isRemembered(),
) {
  const refresh = tokens.refresh ?? getRefreshToken();
  clearStoredTokens();
  try {
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem(ACCESS_KEY, tokens.access);
    if (refresh) storage.setItem(REFRESH_KEY, refresh);
  } catch {
    /* storage unavailable — the tokens only live for this request cycle */
  }
  notify();
}

/** Stores an access token on its own (e.g. a signup that signs the user in). */
export function setAccessToken(token: string, remember = false) {
  clearStoredTokens(); // a new sign-in must not inherit an older refresh token
  setAuthTokens({ access: token }, remember);
}

/** Signs the user out locally: drops both tokens. */
export function clearAccessToken() {
  clearStoredTokens();
  notify();
}

/**
 * Expiry time (ms since epoch) from a JWT's `exp` claim, or `null` when the
 * token isn't a JWT or carries no `exp`.
 */
export function getTokenExpiry(token: string): number | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * True when the token is past its `exp`. The backend always issues JWTs with
 * `exp`, so a token without a readable one is malformed and counts as expired.
 */
export function isTokenExpired(token: string, now = Date.now()): boolean {
  const expiry = getTokenExpiry(token);
  return expiry === null || now >= expiry - EXPIRY_SKEW_MS;
}

/** The stored access token if it hasn't expired. An expired one may still be renewed. */
export function getValidAccessToken(): string | null {
  const token = getAccessToken();
  return token && !isTokenExpired(token) ? token : null;
}

/** The stored refresh token if it hasn't expired. */
export function getValidRefreshToken(): string | null {
  const token = getRefreshToken();
  return token && !isTokenExpired(token) ? token : null;
}

/** Signed in: a live access token, or a live refresh token that can mint one. */
export function hasUsableSession(): boolean {
  return getValidAccessToken() !== null || getValidRefreshToken() !== null;
}
