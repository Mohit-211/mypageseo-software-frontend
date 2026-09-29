import { useMemo } from "react";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { Star } from "lucide-react";
import { ChangeIndicator } from "@/components/ai-visibility/visibility-ui";
import { Panel } from "@/components/layout/shared/data-display";
import { Skeleton } from "@/components/ui/skeleton";
import { ratingDistribution, ratingTrend, type Review, type TrendBucket } from "@/lib/reviews/review-management";
import { StarRating } from "./review-ui";

function RatingTooltip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as TrendBucket | undefined;
  if (!active || !row || row.cumulativeRating === null) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-medium text-foreground">{format(new Date(row.start), "MMMM yyyy")}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">Average rating</dt>
        <dd className="text-right font-medium tabular text-foreground">{row.cumulativeRating.toFixed(1)} ★</dd>
        <dt className="text-muted-foreground">New reviews</dt>
        <dd className="text-right tabular text-foreground">{row.reviews}</dd>
      </dl>
    </div>
  );
}

/** A small line chart of the all-time average rating at the end of each month. */
export function RatingTrend({ reviews }: { reviews: Review[] }) {
  const rows = useMemo(() => ratingTrend(reviews).filter((r) => r.cumulativeRating !== null), [reviews]);
  const first = rows[0]?.cumulativeRating ?? null;
  const last = rows.at(-1)?.cumulativeRating ?? null;
  const values = rows.map((r) => r.cumulativeRating!);
  // Tight domain so real movement is visible, while staying on a 0.1-star grid.
  const domain: [number, number] = values.length
    ? [Math.max(1, Math.floor((Math.min(...values) - 0.1) * 10) / 10), Math.min(5, Math.ceil((Math.max(...values) + 0.1) * 10) / 10)]
    : [1, 5];
  const summary =
    first !== null && last !== null ? `Average rating moved from ${first.toFixed(1)} to ${last.toFixed(1)} over the last 12 months.` : "Not enough reviews to show a trend.";

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Rating Trend</h3>
        {first !== null && last !== null ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            12 months
            <ChangeIndicator value={Math.round((last - first) * 10) / 10} suffix="" />
          </span>
        ) : null}
      </div>
      <p className="sr-only">{summary}</p>
      <div className="h-48 w-full sm:h-56" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={16} />
            <YAxis
              domain={domain}
              tickCount={4}
              tickFormatter={(v: number) => v.toFixed(1)}
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<RatingTooltip />} />
            <Line type="monotone" dataKey="cumulativeRating" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function RatingOverview({
  reviews,
  averageRating,
  onSelectRating,
}: {
  reviews: Review[];
  averageRating: number | null;
  /** Shows the reviews with this star rating in the review list. */
  onSelectRating: (rating: number) => void;
}) {
  const distribution = useMemo(() => ratingDistribution(reviews), [reviews]);
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <Panel title="Rating Overview" description="Star rating distribution across all synced reviews">
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <p className="text-4xl font-semibold tabular text-foreground">{averageRating === null ? "—" : averageRating.toFixed(1)}</p>
            <div>
              {averageRating !== null ? <StarRating rating={averageRating} size="md" /> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                Based on {reviews.length.toLocaleString()} review{reviews.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-1" aria-label="Rating distribution">
            {distribution.map((row) => (
              <li key={row.rating}>
                <button
                  type="button"
                  onClick={() => onSelectRating(row.rating)}
                  disabled={row.count === 0}
                  className="group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.75rem] items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none"
                  aria-label={`${row.rating} star: ${row.count} reviews. Show these reviews`}
                >
                  <span className="inline-flex items-center gap-1 text-sm font-medium tabular text-foreground">
                    {row.rating}
                    <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-warning transition-[width]" style={{ width: `${(row.count / max) * 100}%` }} />
                  </span>
                  <span className="text-right text-sm tabular text-muted-foreground group-hover:text-foreground">{row.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <RatingTrend reviews={reviews} />
      </div>
    </Panel>
  );
}

export function RatingOverviewSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid gap-6 p-4 md:grid-cols-[5fr_7fr]">
        <div className="space-y-3">
          <Skeleton className="h-10 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        <Skeleton className="h-52 w-full" />
      </div>
    </div>
  );
}
