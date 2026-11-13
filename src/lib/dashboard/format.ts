import type { TrendDirection } from "@/components/layout/shared/data-display";
import { scoreGrade } from "@/lib/health-tone";

export type Trend = { direction: TrendDirection; value: string; positive: boolean };

/**
 * The value of a 0–100 score tile, next to its ring (the ring shows the number, so it isn't
 * printed twice): "Grade B". An average without a grade from the API gets one on the same bands,
 * so it reads like a single location's score. "—" without a score.
 */
export function gradeText(score: number | null | undefined, grade?: string | null): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return "—";
  return `Grade ${grade || scoreGrade(score)}`;
}

/**
 * A change for a trend chip, or undefined when there's nothing to compare. `digits` fixes the
 * decimals; `suffix` follows the number (" pts", "%"). Higher is better unless the caller passes
 * a change that is already "positive = better" (average rank changes come as previous − current).
 */
export function trendOf(change: number | null | undefined, { digits = 0, suffix = "" }: { digits?: number; suffix?: string } = {}): Trend | undefined {
  if (change === null || change === undefined || !Number.isFinite(change)) return undefined;
  const rounded = Number(change.toFixed(digits));
  const direction: TrendDirection = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  // "1 pt", "2 pts".
  const unit = suffix === " pts" && Math.abs(rounded) === 1 ? " pt" : suffix;
  return { direction, value: `${Math.abs(rounded).toFixed(digits)}${unit}`, positive: rounded > 0 };
}

/** "+1,234" / "−56" with a real minus sign, for "what changed" sentences. */
export function signed(value: number, digits = 0): string {
  const text = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

/** "1,234" or "—". */
export function count(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toLocaleString();
}

/** "1 review" / "3 reviews". */
export function plural(value: number, one: string, many = `${one}s`): string {
  return `${value.toLocaleString()} ${value === 1 ? one : many}`;
}
