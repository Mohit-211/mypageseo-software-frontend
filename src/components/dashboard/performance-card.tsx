import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, Link2 } from "lucide-react";
import type { GbpReport } from "@/api";
import { TrendIndicator } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanEdit } from "@/hooks/use-access";
import { MUTED_SERIES, STROKE, axisProps, gridProps, seriesColor, tooltipProps } from "@/lib/chart-theme";
import type { PerformanceMetric, PerformanceMetricKey, PerformanceView } from "@/lib/dashboard/dashboard-data";
import { dailySeries, type DailyPoint } from "@/lib/dashboard/focus-data";
import { count, trendOf } from "@/lib/dashboard/format";
import { formatShortDate } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { cn } from "@/lib/utils";

/**
 * The plot area: at least 232px, and it grows when the card is stretched next to a taller one, so
 * the card never ends in an empty band. The chart fills it absolutely (recharts needs a real size).
 */
function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="relative min-h-[232px] w-full flex-1">{children}</div>;
}

/** 12,400 → "12.4K" on the axis; small numbers stay whole. */
function compact(value: number): string {
  return Math.abs(value) >= 10_000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : value.toLocaleString();
}

/**
 * Google Business Profile performance for the period against the period before. With one location
 * in view the chart draws each day of this period over the same day of the previous one (from the
 * location's GBP report), and the five numbers switch what it shows. Across several locations there
 * is no daily data, so it compares the three kinds of customer actions instead.
 */
export function ProfilePerformanceCard({
  performance,
  days,
  report,
  reportLoading = false,
  detailsTo,
  scopeLabel = "Your Google profile",
  className,
}: {
  performance: PerformanceView;
  days: number;
  /** The location's GBP report (one location in view), or null across several locations. */
  report: GbpReport | null | undefined;
  reportLoading?: boolean;
  /** "Profile overview" link for one location. */
  detailsTo?: string | undefined;
  /** Whose numbers these are: "Harbor Dental's Google profile", "All your Google profiles combined"… */
  scopeLabel?: string;
  className?: string;
}) {
  const [metric, setMetric] = useState<PerformanceMetricKey>("impressions");
  const series = performance.available && report ? dailySeries(report, days, metric) : null;
  const daily = report !== null && (Boolean(series) || reportLoading);
  const selected = performance.available ? (performance.metrics.find((entry) => entry.key === metric) ?? performance.metrics[0]!) : null;

  return (
    <section aria-labelledby="performance-title" className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={BarChart3} tone="gbp" size="md" className="-mt-0.5" />
          <div className="min-w-0">
            <h2 id="performance-title" className="text-[15px] font-semibold leading-6 text-foreground">
              Profile performance
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {scopeLabel}, last {days} days vs the {days} days before
            </p>
          </div>
        </div>
        {detailsTo ? (
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link to={detailsTo}>
              Profile overview <ArrowRight aria-hidden />
            </Link>
          </Button>
        ) : null}
      </header>

      {!performance.available ? (
        <PerformanceUnavailable reason={performance.reason} />
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">
          <MetricCells metrics={performance.metrics} selected={daily ? metric : null} onSelect={setMetric} />

          {daily ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-sm font-semibold text-foreground">{selected?.label ?? "Profile views"} per day</p>
                {series ? <LineLegend current={series} /> : null}
              </div>
              <ChartFrame>
                {series ? <DailyChart points={series} label={selected?.label ?? "Profile views"} /> : <Skeleton className="absolute inset-0 rounded-lg" />}
              </ChartFrame>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-sm font-semibold text-foreground">Customer actions by type</p>
                <BarLegend />
              </div>
              <ChartFrame>
                <ActionsChart current={performance.current} previous={performance.previous} />
              </ChartFrame>
            </div>
          )}

          <p className="mt-auto text-xs text-muted-foreground">
            {performance.current.maps.toLocaleString()} views on Maps · {performance.current.search.toLocaleString()} on Search
            {performance.current.actions_per_1000_impressions !== null ? ` · ${performance.current.actions_per_1000_impressions} actions per 1,000 views` : ""}
            {performance.latestDate ? ` · Google reports a few days late: data up to ${formatShortDate(performance.latestDate)}` : ""}
            {performance.partial ? " · some days have no data yet" : ""}
          </p>
        </div>
      )}
    </section>
  );
}

function PerformanceUnavailable({ reason }: { reason: string }) {
  const { connect } = useGbpConnect();
  const canEdit = useCanEdit();
  if (reason === "gbp_not_connected") {
    return (
      <EmptyState
        variant="not-connected"
        compact
        className="m-4 sm:m-5"
        title="Connect Google to see profile performance"
        description="Views, calls, website visits and direction requests come from your Google Business Profile."
        {...(canEdit
          ? {
              action: (
                <Button size="sm" onClick={() => connect()}>
                  <Link2 aria-hidden /> Connect Google
                </Button>
              ),
            }
          : {})}
      />
    );
  }
  return (
    <EmptyState
      variant="unavailable"
      compact
      className="m-4 sm:m-5"
      title="Profile numbers are on their way"
      description="They appear after the first sync with Google. Google reports them a few days late."
    />
  );
}

/** The five headline numbers. With daily data they're buttons that pick what the chart shows. */
function MetricCells({
  metrics,
  selected,
  onSelect,
}: {
  metrics: PerformanceMetric[];
  selected: PerformanceMetricKey | null;
  onSelect: (key: PerformanceMetricKey) => void;
}) {
  const cellClass = "flex min-w-0 flex-col items-start bg-card px-3 py-2.5 text-left";
  return (
    <div
      {...(selected ? { role: "group", "aria-label": "Show in the chart" } : {})}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5"
    >
      {metrics.map((metric, index) => {
        const trend = trendOf(metric.change, { digits: 1, suffix: "%" });
        const content = (
          <>
            <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
            <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-lg font-semibold leading-tight tracking-tight text-foreground">{count(metric.value)}</span>
              {trend ? <TrendIndicator direction={trend.direction} value={trend.value} positive={trend.positive} /> : null}
            </span>
          </>
        );
        return selected ? (
          <button
            key={metric.key}
            type="button"
            aria-pressed={selected === metric.key}
            title={metric.caption}
            onClick={() => onSelect(metric.key)}
            className={cn(
              cellClass,
              // The last cell spans the row on 2 columns, so the grid has no hole.
              index === metrics.length - 1 && "col-span-2 sm:col-span-1",
              "cursor-pointer outline-hidden transition-colors hover:bg-accent/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              "aria-pressed:bg-brand-tint/60 aria-pressed:shadow-[inset_0_3px_0_var(--color-chart-1)]",
            )}
          >
            {content}
          </button>
        ) : (
          <div key={metric.key} title={metric.caption} className={cn(cellClass, index === metrics.length - 1 && "col-span-2 sm:col-span-1")}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function periodText(points: DailyPoint[], key: "date" | "previousDate"): string {
  const first = points[0]?.[key];
  const last = points[points.length - 1]?.[key];
  return first && last ? `${formatShortDate(first)} – ${formatShortDate(last)}` : "";
}

/** Line keys, not boxes: the legend mirrors the marks. */
function LineLegend({ current }: { current: DailyPoint[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="h-[3px] w-5 rounded-full bg-chart-1" />
        <span className="font-medium text-foreground">This period</span> {periodText(current, "date")}
      </li>
      <li className="inline-flex items-center gap-2">
        <span aria-hidden className="w-5 border-t-2 border-dashed border-muted-foreground" />
        <span className="font-medium text-foreground">Previous period</span> {periodText(current, "previousDate")}
      </li>
    </ul>
  );
}

function BarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <li className="inline-flex items-center gap-2 font-medium text-foreground">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-1" /> This period
      </li>
      <li className="inline-flex items-center gap-2 font-medium text-foreground">
        <span aria-hidden className="size-2.5 rounded-sm border border-dashed border-muted-foreground bg-muted" /> Previous period
      </li>
    </ul>
  );
}

type TooltipEntry = { payload?: DailyPoint };

/** Values lead, labels follow; both days are named, since they're a period apart. */
function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div style={tooltipProps.contentStyle} className="min-w-44 px-3 py-2">
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center justify-between gap-4 text-xs">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="h-[3px] w-3.5 rounded-full bg-chart-1" />
          {formatShortDate(point.date)}
        </span>
        <span className="font-semibold tabular-nums text-foreground">{count(point.current)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-4 text-xs">
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <span aria-hidden className="w-3.5 border-t-2 border-dashed border-muted-foreground" />
          {formatShortDate(point.previousDate)}
        </span>
        <span className="font-semibold tabular-nums text-foreground">{count(point.previous)}</span>
      </p>
    </div>
  );
}

function DailyChart({ points, label }: { points: DailyPoint[]; label: string }) {
  const total = (key: "current" | "previous") => points.reduce((sum, point) => sum + (point[key] ?? 0), 0);
  return (
    <div
      role="img"
      aria-label={`${label} per day: ${total("current").toLocaleString()} this period, ${total("previous").toLocaleString()} the period before.`}
      className="absolute inset-0"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={28} />
          <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={compact} />
          <Tooltip cursor={tooltipProps.cursor} content={<DailyTooltip />} />
          <Line
            type="monotone"
            dataKey="previous"
            name="Previous period"
            stroke={MUTED_SERIES}
            strokeDasharray="5 4"
            strokeWidth={STROKE.other}
            dot={false}
            activeDot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            name="This period"
            stroke={seriesColor(0)}
            strokeWidth={STROKE.main}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--color-card)", fill: seriesColor(0) }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Axis words short enough for all three to fit on a phone (recharts drops ticks that would
 * overlap); the tooltip and the chart's description keep the full names.
 */
const SHORT_ACTION: Record<string, string> = { "Website clicks": "Website", "Direction requests": "Directions" };

/** Calls, website clicks and directions: this period next to the period before. */
function ActionsChart({
  current,
  previous,
}: {
  current: { calls: number; website_clicks: number; direction_requests: number };
  previous: { calls: number; website_clicks: number; direction_requests: number };
}) {
  const data = [
    { name: "Calls", current: current.calls, previous: previous.calls },
    { name: "Website clicks", current: current.website_clicks, previous: previous.website_clicks },
    { name: "Direction requests", current: current.direction_requests, previous: previous.direction_requests },
  ];
  return (
    <div
      role="img"
      aria-label={data.map((row) => `${row.name}: ${row.current.toLocaleString()} this period, ${row.previous.toLocaleString()} before`).join("; ")}
      className="absolute inset-0"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={4} barCategoryGap="28%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} interval={0} tickFormatter={(name: string) => SHORT_ACTION[name] ?? name} />
          <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={compact} />
          <Tooltip
            {...tooltipProps}
            cursor={{ fill: "var(--color-accent)", opacity: 0.6 }}
            formatter={(value: number, name: string) => [value.toLocaleString(), name === "current" ? "This period" : "Previous period"]}
          />
          <Bar dataKey="current" name="current" fill={seriesColor(0)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar
            dataKey="previous"
            name="previous"
            fill="var(--color-muted)"
            stroke={MUTED_SERIES}
            strokeDasharray="4 3"
            strokeWidth={1.25}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
