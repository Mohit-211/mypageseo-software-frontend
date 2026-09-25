/**
 * Frontend demo/preview mode.
 *
 * While the product APIs are not connected to this frontend, screens render a
 * coherent fictional account so the interface can be reviewed end to end.
 *
 * Removal plan: set `DEMO_DATA_ENABLED` to false (or delete this folder and the
 * `withDemoFallback` calls inside `src/lib/mypageseo/*.ts` adapters). No visual
 * component imports demo data directly, so nothing else has to change when the
 * real reads land.
 */
export const DEMO_DATA_ENABLED = true;

/**
 * Returns the real API value when it exists, otherwise the demo value.
 *
 * `real` is null/undefined while a data source is not connected. Genuine
 * "entity does not exist yet" states (no locations, no keywords on a brand new
 * account) must be returned by the real source, not simulated here.
 */
export function withDemoFallback<T>(real: T | null | undefined, demo: () => T): T {
  if (real !== null && real !== undefined) return real;
  if (!DEMO_DATA_ENABLED) {
    throw new Error("Demo data is disabled and no live data was provided");
  }
  return demo();
}

/** Deterministic 32-bit hash, so demo values never shuffle between renders. */
export function seedFrom(...parts: (string | number)[]): number {
  let hash = 2166136261;
  const input = parts.join("|");
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic integer in [min, max]. */
export function pickInt(seed: number, min: number, max: number): number {
  return min + Math.floor(rng(seed)() * (max - min + 1));
}

/** Deterministic item from a list. */
export function pickOne<T>(seed: number, items: readonly T[]): T {
  return items[Math.floor(rng(seed)() * items.length) % items.length]!;
}

/** ISO date `days` before the fixed demo "today", so output stays stable. */
export const DEMO_TODAY = "2026-09-11";

export function demoDate(daysAgo: number): string {
  const base = new Date(`${DEMO_TODAY}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base.toISOString().slice(0, 10);
}

export function demoDateAhead(daysAhead: number): string {
  return demoDate(-daysAhead);
}
