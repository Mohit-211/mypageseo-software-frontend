import { useMemo } from "react";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { Panel } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AI_PLATFORMS,
  AI_PLATFORM_COLOR,
  AI_PLATFORM_LABEL,
  trendSeries,
  type DateBounds,
  type DateRangeValue,
  type PlatformFilter,
  type VisibilityHistoryPoint,
} from "@/lib/ai-visibility/ai-visibility";
import { DateRangeSelect } from "./ai-visibility-header";

type ChartRow = { date: string; label: string; visibility: number; mentions: number; overall: number };

function TrendTooltip({ active, payload, platformLabel }: TooltipProps<number, string> & { platformLabel: string | null }) {
  const row = payload?.[0]?.payload as ChartRow | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{format(new Date(row.date), "EEE, MMM d, yyyy")}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">{platformLabel ? `${platformLabel} visibility` : "Visibility score"}</dt>
        <dd className="text-right font-medium tabular text-foreground">{Math.round(row.visibility)}</dd>
        {platformLabel ? (
          <>
            <dt className="text-muted-foreground">All platforms</dt>
            <dd className="text-right tabular text-foreground">{Math.round(row.overall)}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Mentions</dt>
        <dd className="text-right font-medium tabular text-foreground">{row.mentions}</dd>
      </dl>
    </div>
  );
}

export function VisibilityTrend({
  history,
  bounds,
  range,
  onRangeChange,
  platform,
  onPlatformChange,
}: {
  history: VisibilityHistoryPoint[];
  bounds: DateBounds;
  range: DateRangeValue;
  onRangeChange: (range: DateRangeValue) => void;
  platform: PlatformFilter;
  onPlatformChange: (platform: PlatformFilter) => void;
}) {
  const rows = useMemo<ChartRow[]>(() => {
    const selected = trendSeries(history, bounds, platform);
    const overall = trendSeries(history, bounds, "all");
    return selected.map((point, i) => ({
      ...point,
      overall: overall[i]?.visibility ?? point.visibility,
      label: format(new Date(point.date), "MMM d"),
    }));
  }, [history, bounds, platform]);

  const first = rows[0];
  const last = rows.at(-1);
  const platformLabel = platform === "all" ? null : AI_PLATFORM_LABEL[platform];
  const lineColor = platform === "all" ? "var(--primary)" : AI_PLATFORM_COLOR[platform];
  const values = rows.flatMap((r) => [r.visibility, r.overall]);
  const domain: [number, number] = values.length
    ? [Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10), Math.min(100, Math.ceil((Math.max(...values) + 5) / 10) * 10)]
    : [0, 100];
  const ticks = Array.from({ length: (domain[1] - domain[0]) / 10 + 1 }, (_, i) => domain[0] + i * 10);

  const summary =
    first && last
      ? `${platformLabel ? `${platformLabel} visibility` : "Your visibility"} changed from ${Math.round(first.visibility)} to ${Math.round(last.visibility)} during this period.`
      : null;

  return (
    <Panel
      title="AI Visibility Over Time"
      description="Daily visibility score from tracked prompt results"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Select value={platform} onValueChange={(v) => onPlatformChange(v as PlatformFilter)}>
            <SelectTrigger className="h-9 w-full bg-surface text-sm sm:w-40" aria-label="Platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {AI_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {AI_PLATFORM_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeSelect value={range} onChange={onRangeChange} className="block w-full sm:w-auto" />
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact title="No visibility data for this period" description="Choose a different date range to see how your visibility changed." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">{summary}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full" style={{ background: lineColor }} />
                {platformLabel ?? "All platforms"}
              </span>
              {platformLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
                  All platforms
                </span>
              ) : null}
            </div>
          </div>
          <div className="h-64 w-full sm:h-72" role="img" aria-label={summary ?? "AI visibility over time"}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  minTickGap={28}
                />
                <YAxis domain={domain} ticks={ticks}tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                  content={<TrendTooltip platformLabel={platformLabel} />}
                />
                {platformLabel ? (
                  <Line type="monotone" dataKey="overall" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} activeDot={false} />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="visibility"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

export function VisibilityTrendSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="p-4">
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    </div>
  );
}
