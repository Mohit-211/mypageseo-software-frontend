export type HealthTone = "healthy" | "attention" | "critical";

export type ScoreGrade = "A" | "B" | "C" | "D" | "F";

/**
 * The letter grades of a 0–100 score, best first. Mirrors the backend's `GRADES`
 * (gbpReport and citations `scoring.config.ts`), so a grade worked out here for an average
 * matches the grades the API sends for single scores.
 */
export const GRADE_BANDS: readonly { min: number; grade: ScoreGrade }[] = [
  { min: 85, grade: "A" },
  { min: 70, grade: "B" },
  { min: 55, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

/** The letter grade of a 0–100 score: A 85+, B 70+, C 55+, D 40+, F below. */
export function scoreGrade(score: number): ScoreGrade {
  return GRADE_BANDS.find((band) => score >= band.min)?.grade ?? "F";
}

/** Each grade in a word (GBP Audit's "B Good"), the same everywhere a grade is spelled out. */
export const GRADE_WORD: Record<string, string> = { A: "Excellent", B: "Good", C: "Fair", D: "Needs work", F: "Poor" };

const GRADE_TONE: Record<ScoreGrade, HealthTone> = { A: "healthy", B: "healthy", C: "attention", D: "critical", F: "critical" };

/**
 * A 0–100 score's tone, on the grade bands so a colour never contradicts the letter next to it:
 * A and B (70+) healthy, C (55+) attention, D and F critical.
 */
export function healthTone(score: number): HealthTone {
  return GRADE_TONE[scoreGrade(score)];
}

/**
 * The status colour for each health tone: green, amber, and red only for critical.
 * Matches `StatusTone` (StatusBadge, Badge variants).
 */
export const HEALTH_STATUS_TONE: Record<HealthTone, "success" | "warning" | "critical"> = {
  healthy: "success",
  attention: "warning",
  critical: "critical",
};

/** StatusBadge tone for a score that may be missing ("neutral" when there is no score yet). */
export function healthStatusTone(score: number | null | undefined): "success" | "warning" | "critical" | "neutral" {
  return score == null ? "neutral" : HEALTH_STATUS_TONE[healthTone(score)];
}

/**
 * Classes per health tone, all on the semantic tokens:
 * - `fill` for bars and gauge strokes' HTML counterparts (>= 3:1 on the card and the muted track),
 * - `stroke` for SVG rings,
 * - `text` for a coloured number or label (>= 4.5:1 on the card),
 * - `surface` for a soft background behind it.
 */
export const HEALTH_TONE_CLASSES: Record<HealthTone, { fill: string; stroke: string; text: string; surface: string }> = {
  healthy: { fill: "bg-success", stroke: "stroke-success", text: "text-success", surface: "bg-success-surface" },
  attention: { fill: "bg-warning", stroke: "stroke-warning", text: "text-warning-foreground", surface: "bg-warning-surface" },
  critical: { fill: "bg-critical", stroke: "stroke-critical", text: "text-critical", surface: "bg-critical-surface" },
};
