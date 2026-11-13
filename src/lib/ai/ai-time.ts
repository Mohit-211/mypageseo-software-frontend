/**
 * When a paused AI comes back.
 *
 * The backend counts its daily AI budget per **UTC day** (`dayOf` in backend
 * `src/modules/ai/services/ai.service.ts`), so a 503 `ai_budget_reached` / `paused_today` lasts until
 * the next 00:00 UTC. People don't think in UTC: these helpers turn that instant into the viewer's
 * local time ("7:00 PM", or "5:30 AM tomorrow" east of Greenwich).
 *
 * Pure: every function takes the reference time as an argument, so callers never read the clock
 * during render (pass a query's `dataUpdatedAt`, an event time, or `useNow()`).
 */
import { formatTime } from "@/lib/datetime";

/** The next 00:00 UTC strictly after `fromMs` (ms since epoch). */
export function nextUtcMidnight(fromMs: number): number {
  const from = new Date(fromMs);
  return Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1);
}

/**
 * "7:00 PM" when `atMs` falls on the same local calendar day as `fromMs`, otherwise
 * "5:30 AM tomorrow". Used with `nextUtcMidnight`, so it is never more than a day ahead.
 */
export function formatResumeTime(atMs: number, fromMs: number): string {
  const at = new Date(atMs);
  const from = new Date(fromMs);
  const sameDay = at.getFullYear() === from.getFullYear() && at.getMonth() === from.getMonth() && at.getDate() === from.getDate();
  const time = formatTime(at);
  return sameDay ? time : `${time} tomorrow`;
}
