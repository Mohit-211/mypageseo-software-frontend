import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLine, Eye, Globe, MousePointerClick, Navigation, Phone, Table2, type LucideIcon } from "lucide-react";
import type { GbpRange, PerformanceSection, PerformanceTotals } from "@/api";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { axisProps, gridProps, seriesColor, tooltipProps } from "@/lib/chart-theme";
import { formatDate, formatShortDate } from "@/lib/datetime";
import { changeTrend, formatPercentChange, RANGE_PREVIOUS } from "@/lib/gbp/gbp-labels";
import { cn } from "@/lib/utils";

type MetricKey = keyof PerformanceTotals;
type DayRow = PerformanceSection["by_day"][number];

/** One plotted series: the metric, its name and its fixed chart slot (0-based). */
type Series = { key: MetricKey; label: string; slot: number };

/** Profile views by where they happened: Maps is slot 1, Search slot 2. */
const VIEW_SERIES: Series[] = [
  { key: "maps", label: "Google Maps", slot: 0 },
  { key: "search", label: "Google Search", slot: 1 },
];

/** The three actions that matter most: Calls slot 1, Website slot 2, Directions slot 3. */
const ACTION_SERIES: Series[] = [
  { key: "calls", label: "Calls", slot: 0 },
  { key: "website_clicks", label: "Website clicks", slot: 1 },
  { key: "direction_requests", label: "Direction requests", slot: 2 },
];

// Module tones whose colour is chart slot 1, 2 and 3, so an action tile's icon matches its line.
const SLOT_TONE: ModuleTone[] = ["rankings", "gbp", "keywords"];

const NUMBER = new Intl.NumberFormat();
const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Axis ticks: in full under 10,000, compact above ("12K"). */
function tickNumber(value: number, max: number): string {
  return max >= 10_000 ? COMPACT.format(value) : NUMBER.format(value);
}

/* -------------------------------------------------------------------------- */
/* KPI tiles                                                                   */
/* -------------------------------------------------------------------------- */

function changeHint(data: PerformanceSection, metric: MetricKey, range: GbpRange) {
  const previous = data.previous_period?.change[metric];
  const lastYear = formatPercentChange(data.same_period_last_year?.change[metric]);
  return (
    <>
      <span className="block">{previous == null ? "No earlier period to compare yet" : `vs ${RANGE_PREVIOUS[range]}`}</span>
      {lastYear ? <span className="block">{lastYear} vs last year</span> : null}
    </>
  );
}

function trendOf(data: PerformanceSection, metric: MetricKey) {
  const trend = changeTrend(data.previous_period?.change[metric]);
  return trend ?? undefined;
}

/** The headline numbers: views, all actions, then calls, website clicks and direction requests. */
export function PerformanceKpis({ data, range }: { data: PerformanceSection; range: GbpRange }) {
  const t = data.totals;
  const tiles: { metric: MetricKey; label: string; icon: LucideIcon; tone: ModuleTone; value: number; extra?: string; className?: string }[] = [
    { metric: "impressions", label: "Profile views", icon: Eye, tone: "brand", value: t.impressions, className: "col-span-2 md:col-span-1" },
    {
      metric: "actions",
      label: "Customer actions",
      icon: MousePointerClick,
      tone: "brand",
      value: t.actions,
      ...(data.actions_per_1000_impressions == null ? {} : { extra: `${data.actions_per_1000_impressions.toFixed(1)} per 1,000 views` }),
    },
    ...ACTION_SERIES.map((series) => ({
      metric: series.key,
      label: series.label,
      icon: series.key === "calls" ? Phone : series.key === "website_clicks" ? Globe : Navigation,
      tone: SLOT_TONE[series.slot] ?? "gbp",
      value: t[series.key] ?? 0,
    })),
  ];

  return (
    <section aria-label="Profile performance" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => {
        const trend = trendOf(data, tile.metric);
        return (
          <KpiTile
            key={tile.metric}
            label={tile.label}
            icon={tile.icon}
            tone={tile.tone}
            value={NUMBER.format(tile.value)}
            {...(trend ? { trend } : {})}
            hint={
              <>
                {tile.extra ? <span className="block font-medium text-foreground">{tile.extra}</span> : null}
                {changeHint(data, tile.metric, range)}
              </>
            }
            {...(tile.className ? { className: tile.className } : {})}
          />
        );
      })}
    </section>
  );
}

/** Messages, bookings and food orders, only when the profile had any. */
export function ExtraActions({ data }: { data: PerformanceSection }) {
  const extra: { key: MetricKey; label: string }[] = [
    { key: "conversations", label: "messages" },
    { key: "bookings", label: "bookings" },
    { key: "food_orders", label: "food orders" },
    { key: "food_menu_clicks", label: "menu clicks" },
  ];
  const shown = extra.filter((entry) => (data.totals[entry.key] ?? 0) > 0);
  if (shown.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Also from your profile:</span>
      {shown.map((entry) => (
        <span key={entry.key} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground">
          <span className="tabular-nums">{NUMBER.format(data.totals[entry.key] ?? 0)}</span> {entry.label}
        </span>
      ))}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

/** Legend with the period total of each series; text stays ink, the key carries the colour. */
function SeriesLegend({ series, totals, shape }: { series: Series[]; totals: Partial<PerformanceTotals>; shape: "area" | "line" }) {
  const sum = series.reduce((acc, entry) => acc + (totals[entry.key] ?? 0), 0);
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
      {series.map((entry) => {
        const value = totals[entry.key] ?? 0;
        return (
          <li key={entry.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("shrink-0", shape === "area" ? "size-2.5 rounded-[3px]" : "h-0.5 w-3.5 rounded-full")}
              style={{ background: seriesColor(entry.slot) }}
            />
            <span className="text-muted-foreground">{entry.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{NUMBER.format(value)}</span>
            {shape === "area" && sum > 0 ? <span className="text-xs text-muted-foreground">({Math.round((value / sum) * 100)}%)</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

type TooltipEntry = { dataKey?: unknown; value?: unknown };

/** Hover readout: the date, then every series (value first) with a short line key; plus the total when stacked. */
function SeriesTooltip({
  active,
  label,
  payload,
  series,
  stacked,
}: {
  active?: boolean | undefined;
  label?: unknown;
  payload?: readonly TooltipEntry[] | undefined;
  series: Series[];
  stacked: boolean;
}) {
  if (!active || !payload?.length) return null;
  const valueOf = (key: MetricKey) => {
    const entry = payload.find((item) => item.dataKey === key);
    return typeof entry?.value === "number" ? entry.value : 0;
  };
  const total = series.reduce((acc, entry) => acc + valueOf(entry.key), 0);
  return (
    <div className="min-w-40 rounded-[10px] border border-border bg-card px-3 py-2 text-xs shadow-raised">
      <p className="mb-1.5 font-medium text-muted-foreground">{formatDate(String(label))}</p>
      <ul className="space-y-1">
        {series.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: seriesColor(entry.slot) }} />
            <span className="font-semibold tabular-nums text-foreground">{NUMBER.format(valueOf(entry.key))}</span>
            <span className="text-muted-foreground">{entry.label}</span>
          </li>
        ))}
      </ul>
      {stacked ? (
        <p className="mt-1.5 border-t border-border pt-1.5 text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{NUMBER.format(total)}</span> in total
        </p>
      ) : null}
    </div>
  );
}

/** The same numbers as the chart, newest day first, for reading exact values without hovering. */
function SeriesTable({ rows, series, caption }: { rows: DayRow[]; series: Series[]; caption: string }) {
  const newestFirst = [...rows].reverse();
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-strong">
          <tr className="border-b border-border-strong">
            <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date
            </th>
            {series.map((entry) => (
              <th key={entry.key} scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {newestFirst.map((row) => (
            <tr key={row.date}>
              <th scope="row" className="px-3 py-1.5 font-normal text-foreground">
                {formatDate(row.date)}
              </th>
              {series.map((entry) => (
                <td key={entry.key} className="px-3 py-1.5 text-right tabular-nums text-foreground">
                  {NUMBER.format(row[entry.key] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const VIEW_OPTIONS = [
  { value: "chart", label: "Chart", icon: ChartLine },
  { value: "table", label: "Table", icon: Table2 },
] as const;

/** A daily chart card: title, legend with totals, the chart (or its table) and a chart / table switch. */
function DailyChartCard({
  id,
  title,
  description,
  data,
  series,
  kind,
}: {
  id: string;
  title: string;
  description: string;
  data: PerformanceSection;
  series: Series[];
  kind: "stacked-area" | "lines";
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const rows = data.by_day;
  const max = rows.reduce((acc, row) => {
    const value = kind === "stacked-area" ? series.reduce((sum, entry) => sum + (row[entry.key] ?? 0), 0) : Math.max(...series.map((entry) => row[entry.key] ?? 0));
    return Math.max(acc, value);
  }, 0);
  const summary = `${title}, ${formatDate(data.start)} to ${formatDate(data.end)}: ${series
    .map((entry) => `${entry.label} ${NUMBER.format(data.totals[entry.key] ?? 0)}`)
    .join(", ")}.`;

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[15px] font-semibold leading-6 text-foreground">
            {title}
          </h2>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
        <SegmentedControl size="sm" aria-label={`Show ${title.toLowerCase()} as`} value={view} onValueChange={setView} options={VIEW_OPTIONS} />
      </div>
      <div className="space-y-3 p-4">
        <SeriesLegend series={series} totals={data.totals} shape={kind === "stacked-area" ? "area" : "line"} />
        {view === "table" ? (
          <SeriesTable rows={rows} series={series} caption={summary} />
        ) : (
          <div className="h-60 w-full" role="img" aria-label={summary}>
            <ResponsiveContainer width="100%" height="100%">
              {kind === "stacked-area" ? (
                <AreaChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={(value: string) => formatShortDate(value)} minTickGap={28} />
                  <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={(value: number) => tickNumber(value, max)} />
                  <Tooltip cursor={tooltipProps.cursor} content={(props) => <SeriesTooltip active={props.active} label={props.label} payload={props.payload} series={series} stacked />} />
                  {series.map((entry) => (
                    <Area
                      key={entry.key}
                      type="monotone"
                      dataKey={entry.key}
                      name={entry.label}
                      stackId="views"
                      stroke={seriesColor(entry.slot)}
                      strokeWidth={2}
                      fill={seriesColor(entry.slot)}
                      fillOpacity={0.12}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              ) : (
                <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tickFormatter={(value: string) => formatShortDate(value)} minTickGap={28} />
                  <YAxis {...axisProps} width={44} allowDecimals={false} tickFormatter={(value: number) => tickNumber(value, max)} />
                  <Tooltip cursor={tooltipProps.cursor} content={(props) => <SeriesTooltip active={props.active} label={props.label} payload={props.payload} series={series} stacked={false} />} />
                  {series.map((entry) => (
                    <Line
                      key={entry.key}
                      type="monotone"
                      dataKey={entry.key}
                      name={entry.label}
                      stroke={seriesColor(entry.slot)}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

/** Profile views per day (Maps and Search stacked) and customer actions per day, side by side. */
export function PerformanceCharts({ data }: { data: PerformanceSection }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DailyChartCard
        id="gbp-views-chart"
        title="Profile views"
        description="Times your profile was shown on Google Maps and Google Search, per day."
        data={data}
        series={VIEW_SERIES}
        kind="stacked-area"
      />
      <DailyChartCard
        id="gbp-actions-chart"
        title="Customer actions"
        description="Calls, website clicks and direction requests from your profile, per day."
        data={data}
        series={ACTION_SERIES}
        kind="lines"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Where people found you                                                      */
/* -------------------------------------------------------------------------- */

/** One whole split in two: a thin segmented bar (2px gap between parts) and a legend with shares. */
function SplitBar({ title, parts }: { title: string; parts: { label: string; value: number; slot: number }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const label = total
    ? `${title}: ${parts.map((part) => `${part.label} ${Math.round((part.value / total) * 100)}%`).join(", ")}`
    : `${title}: no views in this period`;
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No views in this period.</p>
      ) : (
        <>
          <div role="img" aria-label={label} className="mt-2.5 flex h-2 gap-0.5">
            {parts
              .filter((part) => part.value > 0)
              .map((part) => (
                <span key={part.label} className="h-full rounded-full" style={{ width: `${(part.value / total) * 100}%`, background: seriesColor(part.slot) }} />
              ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {parts.map((part) => (
              <li key={part.label} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: seriesColor(part.slot) }} />
                  <span className="truncate text-foreground">{part.label}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{NUMBER.format(part.value)}</span> · {Math.round((part.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Maps vs Search and mobile vs desktop for the period. */
export function WhereFound({ data, className }: { data: PerformanceSection; className?: string }) {
  return (
    <section aria-labelledby="gbp-where-title" className={cn("min-w-0 rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="border-b border-border px-4 py-3.5">
        <h2 id="gbp-where-title" className="text-[15px] font-semibold leading-6 text-foreground">
          Where people saw you
        </h2>
        <p className="text-[13px] text-muted-foreground">Share of profile views in this period.</p>
      </div>
      <div className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-1">
        <SplitBar
          title="Maps or Search"
          parts={[
            { label: "Google Maps", value: data.by_surface.maps, slot: 0 },
            { label: "Google Search", value: data.by_surface.search, slot: 1 },
          ]}
        />
        <SplitBar
          title="Phone or computer"
          parts={[
            { label: "Mobile", value: data.by_device.mobile, slot: 0 },
            { label: "Desktop", value: data.by_device.desktop, slot: 1 },
          ]}
        />
      </div>
    </section>
  );
}
