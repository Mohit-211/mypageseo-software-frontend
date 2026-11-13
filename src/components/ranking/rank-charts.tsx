import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KeywordHistory, RankRunSummary, RankTarget } from "@/api";
import { Skeleton } from "@/components/ui/skeleton";
import { STROKE, axisProps, gridProps, seriesColors, tooltipProps } from "@/lib/chart-theme";
import { formatAvgRank, formatRunDate, targetLabel } from "@/lib/rankings/format";
import { byBoolean, byNumber, byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** The business's own series id: the same in every run, whatever its place id. */
const SELF = "self";

type Series = { id: string; name: string; self: boolean; color: string };
type Row = { label: string } & Record<string, number | null | string>;

const seriesId = (target: RankTarget) => (target.key === "self" ? SELF : target.place_id || target.key);
const slotOf = (key: string) => {
  const match = /^competitor_(\d+)$/.exec(key);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

/**
 * Chart rows from runs (oldest first). A competitor slot can hold another business in an older
 * run, so series are keyed by place id, not by slot. Colours are fixed (chart-theme): "you" is
 * slot 1 at 2.5px; competitors take the next slots in the latest run's order, then businesses that
 * only appear in older runs; past the palette they fall back to the muted "Other" grey (never reused).
 */
function buildSeries(
  runs: { run_at: string; targets: RankTarget[]; values: Record<string, number | null | undefined> }[],
  selfName: string,
): { rows: Row[]; series: Series[] } {
  const names = new Map<string, string>();
  const rows: Row[] = runs.map((run) => {
    const row: Row = { label: formatRunDate(run.run_at) };
    for (const target of run.targets) {
      const id = seriesId(target);
      // The latest run's name wins (runs are oldest first).
      names.set(id, targetLabel(target.key, selfName, target.name));
      row[id] = run.values[target.key] ?? null;
    }
    return row;
  });

  // Order: you, then the newest run's competitors by slot, then older runs' businesses, newest first.
  const order: string[] = [SELF];
  for (const run of [...runs].reverse()) {
    for (const target of [...run.targets].sort((a, b) => slotOf(a.key) - slotOf(b.key))) {
      const id = seriesId(target);
      if (!order.includes(id)) order.push(id);
    }
  }
  const colors = seriesColors(order, SELF);
  const series = order
    .filter((id) => names.has(id))
    .map((id) => ({ id, name: names.get(id)!, self: id === SELF, color: colors.get(id)! }));
  return { rows, series };
}

type TooltipEntry = { dataKey?: unknown; value?: unknown };

/**
 * Hover readout: the run date, then every business, best rank first, each keyed by a short sample
 * of its line (dashed for competitors). Text stays ink, so it reads on any series colour.
 */
function RankTooltip({
  active,
  label,
  payload,
  series,
}: {
  active?: boolean | undefined;
  label?: unknown;
  payload?: readonly TooltipEntry[] | undefined;
  series: Series[];
}) {
  if (!active || !payload?.length) return null;
  const valueOf = (id: string) => {
    const value = payload.find((item) => item.dataKey === id)?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  // A business with no rank in this run (not tracked then, or no data) is left out, as on the line.
  const rows = sortRows(
    series.map((entry) => ({ ...entry, value: valueOf(entry.id) })).filter((row) => row.value !== null),
    byNumber((row) => row.value),
    byBoolean((row) => row.self),
    byText((row) => row.name),
  );
  if (!rows.length) return null;
  return (
    <div className="max-w-80 rounded-[10px] border border-border bg-card px-3 py-2 text-xs shadow-raised">
      <p className="mb-1.5 font-medium text-muted-foreground">{String(label ?? "")}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id} className="flex items-baseline gap-2">
            <svg aria-hidden width="14" height="6" viewBox="0 0 14 6" className="shrink-0 self-center">
              <line
                x1="1"
                y1="3"
                x2="13"
                y2="3"
                stroke={row.color}
                strokeWidth={row.self ? STROKE.main : 2}
                strokeDasharray={row.self ? undefined : "3 3"}
                strokeLinecap="round"
              />
            </svg>
            <span className="min-w-8 shrink-0 font-semibold tabular-nums text-foreground">{formatAvgRank(row.value)}</span>
            <span className={cn("min-w-0", row.self ? "font-medium text-foreground" : "text-muted-foreground")}>
              {row.self ? `${row.name} (you)` : row.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankLines({ rows, series, height }: { rows: Row[]; series: Series[]; height: string }) {
  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} minTickGap={16} />
          {/* Rank 1 is best, so the axis is reversed: up means better. */}
          <YAxis reversed allowDecimals={false} domain={[1, "auto"]} width={40} {...axisProps} />
          <Tooltip
            cursor={tooltipProps.cursor}
            content={(props) => <RankTooltip active={props.active} label={props.label} payload={props.payload} series={series} />}
          />
          {series.length > 1 ? (
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              // Text never wears a chart colour: the line sample carries it.
              formatter={(value: string) => <span className="text-foreground">{value}</span>}
            />
          ) : null}
          {series.map((entry) => (
            <Line
              key={entry.id}
              type="monotone"
              dataKey={entry.id}
              name={entry.name}
              stroke={entry.color}
              strokeWidth={entry.self ? STROKE.main : STROKE.other}
              strokeDasharray={entry.self ? undefined : "5 4"}
              dot={{ r: entry.self ? 3 : 2, fill: entry.color, strokeWidth: 0 }}
              activeDot={{ r: entry.self ? 5 : 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartState({ loading, points, height }: { loading: boolean; points: number; height: string }) {
  if (loading) return <Skeleton className={cn(height, "w-full rounded-lg")} />;
  if (points < 2) {
    return (
      <p className={cn(height, "flex items-center justify-center rounded-lg border border-dashed border-border-strong px-6 text-center text-sm text-muted-foreground")}>
        The chart appears after the second finished run.
      </p>
    );
  }
  return null;
}

/** Overall average rank per finished run, for your business and each competitor (`GET rank-runs`). */
export function RankTrendChart({ runs, selfName, height = "h-60" }: { runs: RankRunSummary[] | null; selfName: string; height?: string }) {
  const finished = (runs ?? []).filter((run) => run.status === "done" || run.status === "partial").reverse();
  if (runs === null || finished.length < 2) return <ChartState loading={runs === null} points={finished.length} height={height} />;
  const { rows, series } = buildSeries(
    finished.map((run) => ({
      run_at: run.run_at,
      targets: run.targets ?? [{ key: "self", place_id: SELF }],
      values: Object.fromEntries(Object.entries(run.overall).map(([key, value]) => [key, value.overallAvgRank])),
    })),
    selfName,
  );
  return (
    <div role="img" aria-label={`Average rank over ${rows.length} runs for ${series.map((entry) => entry.name).join(", ")}. Lower is better.`}>
      <RankLines rows={rows} series={series} height={height} />
    </div>
  );
}

/** One keyword's average rank per run (`GET keyword-history`). */
export function KeywordHistoryChart({
  history,
  loading,
  selfName,
  height = "h-56",
}: {
  history: KeywordHistory | undefined;
  loading: boolean;
  selfName: string;
  height?: string;
}) {
  const runs = history?.runs ?? [];
  if (loading || runs.length < 2) return <ChartState loading={loading} points={runs.length} height={height} />;
  const { rows, series } = buildSeries(
    runs.map((run) => ({
      run_at: run.run_at,
      targets: run.targets,
      values: Object.fromEntries(Object.entries(run.summary).map(([key, value]) => [key, value.avgRank])),
    })),
    selfName,
  );
  return (
    <div role="img" aria-label={`Average rank for ${history?.keyword ?? "this keyword"} over ${rows.length} runs. Lower is better.`}>
      <RankLines rows={rows} series={series} height={height} />
    </div>
  );
}
