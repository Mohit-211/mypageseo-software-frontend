import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  COMPETITOR_SOURCE_LABEL,
  type CompetitorDetailData,
  type MetricComparison,
} from "@/lib/competitors/competitors";
import { cn } from "@/lib/utils";

export function CompetitorDetailLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading competitor detail">
      <MetricSkeletonGrid count={4} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}

function formatMetric(value: number | null, unit: MetricComparison["unit"]) {
  if (value === null) return "—";
  if (unit === "percent") return `${value.toLocaleString()}%`;
  if (unit === "rating") return value.toFixed(1);
  if (unit === "position") return `#${value.toLocaleString()}`;
  return value.toLocaleString();
}

function difference(metric: MetricComparison) {
  if (metric.yours === null || metric.theirs === null) return null;
  const raw = metric.yours - metric.theirs;
  if (raw === 0) return { label: "Even", tone: "neutral" as const };
  const better = metric.lowerIsBetter ? raw < 0 : raw > 0;
  const magnitude = Math.abs(raw);
  return {
    label: `${better ? "+" : "−"}${formatMetric(magnitude, metric.unit === "position" ? "count" : metric.unit)}`,
    tone: better ? ("advantage" as const) : ("gap" as const),
  };
}

function ComparisonTable({ metrics, competitorName }: { metrics: MetricComparison[]; competitorName: string }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Metric</th>
            <th className="px-4 py-2 font-medium">Your business</th>
            <th className="px-4 py-2 font-medium">{competitorName}</th>
            <th className="px-4 py-2 font-medium">Difference</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            const delta = difference(metric);
            return (
              <tr key={metric.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{metric.label}</td>
                <td className="tabular px-4 py-2.5 text-foreground">{formatMetric(metric.yours, metric.unit)}</td>
                <td className="tabular px-4 py-2.5 text-foreground">{formatMetric(metric.theirs, metric.unit)}</td>
                <td className="px-4 py-2.5">
                  {delta === null ? (
                    <span className="text-muted-foreground">Unavailable</span>
                  ) : (
                    <span
                      className={cn(
                        "tabular text-sm font-medium",
                        delta.tone === "gap" ? "text-critical" : delta.tone === "advantage" ? "text-success" : "text-muted-foreground",
                      )}
                    >
                      {delta.label}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetricSection({
  title,
  description,
  metrics,
  competitorName,
  footer,
}: {
  title: string;
  description: string;
  metrics: MetricComparison[];
  competitorName: string;
  footer?: React.ReactNode;
}) {
  if (metrics.length === 0) return null;
  return (
    <Panel title={title} description={description}>
      <ComparisonTable metrics={metrics} competitorName={competitorName} />
      {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
    </Panel>
  );
}

export function CompetitorDetailContent({
  data,
  locationId,
  onRetry,
}: {
  data: CompetitorDetailData;
  locationId: string;
  onRetry: () => void;
}) {
  const [confirmUntrack, setConfirmUntrack] = useState(false);

  if (data.status === "loading") return <CompetitorDetailLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Competitor analysis could not be loaded"
        description="We couldn't load this competitor comparison. Try again without leaving the page."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "not_found" || !data.competitor) {
    return (
      <EmptyState
        title="Competitor record unavailable"
        description="No tracked or discovered competitor record exists for this address, so no comparison of rankings, reviews, citations, profile or website signals can be shown. Competitor tracking is not available in the current product integration."
        className="min-h-64"
        action={
          <Button asChild variant="outline">
            <Link to={`/locations/${locationId}/competitors`}>Back to competitors</Link>
          </Button>
        }
      />
    );
  }

  const competitor = data.competitor;
  const name = competitor.businessName;

  return (
    <div className="space-y-6">
      <section aria-labelledby="competitor-identity">
        <SectionHeader title="Competitor profile" description="Identifying information reported for this business" />
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            {competitor.source ? <StatusBadge tone="neutral">{COMPETITOR_SOURCE_LABEL[competitor.source]}</StatusBadge> : null}
            {data.lastUpdatedAt ? <span className="text-xs text-muted-foreground">Last updated {data.lastUpdatedAt}</span> : null}
          </div>
          <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
            {([
              ["Primary category", competitor.category],
              ["Area", competitor.area],
              ["Website", competitor.website],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {value ? (
                    label === "Website" ? (
                      <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                        {value} <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      value
                    )
                  ) : (
                    "Unavailable"
                  )}
                </dd>
              </div>
            ))}
            {competitor.score !== null ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Backend score</dt>
                <dd className="mt-0.5 text-sm text-foreground">
                  {competitor.score}
                  {competitor.scoreExplanation ? <span className="block text-xs text-muted-foreground">{competitor.scoreExplanation}</span> : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <MetricSection
        title="Comparison summary"
        description="Your business compared with this competitor across the metrics the workspace reports"
        metrics={data.metrics}
        competitorName={name}
      />

      {data.keywords.length > 0 ? (
        <Panel title="Ranking comparison" description="Tracked keywords where both businesses have ranking data">
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Keyword</th>
                  <th className="px-4 py-2 font-medium">Result type</th>
                  <th className="px-4 py-2 font-medium">Your position</th>
                  <th className="px-4 py-2 font-medium">Your movement</th>
                  <th className="px-4 py-2 font-medium">{name} position</th>
                  <th className="px-4 py-2 font-medium">{name} movement</th>
                  <th className="px-4 py-2 font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.keywords.map((row) => {
                  const yourMove = row.yourPosition !== null && row.yourPreviousPosition !== null ? row.yourPreviousPosition - row.yourPosition : null;
                  const theirMove = row.theirPosition !== null && row.theirPreviousPosition !== null ? row.theirPreviousPosition - row.theirPosition : null;
                  const gap = row.yourPosition !== null && row.theirPosition !== null ? row.yourPosition - row.theirPosition : null;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{row.keyword}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{row.resultType ?? "—"}</td>
                      <td className="tabular px-4 py-2.5 text-foreground">{row.yourPosition === null ? "—" : `#${row.yourPosition}`}</td>
                      <td className="tabular px-4 py-2.5"><Movement value={yourMove} /></td>
                      <td className="tabular px-4 py-2.5 text-foreground">{row.theirPosition === null ? "—" : `#${row.theirPosition}`}</td>
                      <td className="tabular px-4 py-2.5"><Movement value={theirMove} /></td>
                      <td className="tabular px-4 py-2.5">
                        {gap === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn("font-medium", gap > 0 ? "text-critical" : gap < 0 ? "text-success" : "text-muted-foreground")}>
                            {gap > 0 ? `${gap} behind` : gap < 0 ? `${Math.abs(gap)} ahead` : "Level"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <Button asChild variant="outline" size="sm">
              <Link to={`/locations/${locationId}/rankings/competitors`}>Open ranking competitors</Link>
            </Button>
          </div>
        </Panel>
      ) : null}

      <MetricSection title="Review comparison" description="Review volume and rating reported for both businesses" metrics={data.reviewMetrics} competitorName={name} />

      <MetricSection
        title="Citation comparison"
        description="Directory coverage and consistency differences"
        metrics={data.citationMetrics}
        competitorName={name}
        footer={
          <Button asChild variant="outline" size="sm">
            <Link to={`/locations/${locationId}/citations`}>Manage your citations</Link>
          </Button>
        }
      />

      <MetricSection
        title="Profile comparison"
        description="Google Business Profile signals reported for both businesses"
        metrics={data.gbpMetrics}
        competitorName={name}
        footer={
          <Button asChild variant="outline" size="sm">
            <Link to={`/locations/${locationId}/gbp/audit`}>Open your GBP audit</Link>
          </Button>
        }
      />

      <MetricSection title="Website comparison" description="Website-level signals reported for both businesses" metrics={data.websiteMetrics} competitorName={name} />

      {data.gaps.length > 0 ? (
        <Panel title="Competitive gaps" description="Measurable differences observed in the available data">
          <ul className="divide-y divide-border">
            {data.gaps.map((gap) => (
              <li key={gap.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", gap.tone === "gap" ? "bg-critical" : gap.tone === "advantage" ? "bg-success" : "bg-muted-foreground")}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{gap.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{gap.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {data.trend.length > 0 ? (
        <Panel title="Relative trend" description="Average position over the periods reported by the workspace">
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Period</th>
                  <th className="px-4 py-2 font-medium">Your average position</th>
                  <th className="px-4 py-2 font-medium">{name} average position</th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((point) => (
                  <tr key={point.period} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 text-foreground">{point.period}</td>
                    <td className="tabular px-4 py-2.5 text-foreground">{point.yourAveragePosition ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-foreground">{point.theirAveragePosition ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {data.capabilities.canEdit || data.capabilities.canUntrack ? (
        <div className="flex flex-wrap gap-2">
          {data.capabilities.canEdit ? <Button variant="outline" size="sm">Edit competitor</Button> : null}
          {data.capabilities.canUntrack ? (
            <Button variant="accent" size="sm" onClick={() => setConfirmUntrack(true)}>Stop tracking competitor</Button>
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Competitor management is not available in the current product integration, so this competitor can only be reviewed here.
        </p>
      )}

      <AlertDialog open={confirmUntrack} onOpenChange={setConfirmUntrack}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This competitor will no longer be compared with your location. You can track it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmUntrack(false)}>Stop tracking</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Movement({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) return <span className="text-muted-foreground">No change</span>;
  return (
    <span className={cn("font-medium", value > 0 ? "text-success" : "text-critical")}>
      {value > 0 ? `▲ ${value}` : `▼ ${Math.abs(value)}`}
    </span>
  );
}
