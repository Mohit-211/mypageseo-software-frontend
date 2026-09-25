import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, MessageSquareWarning, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  MetricCard,
  Panel,
  ScoreIndicator,
  SectionHeader,
  StatusBadge,
  TrendIndicator,
  healthTone,
} from "@/components/mypageseo/data-display";
import { EmptyState, MetricSkeletonGrid } from "@/components/mypageseo/states";
import type {
  AgencyDashboard,
  BusinessDashboard,
  MetricPoint,
  RecommendedAction,
} from "@/lib/mypageseo/dashboard-data";

/* ---------------------------------- utils --------------------------------- */

function formatChange(change: number, suffix = "") {
  const abs = Math.abs(change);
  return `${abs.toFixed(abs < 10 ? 1 : 0)}${suffix}`;
}

function MetricTrend({
  metric,
  suffix = "",
  lowerIsBetter = false,
}: {
  metric: MetricPoint;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  if (metric.change === undefined) return null;
  const direction = metric.change > 0 ? "up" : metric.change < 0 ? "down" : "flat";
  const positive = lowerIsBetter ? metric.change < 0 : metric.change > 0;
  return (
    <TrendIndicator direction={direction} value={formatChange(metric.change, suffix)} positive={positive} />
  );
}

const severityTone = {
  critical: "critical",
  attention: "warning",
  info: "neutral",
} as const;

const severityLabel = {
  critical: "Critical",
  attention: "Needs attention",
  info: "Recommended",
} as const;

/* ------------------------------ shared sections ---------------------------- */

export function RecommendedActions({ actions }: { actions: RecommendedAction[] }) {
  if (actions.length === 0) {
    return (
      <section>
        <SectionHeader
          title="Recommended actions"
          description="Prioritised from current issues and changes"
        />
        <div className="rounded-lg border border-border bg-success-surface/50 px-4 py-6">
          <p className="text-sm font-medium text-foreground">Nothing needs attention right now</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Rankings, profile health, reviews and citations are all within their expected range for
            this period.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="Recommended actions"
        description="Prioritised from current issues and changes"
      />
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <div className="hidden grid-cols-[132px_minmax(260px,1fr)_160px] border-b border-border bg-surface-strong px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Priority</span>
          <span>Recommended next step</span>
          <span className="text-right">Action</span>
        </div>
        <ul className="divide-y divide-border">
        {actions.map((action) => (
          <li
            key={action.id}
            className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35 sm:grid-cols-[132px_minmax(260px,1fr)_160px] sm:items-center"
          >
            <StatusBadge tone={severityTone[action.severity]} className="w-fit">
              {severityLabel[action.severity]}
            </StatusBadge>
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground">{action.title}</span>
              <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit shrink-0 sm:justify-self-end">
              <Link to={action.to}>
                {action.actionLabel}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </li>
        ))}
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------- business dashboard -------------------------- */

export function BusinessDashboardView({ data }: { data: BusinessDashboard }) {
  const { rankMovement } = data;
  const rankValues = data.rankSeries.flatMap((p) =>
    [p.averageRank, p.previousAverageRank].filter((v): v is number => typeof v === "number"),
  );
  const rankLow = rankValues.length > 0 ? Math.min(...rankValues) : 1;
  const rankHigh = rankValues.length > 0 ? Math.max(...rankValues) : 10;
  const rankDomain: [number, number] = [
    Math.max(1, Math.floor(rankLow - 1)),
    Math.ceil(rankHigh + 1),
  ];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader title="Performance summary" description={data.comparisonLabel} />
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-border">
          <MetricCard
            label="Local Visibility" accent="brand"
            value={data.visibilityScore.value}
            trend={<MetricTrend metric={data.visibilityScore} suffix=" pts" />}
            caption="Share of local pack presence"
          />
          <MetricCard
            label="Average Rank" accent="teal"
            value={data.averageRank.value.toFixed(1)}
            trend={<MetricTrend metric={data.averageRank} lowerIsBetter />}
            caption={`${rankMovement.tracked} keywords tracked`}
          />
          <MetricCard
            label="GBP Health" accent="green"
            value={data.gbpHealth.value}
            trend={<MetricTrend metric={data.gbpHealth} suffix=" pts" />}
            caption="Profile completeness and issues"
          />
          <MetricCard
            label="Review Rating" accent="amber"
            value={
              <span className="inline-flex items-center gap-1.5">
                {data.reviewRating.value.toFixed(1)}
                <Star className="size-4 text-warning" aria-hidden />
              </span>
            }
            trend={<MetricTrend metric={data.reviewRating} />}
            caption={`${data.reviewCount.toLocaleString()} reviews`}
          />
          <MetricCard
            label="Citation Health" accent="clay"
            value={data.citationHealth.value}
            trend={<MetricTrend metric={data.citationHealth} suffix=" pts" />}
            caption="Directory accuracy"
          />
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="min-w-0">
          <SectionHeader
            title="What changed"
            description="Ranking movement across tracked keywords"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/rankings/keywords">
                  View rankings <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
          <div className="rounded-lg border border-border bg-surface shadow-card">
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-surface-strong">
              <MovementStat label="Improved" value={rankMovement.improved} tone="success" />
              <MovementStat label="Declined" value={rankMovement.declined} tone="critical" />
              <MovementStat label="Unchanged" value={rankMovement.unchanged} tone="neutral" />
            </div>
          {data.rankSeries.length > 0 ? (
              <div className="p-4">
                <ChartContainer
                  title="Average rank over time"
                  description="Lower is better. Dotted line is the previous period."
                  height={240}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.rankSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    reversed
                    domain={rankDomain}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(1),
                      name === "averageRank" ? "This period" : "Previous period",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="previousAverageRank"
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageRank"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                  />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
          ) : (
            <EmptyState
              title="No ranking history yet"
              description="Ranking history appears after the first scheduled collection for this location."
              className="m-4"
            />
          )}
          </div>
        </section>

        <AttentionSummary data={data} />
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section>
          <SectionHeader
            title="GBP health"
            description="What is driving the profile health score"
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to="/gbp/audit">
                  Open audit <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
          <div className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  GBP Health Score
                </p>
                <p className="mt-1 text-2xl font-semibold tabular text-foreground">
                  {data.gbpHealth.value}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
                </p>
              </div>
              <StatusBadge
                tone={
                  healthTone(data.gbpHealth.value) === "healthy"
                    ? "success"
                    : healthTone(data.gbpHealth.value) === "attention"
                      ? "warning"
                      : "critical"
                }
              >
                {data.gbpFactors.filter((f) => f.status !== "healthy").length} areas need work
              </StatusBadge>
            </div>
            <ul className="grid gap-4 p-4 sm:grid-cols-2">
              {data.gbpFactors.map((factor) => (
                <li key={factor.label}>
                  <ScoreIndicator
                    label={factor.label}
                    score={factor.score}
                    detail={factor.detail}
                    tone={factor.status}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="min-w-0 flex flex-col gap-8">
          <div>
            <SectionHeader
              title="Reviews and reputation"
              description="Recent review activity for this location"
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link to="/gbp/reviews">
                    Open reviews <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
            <div className="rounded-lg border border-border bg-surface">
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
                <Stat label="Rating" value={data.reviewRating.value.toFixed(1)} />
                <Stat label="Total reviews" value={data.reviewCount.toLocaleString()} />
                <Stat label="Last 30 days" value={`+${data.reviews.last30Days}`} />
                <Stat
                  label="Avg. response"
                  value={
                    data.reviews.averageResponseHours === null
                      ? "—"
                      : `${data.reviews.averageResponseHours}h`
                  }
                />
              </div>
              <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={data.reviews.unanswered > 0 ? "warning" : "success"}>
                      {data.reviews.unanswered} unanswered
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.reviews.unanswered > 0
                      ? "Unanswered reviews reduce response rate and reputation signals."
                      : "Every review has received a response."}
                  </p>
                </div>
                {data.reviews.unanswered > 0 ? (
                  <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
                    <Link to="/gbp/reviews">Respond to reviews</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <SectionHeader
              title="Competitor context"
              description="Your position against tracked competitors"
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link to="/competitors">
                    View competitors <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
            {data.competitors.length > 1 ? (
              <div
                role="region"
                aria-label="Competitor comparison"
                tabIndex={0}
                className="overflow-x-auto rounded-lg border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">
                    Competitor comparison by average rank, rating, reviews and photos
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium">Business</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Avg. rank</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Rating</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Reviews</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Photos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.competitors.map((row) => (
                      <tr key={row.name} className={row.isYou ? "bg-accent/50" : undefined}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-foreground">{row.name}</span>
                          {row.isYou ? (
                            <span className="ml-2 text-xs text-muted-foreground">You</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{row.averageRank.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{row.rating.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{row.reviews.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular">{row.photos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No competitors tracked"
                description="Add competitors to compare rank, rating, review volume and photo counts against your location."
                action={
                  <Button asChild size="sm">
                    <Link to="/competitors">Add competitors</Link>
                  </Button>
                }
              />
            )}
          </div>
        </section>
      </div>

      <RecommendedActions actions={data.actions} />
    </div>
  );
}

function MovementStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "critical" | "neutral";
}) {
  const color =
    tone === "success" ? "text-success" : tone === "critical" ? "text-critical" : "text-foreground";
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular ${color}`}>{value}</p>
    </div>
  );
}

function AttentionSummary({ data }: { data: BusinessDashboard }) {
  const factors = data.gbpFactors.filter((factor) => factor.status !== "healthy");
  const topFactors = factors.slice(0, 2);

  return (
    <section>
      <SectionHeader title="Needs attention" description="Issues affecting this location" />
      <div className="rounded-lg border border-border bg-surface shadow-card">
        <ul className="divide-y divide-border">
          {topFactors.map((factor) => (
            <li key={factor.label} className="flex gap-3 px-4 py-3.5">
              <span className={factor.status === "critical" ? "text-critical" : "text-warning-foreground"}>
                <AlertTriangle className="mt-0.5 size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{factor.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{factor.detail}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-3 px-4 py-3.5">
            <span className={data.reviews.unanswered > 0 ? "text-warning-foreground" : "text-success"}>
              <MessageSquareWarning className="mt-0.5 size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Review responses</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.reviews.unanswered > 0
                  ? `${data.reviews.unanswered} reviews are waiting for a response.`
                  : "Every review has received a response."}
              </p>
            </div>
          </li>
        </ul>
        <div className="border-t border-border px-4 py-3">
          <Button asChild variant="link" size="sm" className="h-auto justify-start p-0">
            <Link to="/gbp/audit">
              Review all findings <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-foreground">{value}</p>
    </div>
  );
}

/* ------------------------------ agency dashboard --------------------------- */

export function AgencyDashboardView({ data }: { data: AgencyDashboard }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeader title="Portfolio summary" description={data.comparisonLabel} />
        <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard label="Clients" accent="brand" value={data.clientCount} caption="Active in this workspace" />
          <MetricCard label="Locations" accent="teal" value={data.locationCount} caption="Across all clients" />
          <MetricCard
            label="Avg. Visibility" accent="green"
            value={data.averageVisibility.value}
            trend={<MetricTrend metric={data.averageVisibility} suffix=" pts" />}
            caption="Portfolio average"
          />
          <MetricCard
            label="Avg. GBP Health" accent="clay"
            value={data.averageGbpHealth.value}
            trend={<MetricTrend metric={data.averageGbpHealth} suffix=" pts" />}
            caption="Portfolio average"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Needs attention" description="Where to act across the portfolio" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionCard
            label="Locations declining"
            value={data.attention.decliningLocations}
            tone="critical"
            caption="Visibility down this period"
            to="/rankings/keywords"
            action="Inspect rankings"
          />
          <AttentionCard
            label="Unanswered reviews"
            value={data.attention.unansweredReviews}
            tone="warning"
            caption="Across all client locations"
            to="/gbp/reviews"
            action="Open reviews"
          />
          <AttentionCard
            label="GBP issues"
            value={data.attention.gbpIssues}
            tone="warning"
            caption="Open audit findings"
            to="/gbp/audit"
            action="Open audit"
          />
          <Panel className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Report status
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge tone="success">{data.attention.reports.ready} ready</StatusBadge>
                <StatusBadge tone="neutral">{data.attention.reports.scheduled} scheduled</StatusBadge>
                <StatusBadge tone="critical">{data.attention.reports.failed} failed</StatusBadge>
              </div>
            </div>
            <Button asChild variant="link" size="sm" className="mt-3 h-auto justify-start p-0">
              <Link to="/reports">
                Open reports <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </Panel>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Portfolio"
          description="Client locations by visibility and open work"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/clients">
                Manage clients <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        />
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 text-right font-medium">Visibility</th>
                <th className="px-4 py-2.5 text-right font-medium">Trend</th>
                <th className="px-4 py-2.5 text-right font-medium">GBP health</th>
                <th className="px-4 py-2.5 text-right font-medium">Unanswered</th>
                <th className="px-4 py-2.5 text-right font-medium">Issues</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.portfolio.map((row) => (
                <tr key={row.locationId} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link to="/clients" className="font-medium text-foreground hover:underline">
                      {row.clientName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-foreground">{row.locationName}</span>
                    <span className="block text-xs text-muted-foreground">{row.area}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{row.visibility}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <TrendIndicator
                        direction={
                          row.visibilityChange > 0 ? "up" : row.visibilityChange < 0 ? "down" : "flat"
                        }
                        value={formatChange(row.visibilityChange, " pts")}
                        positive={row.visibilityChange > 0}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{row.gbpHealth}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {row.unansweredReviews > 0 ? (
                      <span className="text-warning-foreground">{row.unansweredReviews}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {row.openIssues > 0 ? (
                      <span className="text-critical">{row.openIssues}</span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/locations">Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RecommendedActions actions={data.actions} />
    </div>
  );
}

function AttentionCard({
  label,
  value,
  caption,
  tone,
  to,
  action,
}: {
  label: string;
  value: number;
  caption: string;
  tone: "critical" | "warning";
  to: "/rankings/keywords" | "/gbp/reviews" | "/gbp/audit";
  action: string;
}) {
  return (
    <Panel className="flex flex-col justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={`mt-2 text-2xl font-semibold tabular ${
            value === 0 ? "text-foreground" : tone === "critical" ? "text-critical" : "text-warning-foreground"
          }`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </div>
      <Button asChild variant="link" size="sm" className="mt-3 h-auto justify-start p-0">
        <Link to={to}>
          {action} <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </Panel>
  );
}

/* --------------------------------- loading -------------------------------- */

export function DashboardSkeleton({ agency = false }: { agency?: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <MetricSkeletonGrid count={agency ? 4 : 5} />
      <div className="rounded-lg border border-border bg-surface p-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-4 h-[220px] w-full" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
