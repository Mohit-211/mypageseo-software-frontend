import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, MetricCard, Panel, StatusBadge, TrendIndicator } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/mypageseo/states";
import type { RankingMetric, RankingOverviewData, RankingKeywordRow } from "@/lib/mypageseo/ranking-overview";

export function RankingFilterBar({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center">
      <Select value="google" disabled={disabled}>
        <SelectTrigger aria-label="Result type" className="w-full bg-background sm:w-40"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="google">Google</SelectItem><SelectItem value="local_finder">Local Finder</SelectItem></SelectContent>
      </Select>
      <Select value="30_days" disabled={disabled}>
        <SelectTrigger aria-label="Ranking period" className="w-full bg-background sm:w-40"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="30_days">Last 30 days</SelectItem></SelectContent>
      </Select>
      <Select value="previous" disabled={disabled}>
        <SelectTrigger aria-label="Comparison period" className="w-full bg-background sm:w-48"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="previous">Previous period</SelectItem></SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground sm:ml-auto">Filters activate when ranking data is available.</span>
    </div>
  );
}

function MetricChange({ metric, lowerIsBetter = false }: { metric: RankingMetric; lowerIsBetter?: boolean }) {
  if (metric.change === null) return null;
  const direction = metric.change > 0 ? "up" : metric.change < 0 ? "down" : "flat";
  return <TrendIndicator direction={direction} value={Math.abs(metric.change).toFixed(1)} positive={lowerIsBetter ? metric.change < 0 : metric.change > 0} />;
}

export function RankingMetricSummary({ data }: { data: RankingOverviewData }) {
  const metrics = data.metrics;
  if (!metrics.averageGooglePosition || !metrics.keywordMovement || !metrics.positionalMovement || !metrics.localPackCoverage) return null;
  return (
    <section aria-labelledby="ranking-summary-title">
      <h2 id="ranking-summary-title" className="mb-3 text-sm font-semibold text-foreground">Ranking summary</h2>
      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard label="Average Google Position" value={metrics.averageGooglePosition.value.toFixed(1)} trend={<MetricChange metric={metrics.averageGooglePosition} lowerIsBetter />} caption="Lower position numbers are better" />
        <MetricCard label="Keyword Movement" value={metrics.keywordMovement.value} trend={<MetricChange metric={metrics.keywordMovement} />} caption="Keywords with meaningful movement" />
        <MetricCard label="Positional Movement" value={metrics.positionalMovement.value} trend={<MetricChange metric={metrics.positionalMovement} />} caption="Net positions gained or lost" />
        <MetricCard label="Google Local Pack Coverage" value={`${metrics.localPackCoverage.value}%`} trend={<MetricChange metric={metrics.localPackCoverage} />} caption="Tracked keywords appearing in Local Pack" />
      </div>
    </section>
  );
}

export function RankingHistory({ data, onRetry }: { data: RankingOverviewData; onRetry: () => void }) {
  if (data.status === "error") return <ErrorState title="Ranking history could not be loaded" description="The rest of this ranking overview remains available." onRetry={onRetry} className="min-h-72" />;
  if (data.history.length === 0) return <EmptyState title="No ranking history yet" description="Historical position data will appear after ranking collection begins for this location." className="min-h-72" />;
  const values = data.history.flatMap((point) => [point.averagePosition, point.comparisonPosition].filter((value): value is number => value !== null));
  const domain: [number, number] = [Math.max(1, Math.floor(Math.min(...values) - 1)), Math.ceil(Math.max(...values) + 1)];
  return (
    <Panel>
      <ChartContainer title="Average Google Position" description="Lower is better. The comparison line represents the previous period." height={280}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.history} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis reversed domain={domain} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }} />
            <Line type="monotone" dataKey="comparisonPosition" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="averagePosition" stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Panel>
  );
}

export function RankingDistribution({ data }: { data: RankingOverviewData }) {
  if (data.distribution.length === 0) return <EmptyState title="No ranking distribution yet" description="Position buckets will appear when tracked keyword results are available." className="min-h-72" />;
  const total = data.distribution.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <Panel title="Ranking Distribution" description="Tracked keywords by current position range">
      <div className="space-y-4">
        {data.distribution.map((bucket) => (
          <div key={bucket.label}>
            <div className="flex items-center justify-between gap-3 text-sm"><span>{bucket.label}</span><span className="font-semibold tabular">{bucket.count}</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${total ? (bucket.count / total) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MovementCell({ row }: { row: RankingKeywordRow }) {
  if (row.movement === null || row.movement === 0) return <StatusBadge>Unchanged</StatusBadge>;
  const improved = row.movement > 0;
  return <StatusBadge tone={improved ? "success" : "critical"}>{improved ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}{Math.abs(row.movement)}</StatusBadge>;
}

export function RankingTable({ title, rows, actionLabel }: { title: string; rows: RankingKeywordRow[]; actionLabel?: string }) {
  return (
    <Panel title={title} actions={actionLabel ? <Button variant="outline" size="sm" disabled>{actionLabel}<ArrowRight aria-hidden /></Button> : undefined}>
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No keyword ranking rows are available yet.</p> : (
        <div role="region" aria-label={title} tabIndex={0} className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground"><th scope="col" className="pb-2 font-medium">Keyword</th><th scope="col" className="pb-2 font-medium">Previous</th><th scope="col" className="pb-2 font-medium">Current</th><th scope="col" className="pb-2 font-medium">Movement</th><th scope="col" className="pb-2 font-medium">Result type</th></tr></thead>
            <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id}><td className="py-3 font-medium text-foreground">{row.keyword}</td><td className="py-3 tabular">{row.previousPosition ?? "—"}</td><td className="py-3 tabular">{row.currentPosition ?? "—"}</td><td className="py-3"><MovementCell row={row} /></td><td className="py-3 text-muted-foreground">{row.resultType ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function RankingOverviewLoading() {
  return <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading ranking overview"><MetricSkeletonGrid count={4} /><div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><Skeleton className="h-80 w-full" /><Skeleton className="h-80 w-full" /></div><TableSkeleton rows={5} columns={5} /></div>;
}
