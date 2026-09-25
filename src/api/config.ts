/**
 * API configuration.
 *
 * The base URL comes from `VITE_API_BASE_URL` (see `.env.example`). When it is
 * not set, requests go to `/api` on the current origin so a dev proxy or a
 * same-origin backend works without extra setup.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

/** Requests that take longer than this are aborted and reported as a timeout. */
export const API_TIMEOUT_MS = 20_000;
