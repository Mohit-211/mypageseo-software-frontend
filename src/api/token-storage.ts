/**
 * Auth-token storage: the short-lived access token and the long-lived refresh
 * token that renews it (see api/auth/refresh-token.ts).
 *
 * "Keep me signed in" (the default) keeps both in `localStorage`, so the session
 * survives closing the tab and is shared by every tab. Unchecked, they live in
 * `sessionStorage` and are dropped when the tab closes. Storage access is wrapped
 * because it can throw in private windows or with site data blocked.
 *
 * Route guards subscribe to changes (see lib/auth/auth-session.ts), so setting or
 * clearing tokens re-renders them straight away, in this tab and in the others.
 *
 * Expiry is judged on the backend's clock, not the device's: every new token's `iat`
 * says what time the backend had when it was issued, and the difference is kept
 * (see `serverNow`). A device clock a day or more off would otherwise make every
 * fresh token look expired, and the app would load nothing.
 */
const ACCESS_KEY = "mypageseo.auth.token";
const REFRESH_KEY = "mypageseo.auth.refresh";
/** Backend clock minus device clock, in ms; next to the tokens so every tab shares it. */
const CLOCK_OFFSET_KEY = "mypageseo.auth.clock-offset";

/** Treat a token as expired slightly early so a request never leaves with a dying token. */
const EXPIRY_SKEW_MS = 10_000;
/** Smaller differences are network delay and rounding (`iat` is in whole seconds), not a wrong clock. */
const CLOCK_TOLERANCE_MS = 60_000;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

function readStoredClockOffset(): number {
  try {
    const value = Number(window.localStorage.getItem(CLOCK_OFFSET_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

let clockOffset = readStoredClockOffset();

// Another tab measured the clock (it signed in or renewed): use its figure. Its tokens arrive in
// later storage events (the offset is written first), so they are judged with it.
window.addEventListener("storage", (event) => {
  if (event.key === CLOCK_OFFSET_KEY || event.key === null) clockOffset = readStoredClockOffset();
});

/**
 * Measures the device clock against the backend's from a token just issued (its `iat` is the
 * backend's time at issue). Only called with tokens fresh from the backend (see `writeTokens`).
 */
function measureClockOffset(access: string) {
  const issuedAt = readClaims(access)?.iat;
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) return;
  const measured = issuedAt * 1000 - Date.now();
  clockOffset = Math.abs(measured) < CLOCK_TOLERANCE_MS ? 0 : measured;
  try {
    if (clockOffset) window.localStorage.setItem(CLOCK_OFFSET_KEY, String(clockOffset));
    else window.localStorage.removeItem(CLOCK_OFFSET_KEY);
  } catch {
    /* storage unavailable — this tab still uses it */
  }
}

/** The backend's current time as best known (ms since epoch): the device clock, corrected. */
export function serverNow(): number {
  return Date.now() + clockOffset;
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

/** Where the current session lives: kept across restarts, this tab only, or nowhere (signed out). */
function storedIn(): "local" | "session" | null {
  try {
    const has = (storage: Storage) => storage.getItem(ACCESS_KEY) !== null || storage.getItem(REFRESH_KEY) !== null;
    if (has(window.localStorage)) return "local";
    if (has(window.sessionStorage)) return "session";
  } catch {
    /* storage unavailable */
  }
  return null;
}

function clearStoredTokens() {
  clockOffset = 0;
  try {
    for (const key of [ACCESS_KEY, REFRESH_KEY]) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }
    window.localStorage.removeItem(CLOCK_OFFSET_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Writes the pair into one storage and removes it from the other. The keys are
 * overwritten in place, never cleared first: other tabs re-read them on every
 * change, and a moment with no tokens at all would sign those tabs out.
 *
 * Only ever called with tokens the backend has just issued (sign-in, renewal,
 * invitation, email verification, password change), so it also measures the clock.
 */
function writeTokens(access: string, refresh: string | null, remember: boolean) {
  measureClockOffset(access);
  try {
    const target = remember ? window.localStorage : window.sessionStorage;
    const other = remember ? window.sessionStorage : window.localStorage;
    target.setItem(ACCESS_KEY, access);
    if (refresh) target.setItem(REFRESH_KEY, refresh);
    else target.removeItem(REFRESH_KEY);
    other.removeItem(ACCESS_KEY);
    other.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable — the tokens only live for this request cycle */
  }
  notify();
}

/**
 * Stores a new token pair. `remember` defaults to wherever the current session
 * lives, so a refresh keeps "Keep me signed in" as the user chose it at sign-in;
 * with no session yet it persists (the app's default).
 */
export function setAuthTokens(
  tokens: { access: string; refresh?: string | undefined },
  remember: boolean = storedIn() !== "session",
) {
  writeTokens(tokens.access, tokens.refresh ?? getRefreshToken(), remember);
}

/**
 * Stores an access token on its own (e.g. a signup that signs the user in),
 * dropping any older refresh token: a new sign-in must not inherit one.
 * Persists unless `remember` is false.
 */
export function setAccessToken(token: string, remember = true) {
  writeTokens(token, null, remember);
}

/** Signs the user out locally: drops both tokens. */
export function clearAccessToken() {
  clearStoredTokens();
  notify();
}

/** A JWT's claims (its decoded payload), or `null` when the token isn't a readable JWT. */
function readClaims(token: string): Record<string, unknown> | null {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return null;
  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload: unknown = JSON.parse(atob(padded));
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Expiry time (ms since epoch) from a JWT's `exp` claim, or `null` when the
 * token isn't a JWT or carries no `exp`.
 */
export function getTokenExpiry(token: string): number | null {
  const exp = readClaims(token)?.exp;
  return typeof exp === "number" ? exp * 1000 : null;
}

function subjectOf(token: string | null): string | null {
  if (!token) return null;
  const sub = readClaims(token)?.sub;
  return typeof sub === "string" && sub ? sub : null;
}

/** The last token decoded by `getSessionSubject` (it runs on every render of its subscribers). */
let subjectCache: { token: string; subject: string | null } | null = null;

/**
 * Who the stored session belongs to: the user id (`sub`) in its access token, else
 * in its refresh token; `null` with no session. A renewal keeps the same user, so
 * a change means another user's session replaced this one.
 */
export function getSessionSubject(): string | null {
  const access = getAccessToken();
  const token = access ?? getRefreshToken();
  if (!token) return null;
  if (subjectCache?.token !== token) {
    subjectCache = { token, subject: subjectOf(token) ?? (access ? subjectOf(getRefreshToken()) : null) };
  }
  return subjectCache.subject;
}

/**
 * True when the token is past its `exp` on the backend's clock (`serverNow`). The
 * backend always issues JWTs with `exp`, so a token without a readable one is
 * malformed and counts as expired.
 */
export function isTokenExpired(token: string, now = serverNow()): boolean {
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
