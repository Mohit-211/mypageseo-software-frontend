export type HealthTone = "healthy" | "attention" | "critical";

/** A 0–100 score's tone: 80+ healthy, 60+ attention, below that critical. */
export function healthTone(score: number): HealthTone {
  if (score >= 80) return "healthy";
  if (score >= 60) return "attention";
  return "critical";
}
