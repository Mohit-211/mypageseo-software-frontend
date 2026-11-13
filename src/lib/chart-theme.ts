/**
 * One look for every chart in the app (recharts), built on the validated 8-slot palette
 * (`--chart-1..8` in styles.css: teal, orange, blue, green, violet, red, ochre, magenta).
 *
 * Rules: "you" / the main series is always slot 1; other series take the next slots in a
 * fixed order (never cycle — past 8 series, group the rest as "Other" in muted grey);
 * text never wears a chart colour; colour always comes with a label, legend or tooltip.
 */

/** The 8 categorical series colours, in their fixed order. */
export const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
] as const;

/** Colour for "Other" / overflow series and a previous-period comparison line. */
export const MUTED_SERIES = "var(--color-muted-foreground)";

/** Series colour for a 0-based slot; slots past the palette fall back to the muted "Other" colour. */
export function seriesColor(slot: number): string {
  return SERIES[slot] ?? MUTED_SERIES;
}

/**
 * Stable colours for named series (e.g. competitors by place id): the main series gets slot 1,
 * the others keep their slot in the order given, so a competitor keeps its colour across charts.
 */
export function seriesColors(keys: readonly string[], mainKey?: string | null): Map<string, string> {
  const colors = new Map<string, string>();
  let next = 1;
  for (const key of keys) {
    if (colors.has(key)) continue;
    if (mainKey !== undefined && mainKey !== null && key === mainKey) colors.set(key, seriesColor(0));
    else colors.set(key, seriesColor(next++));
  }
  return colors;
}

/**
 * `<CartesianGrid {...gridProps} />`: solid horizontal hairlines only. Dashes are reserved for the
 * previous-period / comparison series, so a dashed gridline never reads as a threshold.
 */
export const gridProps = {
  stroke: "var(--color-border)",
  vertical: false,
} as const;

/** `<XAxis {...axisProps} />` / `<YAxis {...axisProps} />`: quiet axes, readable 12px ticks. */
export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 12, fill: "var(--color-muted-foreground)" },
  tickMargin: 8,
} as const;

/**
 * `<Tooltip {...tooltipProps} />`: a card-style tooltip. Rows are ink: recharts' default tooltip
 * paints each row in its series colour, and most series colours (or a muted "previous" bar) are
 * below 4.5:1 as 12px text.
 */
export const tooltipProps = {
  cursor: { stroke: "var(--color-border-strong)", strokeWidth: 1 },
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    boxShadow: "var(--shadow-raised)",
    fontSize: 12,
    color: "var(--color-foreground)",
  },
  labelStyle: { color: "var(--color-muted-foreground)", marginBottom: 4 },
  itemStyle: { color: "var(--color-foreground)" },
} as const;

/** Line widths: the main series stands out, comparisons stay quiet. */
export const STROKE = { main: 2.5, other: 1.5 } as const;
