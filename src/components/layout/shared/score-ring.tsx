import { cn } from "@/lib/utils";
import { HEALTH_TONE_CLASSES, healthTone, type HealthTone } from "@/lib/health-tone";

const SIZES = {
  sm: { box: 44, stroke: 5, text: "text-sm" },
  md: { box: 64, stroke: 6, text: "text-lg" },
  lg: { box: 88, stroke: 8, text: "text-2xl" },
} as const;

const STATUS_HEALTH: Record<"success" | "warning" | "critical", HealthTone> = { success: "healthy", warning: "attention", critical: "critical" };

/**
 * A 0–100 score as a ring (Profile score, Citation score, completeness). The arc takes the
 * health colour of the score's grade (green for A and B, 70+; amber for C, 55+; red below) unless
 * `status` or `tone` fixes it; a missing score draws only the track and a dash. The number in
 * the middle is the accessible value.
 */
export function ScoreRing({
  value,
  max = 100,
  size = "md",
  tone = "auto",
  status,
  label,
  className,
}: {
  /** The score; null or undefined when there is none yet. */
  value: number | null | undefined;
  max?: number;
  size?: keyof typeof SIZES;
  /** "auto" colours by health; "brand" uses the primary teal (for non-judgemental progress). */
  tone?: "auto" | "brand";
  /**
   * The state the backend gave this score (e.g. a GBP part's pass / partial / fail), when the
   * badge beside the ring shows it: the ring then wears the same colour instead of the score's.
   */
  status?: "success" | "warning" | "critical" | undefined;
  /** What the score is, for screen readers ("Profile score"). */
  label: string;
  className?: string;
}) {
  const { box, stroke, text } = SIZES[size];
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const has = typeof value === "number" && Number.isFinite(value);
  const ratio = has ? Math.min(Math.max(value / max, 0), 1) : 0;
  const strokeClass = !has
    ? ""
    : status
      ? HEALTH_TONE_CLASSES[STATUS_HEALTH[status]].stroke
      : tone === "brand"
        ? "stroke-primary"
        : HEALTH_TONE_CLASSES[healthTone((value / max) * 100)].stroke;
  const display = has ? Math.round(value) : "–";

  return (
    <div
      role="img"
      aria-label={has ? `${label}: ${display} out of ${max}` : `${label}: no score yet`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: box, height: box }}
    >
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90" aria-hidden>
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        {has ? (
          <circle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={cn(strokeClass, "transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none")}
          />
        ) : null}
      </svg>
      <span aria-hidden className={cn("absolute font-semibold tabular-nums text-foreground", text)}>
        {display}
      </span>
    </div>
  );
}
