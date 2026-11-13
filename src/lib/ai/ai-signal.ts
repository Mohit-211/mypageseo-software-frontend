/**
 * What AI calls in this browser session have said about AI availability.
 *
 * The reviews summary (`useAiStatus`'s main source) can't always answer: no location yet, a plan without
 * reviews (403 `feature_not_included`), the first load still running, or a summary fetched before AI
 * changed. A real AI call is the freshest evidence there is, so it is remembered here and
 * `useAiStatus` uses whichever of the two is newer:
 * - 503 `ai_not_configured` → "off" for 15 minutes (after that the next summary or click decides again;
 *   the old posts flag stayed on until a reload, see ai.md L3);
 * - 503 `ai_budget_reached` → "paused" until the next 00:00 UTC (the budget is per UTC day);
 * - a successful AI call (`noteAiSuccess`) → "ready" for 15 minutes.
 *
 * The AI switch and the budget are the same for every organization and location, so one signal covers
 * all of them. `toastAiError` records errors automatically; inline error UIs call `noteAiError` themselves.
 */
import { useSyncExternalStore } from "react";
import { isApiError } from "@/api";
import { nextUtcMidnight } from "./ai-time";

export type AiSessionSignal = {
  kind: "off" | "paused" | "ready";
  /** When it was observed (ms since epoch). */
  at: number;
  /** When it stops counting (ms since epoch). */
  until: number;
};

const SIGNAL_TTL_MS = 15 * 60_000;

let current: AiSessionSignal | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function publish(next: AiSessionSignal | null) {
  current = next;
  if (expiry !== undefined) clearTimeout(expiry);
  // A timer (not a clock read at render time) retires the signal, so subscribers re-render when it lapses.
  expiry = next ? setTimeout(() => publish(null), Math.max(0, next.until - Date.now())) : undefined;
  for (const listener of listeners) listener();
}

/** Records an AI availability error (`ai_not_configured`, `ai_budget_reached`); any other error is ignored. */
export function noteAiError(error: unknown): void {
  if (!isApiError(error)) return;
  const at = Date.now();
  if (error.reason === "ai_not_configured") publish({ kind: "off", at, until: at + SIGNAL_TTL_MS });
  else if (error.reason === "ai_budget_reached") publish({ kind: "paused", at, until: nextUtcMidnight(at) });
}

/** Records that an AI call just worked, so AI shows as ready even if an older summary said otherwise. */
export function noteAiSuccess(): void {
  const at = Date.now();
  publish({ kind: "ready", at, until: at + SIGNAL_TTL_MS });
}

/** Forgets the session signal ("Check again"): the summary, or the next click, decides. */
export function clearAiSignal(): void {
  if (current) publish(null);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => current;

/** The current session signal, or null when nothing recent is known. */
export function useAiSignal(): AiSessionSignal | null {
  return useSyncExternalStore(subscribe, read, read);
}
