import { AlertCircle, CheckCircle2, Image, MapPin, MessageSquareText } from "lucide-react";
import { MetricCard, Panel, ScoreIndicator, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, MetricSkeletonGrid, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import type { GbpHealthFactor, GbpOverviewData } from "@/lib/gbp/gbp-overview";
import { GbpNotConnectedState } from "@/components/layout/shared/feedback/empty-states";

function FactorStatus({ item }: { item: GbpHealthFactor }) {
  const tone = item.status === "complete" ? "success" : item.status === "attention" ? "warning" : "neutral";
  return <StatusBadge tone={tone}>{item.status === "complete" ? "Complete" : item.status === "attention" ? "Needs attention" : "Unavailable"}</StatusBadge>;
}

export function GbpOverviewLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading GBP overview">
      <MetricSkeletonGrid count={4} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <TableSkeleton rows={6} columns={2} />
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
    </div>
  );
}

export function GbpOverviewContent({ data, onRetry }: { data: GbpOverviewData; onRetry: () => void }) {
  if (data.status === "loading") return <GbpOverviewLoading />;
  if (data.status === "error") return <ErrorState title="GBP overview could not be loaded" description="We couldn't load this profile's current information. Try again without leaving the location." onRetry={onRetry} />;
  if (data.status === "disconnected") {
    return (
      <GbpNotConnectedState className="min-h-72" />
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="gbp-health-title">
        <h2 id="gbp-health-title" className="mb-3 text-sm font-semibold text-foreground">Profile health</h2>
        {data.healthScore === null ? (
          <Panel><p className="text-sm text-muted-foreground">A profile health score is unavailable for this location. Review the available factors below for current profile status.</p></Panel>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(240px,0.55fr)_minmax(0,1.45fr)]">
            <Panel title="Overall health" description="Based on available profile checks"><ScoreIndicator label={data.healthLabel ?? "Profile health"} score={data.healthScore} detail="Higher scores indicate more complete and consistent profile information." /></Panel>
            <Panel title="Health factors"><FactorList items={data.healthFactors} empty="No health factor details are available." /></Panel>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Panel title="Profile summary" description="Current information supplied by Google Business Profile">
          {data.profile.length === 0 ? <Unavailable text="Profile details are unavailable." /> : <dl className="divide-y divide-border">{data.profile.map((field) => <div key={field.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr]"><dt className="text-xs font-medium text-muted-foreground">{field.label}</dt><dd className="text-sm text-foreground">{field.value ?? "Unavailable"}</dd></div>)}</dl>}
        </Panel>
        <Panel title="Profile completeness" description="Information and assets that may need review"><FactorList items={data.completeness} empty="Completeness checks are unavailable." /></Panel>
      </div>

      <section aria-labelledby="gbp-signals-title">
        <h2 id="gbp-signals-title" className="mb-3 text-sm font-semibold text-foreground">Profile activity and local context</h2>
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard label="Average rating" value={data.reviews.averageRating?.toFixed(1) ?? "—"} caption={data.reviews.averageRating === null ? "Review rating unavailable" : "Current profile rating"} />
          <MetricCard label="Total reviews" value={data.reviews.total?.toLocaleString() ?? "—"} caption={data.reviews.unanswered === null ? "Reply status unavailable" : `${data.reviews.unanswered} awaiting a reply`} />
          <MetricCard label="Profile photos" value={data.media.photoCount?.toLocaleString() ?? "—"} caption={data.media.status ?? "Media information unavailable"} />
          <MetricCard label="Local Pack coverage" value={data.rankingContext.localPackCoverage === null ? "—" : `${data.rankingContext.localPackCoverage}%`} caption={data.rankingContext.detail ?? "Ranking context unavailable"} />
        </div>
      </section>

      <Panel title="Needs attention" description="Recommendations based only on current profile data">
        {data.actions.length === 0 ? <Unavailable text="No profile recommendations are available." /> : <div className="divide-y divide-border">{data.actions.map((action) => <div key={action.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /><div><p className="text-sm font-medium text-foreground">{action.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p></div></div>)}</div>}
      </Panel>
    </div>
  );
}

function FactorList({ items, empty }: { items: GbpHealthFactor[]; empty: string }) {
  if (items.length === 0) return <Unavailable text={empty} />;
  return <div className="divide-y divide-border">{items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{item.label}</p>{item.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p> : null}</div><FactorStatus item={item} /></div>)}</div>;
}

function Unavailable({ text }: { text: string }) {
  return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><AlertCircle className="size-4 shrink-0" aria-hidden />{text}</div>;
}