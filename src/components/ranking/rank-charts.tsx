import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KeywordHistory, RankRunSummary, RankTarget } from "@/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAvgRank, formatRunDate, targetLabel } from "@/lib/rankings/format";

/** Your business first in the primary colour; competitors in the chart palette. */
const SERIES_COLORS = ["var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)", "var(--color-chart-6)"];

type Series = { id: string; name: string; self: boolean };
type Row = { label: string } & Record<string, number | null | string>;

/**
 * Builds chart rows from runs (oldest first). A competitor slot can hold another
 * business in an older run, so series are keyed by `place_id`, not by slot.
 */
function buildSeries(
  runs: { run_at: string; targets: RankTarget[]; values: Record<string, number | null | undefined> }[],
  selfName: string,
): { rows: Row[]; series: Series[] } {
  const series = new Map<string, Series>();
  const rows: Row[] = runs.map((run) => {
    const row: Row = { label: formatRunDate(run.run_at) };
    for (const target of run.targets) {
      const id = target.place_id || target.key;
      // The latest run's name wins (runs are oldest first).
      series.set(id, { id, name: targetLabel(target.key, selfName, target.name), self: target.key === "self" });
      row[id] = run.values[target.key] ?? null;
    }
    return row;
  });
  const ordered = [...series.values()].sort((a, b) => Number(b.self) - Number(a.self));
  return { rows, series: ordered };
}

function RankLines({ rows, series }: { rows: Row[]; series: Series[] }) {
  let colorIndex = 0;
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
          {/* Rank 1 is best, so the axis is reversed. */}
          <YAxis reversed allowDecimals={false} domain={[1, "auto"]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
          <Tooltip formatter={(value, name) => [formatAvgRank(value as number | null), name]} />
          {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((entry) => {
            const color = entry.self ? "var(--color-primary)" : SERIES_COLORS[colorIndex++ % SERIES_COLORS.length];
            return (
              <Line
                key={entry.id}
                type="monotone"
                dataKey={entry.id}
                name={entry.name}
                stroke={color}
                strokeWidth={entry.self ? 2.5 : 1.5}
                strokeDasharray={entry.self ? undefined : "4 3"}
                dot={{ r: entry.self ? 3 : 2 }}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartState({ loading, points }: { loading: boolean; points: number }) {
  if (loading) return <Skeleton className="h-56 w-full" />;
  if (points < 2) {
    return <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">The chart appears after the second finished run.</p>;
  }
  return null;
}

/** Overall average rank per finished run, for your business and each competitor (`GET rank-runs`). */
export function RankTrendChart({ runs, selfName }: { runs: RankRunSummary[] | null; selfName: string }) {
  const finished = (runs ?? []).filter((run) => run.status === "done" || run.status === "partial").reverse();
  const state = <ChartState loading={runs === null} points={finished.length} />;
  if (runs === null || finished.length < 2) return state;
  const { rows, series } = buildSeries(
    finished.map((run) => ({
      run_at: run.run_at,
      targets: run.targets ?? [{ key: "self", place_id: "self" }],
      values: Object.fromEntries(Object.entries(run.overall).map(([key, value]) => [key, value.overallAvgRank])),
    })),
    selfName,
  );
  return (
    <div role="img" aria-label={`Average rank over ${rows.length} runs`}>
      <RankLines rows={rows} series={series} />
    </div>
  );
}

/** One keyword's average rank per run (`GET keyword-history`). */
export function KeywordHistoryChart({ history, loading, selfName }: { history: KeywordHistory | undefined; loading: boolean; selfName: string }) {
  const runs = history?.runs ?? [];
  if (loading || runs.length < 2) return <ChartState loading={loading} points={runs.length} />;
  const { rows, series } = buildSeries(
    runs.map((run) => ({
      run_at: run.run_at,
      targets: run.targets,
      values: Object.fromEntries(Object.entries(run.summary).map(([key, value]) => [key, value.avgRank])),
    })),
    selfName,
  );
  return (
    <div role="img" aria-label={`Average rank for ${history?.keyword ?? "this keyword"} over ${rows.length} runs`}>
      <RankLines rows={rows} series={series} />
    </div>
  );
}
