import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { DateRangeSelect } from "@/components/ai-visibility/ai-visibility-header";
import { ComparisonControl, Panel } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { SENTIMENT_COLOR, rangeBounds, trendBuckets, type DateRangeValue, type Review, type TrendBucket } from "@/lib/reviews/review-management";

type TrendMetric = "reviews" | "averageRating" | "positive" | "negative";

const METRICS: Record<TrendMetric, { label: string; color: string; format: (v: number) => string; domain: [number, number] | undefined }> = {
  reviews: { label: "Number of reviews", color: "var(--primary)", format: (v) => `${v}`, domain: undefined },
  averageRating: { label: "Average rating", color: "var(--warning)", format: (v) => `${v.toFixed(1)} ★`, domain: [1, 5] },
  positive: { label: "Positive sentiment", color: SENTIMENT_COLOR.positive, format: (v) => `${v}%`, domain: [0, 100] },
  negative: { label: "Negative sentiment", color: SENTIMENT_COLOR.negative, format: (v) => `${v}%`, domain: [0, 100] },
};

const METRIC_OPTIONS: { value: TrendMetric; label: string }[] = [
  { value: "reviews", label: "Reviews" },
  { value: "averageRating", label: "Avg Rating" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
];

function TrendTooltip({ active, payload, metric }: TooltipProps<number, string> & { metric: TrendMetric }) {
  const row = payload?.[0]?.payload as TrendBucket | undefined;
  if (!active || !row) return null;
  const value = row[metric];
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{row.label}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">{METRICS[metric].label}</dt>
        <dd className="text-right font-medium tabular text-foreground">{value === null ? "No reviews" : METRICS[metric].format(value)}</dd>
        {metric !== "reviews" ? (
          <>
            <dt className="text-muted-foreground">Reviews</dt>
            <dd className="text-right tabular text-foreground">{row.reviews}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

/** Review volume, rating and sentiment over time. Parents remount it (via `key`) to reset the range. */
export function ReviewTrends({ reviews, initialRange, analyzed }: { reviews: Review[]; initialRange: DateRangeValue; analyzed: boolean }) {
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [metric, setMetric] = useState<TrendMetric>("reviews");
  const bounds = useMemo(() => rangeBounds(range), [range]);
  const buckets = useMemo(() => trendBuckets(reviews, bounds), [reviews, bounds]);
  const config = METRICS[metric];
  const total = buckets.reduce((sum, b) => sum + b.reviews, 0);
  const needsAnalysis = !analyzed && (metric === "positive" || metric === "negative");
  const options = analyzed ? METRIC_OPTIONS : METRIC_OPTIONS.filter((o) => o.value === "reviews" || o.value === "averageRating");

  return (
    <Panel
      title="Review Trends"
      description="Review volume, rating and sentiment over time"
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="max-w-full overflow-x-auto">
            <ComparisonControl value={metric} options={options} onChange={setMetric} ariaLabel="Trend metric" />
          </div>
          <DateRangeSelect value={range} onChange={setRange} className="block w-full sm:w-auto" />
        </div>
      }
    >
      {total === 0 || needsAnalysis ? (
        <EmptyState
          compact
          title={needsAnalysis ? "Sentiment needs AI analysis" : "No reviews in this period"}
          description={needsAnalysis ? "Analyze your reviews to see sentiment over time." : "Choose a different date range to see review trends."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-foreground">
            {total.toLocaleString()} review{total === 1 ? "" : "s"} received in this period.
          </p>
          <div className="h-64 w-full sm:h-72" role="img" aria-label={`${config.label} over time`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
                <YAxis
                  {...(config.domain ? { domain: config.domain } : {})}
                  allowDecimals={metric === "averageRating"}
                  tickFormatter={(v: number) => (metric === "reviews" ? `${v}` : metric === "averageRating" ? v.toFixed(1) : `${v}%`)}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<TrendTooltip metric={metric} />} />
                {metric === "reviews" ? (
                  <Bar dataKey="reviews" fill={config.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
                ) : (
                  <Line type="monotone" dataKey={metric} stroke={config.color} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: config.color }} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

export function ReviewTrendsSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="p-4">
        <Skeleton className="h-4 w-60" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    </div>
  );
}
