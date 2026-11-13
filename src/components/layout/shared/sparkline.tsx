import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * A tiny trend line for KPI tiles and table rows. Gaps (null) break the line. With
 * `lowerIsBetter` (average rank) the chart is flipped so "up" always means "better".
 * It is decorative next to a number, so pass `label` only when the line stands alone.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  lowerIsBetter = false,
  className,
  label,
}: {
  values: readonly (number | null | undefined)[];
  width?: number;
  height?: number;
  lowerIsBetter?: boolean;
  /** Tailwind text colour class sets the stroke (default: the primary teal). */
  className?: string;
  /** Accessible description when the sparkline is the only representation of the data. */
  label?: string;
}) {
  const gradientId = useId();
  const points = values.map((value, index) => ({ index, value: typeof value === "number" && Number.isFinite(value) ? value : null }));
  const present = points.filter((point): point is { index: number; value: number } => point.value !== null);
  if (present.length < 2) return null;

  const min = Math.min(...present.map((point) => point.value));
  const max = Math.max(...present.map((point) => point.value));
  const span = max - min || 1;
  const pad = 2;
  const x = (index: number) => pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const y = (value: number) => {
    const ratio = (value - min) / span;
    const up = lowerIsBetter ? 1 - ratio : ratio;
    return pad + (1 - up) * (height - pad * 2);
  };

  // One path per run of consecutive values, so missing runs show as gaps.
  const runs: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];
  for (const point of points) {
    if (point.value === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push({ index: point.index, value: point.value });
    }
  }
  if (current.length) runs.push(current);

  const last = present[present.length - 1]!;
  const line = (run: { index: number; value: number }[]) =>
    run.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = (run: { index: number; value: number }[]) =>
    `${line(run)} L${x(run[run.length - 1]!.index).toFixed(1)},${height} L${x(run[0]!.index).toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible text-primary", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {runs.map((run) => (
        <g key={run[0]!.index}>
          {run.length > 1 ? <path d={area(run)} fill={`url(#${gradientId})`} /> : null}
          <path d={line(run)} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <circle cx={x(last.index)} cy={y(last.value)} r={2.5} fill="currentColor" />
    </svg>
  );
}
