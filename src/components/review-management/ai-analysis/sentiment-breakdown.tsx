import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { DateRangeSelect } from "@/components/ai-visibility/ai-visibility-header";
import { ComparisonControl, Panel } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SENTIMENTS,
  SENTIMENT_COLOR,
  SENTIMENT_LABEL,
  rangeBounds,
  reviewsInBounds,
  sentimentShares,
  trendBuckets,
  type DateRangeValue,
  type Review,
  type ReviewSentiment,
  type TrendBucket,
} from "@/lib/reviews/review-management";
import { SentimentDot } from "../review-ui";

type SentimentFilter = ReviewSentiment | "all";

const FILTER_OPTIONS: { value: SentimentFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_LABEL[s] })),
];

function SentimentTooltip({ active, payload, shown }: TooltipProps<number, string> & { shown: ReviewSentiment[] }) {
  const row = payload?.[0]?.payload as TrendBucket | undefined;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{row.label}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {shown.map((s) => (
          <div key={s} className="contents">
            <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
              <SentimentDot sentiment={s} />
              {SENTIMENT_LABEL[s]}
            </dt>
            <dd className="text-right font-medium tabular text-foreground">{row[s] === null ? "—" : `${row[s]}%`}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Reviews</dt>
        <dd className="text-right tabular text-foreground">{row.reviews}</dd>
      </dl>
    </div>
  );
}

/** Sentiment shares for a date range, with how they changed over time. Parents remount it (via `key`) to reset the range. */
export function SentimentBreakdown({ reviews, initialRange }: { reviews: Review[]; initialRange: DateRangeValue }) {
  const [range, setRange] = useState<DateRangeValue>(initialRange);
  const [filter, setFilter] = useState<SentimentFilter>("all");
  const bounds = useMemo(() => rangeBounds(range), [range]);
  const inRange = useMemo(() => reviewsInBounds(reviews, bounds), [reviews, bounds]);
  const shares = useMemo(() => sentimentShares(inRange), [inRange]);
  const buckets = useMemo(() => trendBuckets(reviews, bounds), [reviews, bounds]);
  const counts = useMemo(
    () => Object.fromEntries(SENTIMENTS.map((s) => [s, inRange.filter((r) => r.analysis?.sentiment === s).length])) as Record<ReviewSentiment, number>,
    [inRange],
  );
  const shown = filter === "all" ? SENTIMENTS : [filter];

  return (
    <Panel
      title="Sentiment Breakdown"
      description="How customers felt, based on AI analysis"
      actions={<DateRangeSelect value={range} onChange={setRange} className="block w-full sm:w-auto" />}
      className="flex flex-col"
    >
      {!shares ? (
        <EmptyState compact title="No analyzed reviews in this period" description="Choose a different date range to see sentiment." />
      ) : (
        <>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Positive ${shares.positive}%, neutral ${shares.neutral}%, negative ${shares.negative}%`}>
            {SENTIMENTS.map((s) => (
              <span key={s} className="h-full" style={{ width: `${shares[s]}%`, background: SENTIMENT_COLOR[s] }} />
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {SENTIMENTS.map((s) => (
              <div key={s} className="min-w-0 rounded-md border border-border bg-surface-strong px-3 py-2">
                <dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SentimentDot sentiment={s} />
                  {SENTIMENT_LABEL[s]}
                </dt>
                <dd className="mt-0.5 text-xl font-semibold tabular text-foreground">{shares[s]}%</dd>
                <dd className="text-[11px] text-muted-foreground">
                  {counts[s]} review{counts[s] === 1 ? "" : "s"}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Sentiment Trend</h3>
            <ComparisonControl value={filter} options={FILTER_OPTIONS} onChange={setFilter} ariaLabel="Sentiment shown" />
          </div>
          <div className="mt-3 h-56 w-full" role="img" aria-label={`Share of ${filter === "all" ? "each sentiment" : SENTIMENT_LABEL[filter].toLowerCase() + " reviews"} over time`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<SentimentTooltip shown={shown} />} />
                {shown.map((s) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={SENTIMENT_COLOR[s]} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Panel>
  );
}

export function SentimentBreakdownSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="space-y-4 p-4">
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}
