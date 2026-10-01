import { Link, generatePath } from "react-router-dom";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, FileBarChart, ListChecks, RefreshCw, TrendingUp, Users } from "lucide-react";
import { isApiError, type LocationOverview, type Unavailable } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, TrendIndicator } from "@/components/layout/shared/data-display";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { useLocationOverview } from "@/lib/locations/use-locations";
import { useRequiredParams } from "@/hooks/use-required-params";
import { centerDescription } from "@/lib/rankings/format";

const description =
  "Everything tracked for this location: rankings, Google Business Profile health, citations, competitors and reports.";

const modules: { label: string; to: string; icon: typeof TrendingUp; summary: string }[] = [
  { label: "Rankings", to: "/locations/:locationId/rankings", icon: TrendingUp, summary: "Keyword positions, keyword groups, map rankings and the local search grid." },
  { label: "GBP", to: "/locations/:locationId/gbp", icon: Building2, summary: "Profile performance, search terms, the GBP Score and competitor comparison." },
  { label: "Citations", to: "/locations/:locationId/citations", icon: ListChecks, summary: "Directory listings, NAP consistency, duplicates and missing listings." },
  { label: "Competitors", to: "/locations/:locationId/competitors", icon: Users, summary: "Local competitors tracked against this location." },
  { label: "Reports", to: "/locations/:locationId/reports", icon: FileBarChart, summary: "Reports generated or scheduled for this location." },
];

/** Copy for a section's `{ available: false, reason }`. */
const UNAVAILABLE_COPY: Record<string, string> = {
  no_keywords: "No keywords yet.",
  no_ranking_data: "No ranking run has finished yet.",
  gbp_not_connected: "Google Business Profile isn't connected.",
  no_report: "No report yet; it's generated after the first sync.",
  no_competitors: "No competitors tracked.",
  v4_access_pending: "Waiting for Google to grant review access.",
};

function unavailableText(section: Unavailable) {
  return UNAVAILABLE_COPY[section.reason] ?? "Not available yet.";
}

function LocationOverviewPage() {
  const { locationId } = useRequiredParams("locationId");
  const overview = useLocationOverview(locationId);

  if (overview.isPending) {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  if (overview.isError) {
    const notFound = isApiError(overview.error) && overview.error.status === 404;
    return (
      <AppShell>
        {notFound ? (
          <EmptyState
            title="Location not found"
            description="This location isn't available. Choose one from your locations list."
            action={
              <Button asChild variant="outline">
                <Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState description="We couldn't load this location. Try again without leaving this page." onRetry={() => void overview.refetch()} />
        )}
      </AppShell>
    );
  }

  const data = overview.data;
  const reviews = data.reviews.available ? data.reviews : null;

  return (
    <AppShell>
      <LocationHeader
        location={{
          id: data.location_id,
          ...(data.client ? { clientId: data.client.client_id } : {}),
          businessName: data.name,
          area: [data.city, data.state, data.country].filter(Boolean).join(", "),
          ...(reviews?.rating != null ? { rating: reviews.rating } : {}),
          ...(reviews?.count != null ? { reviewCount: reviews.count } : {}),
        }}
      />
      <LocationNavigation locationId={data.location_id} activeSection="overview" />
      <PageHeader
        title="Location Overview"
        description={description}
        meta={centerDescription(data.center) ? <p className="text-xs text-muted-foreground">{centerDescription(data.center)} — rankings are measured from here.</p> : undefined}
      />

      <StatusBanner location={data} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <RankingsSummary data={data} />
        <GbpSummary data={data} />
        <PerformanceSummary data={data} />
        <ReviewsSummary data={data} />
        <CompetitorsSummary data={data} />
      </div>
      {data.attribution ? (
        <p className="-mt-4 mb-6 text-[11px] text-muted-foreground">Ratings, reviews and competitor names: {data.attribution.text}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.label}
              to={generatePath(module.to, { locationId: data.location_id })}
              className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="size-4 text-brand-soft" aria-hidden />
                {module.label}
                <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <p className="mt-2 text-sm text-muted-foreground">{module.summary}</p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

function StatusBanner({ location }: { location: LocationOverview }) {
  const { connect } = useGbpConnect();
  if (location.status === "setup_required") {
    return (
      <Alert className="mb-6">
        <ListChecks aria-hidden />
        <AlertTitle>Setup isn't finished</AlertTitle>
        <AlertDescription>
          <p>Add keywords and competitors to start tracking this location.</p>
          <Button asChild size="sm" className="mt-3">
            <Link to={locationSetupPath(location.location_id)}>Continue setup</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (location.status === "gbp_disconnected") {
    return (
      <Alert className="mb-6 border-warning/40 bg-warning-surface/40">
        <AlertTriangle aria-hidden />
        <AlertTitle>Google Business Profile disconnected</AlertTitle>
        <AlertDescription>
          <p>
            This location's profile was unbound{location.gbp_disconnected_at ? ` on ${new Date(location.gbp_disconnected_at).toLocaleDateString()}` : ""}.
            Rankings keep working, but profile data, reviews and posts no longer update.
          </p>
          <Button size="sm" className="mt-3" onClick={() => connect()}>
            <RefreshCw aria-hidden /> Connect GBP again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (location.status === "reconnect_required") {
    return (
      <Alert className="mb-6 border-critical/25 bg-critical-surface/40">
        <AlertTriangle aria-hidden />
        <AlertTitle>Google access needs to be restored</AlertTitle>
        <AlertDescription>
          <p>Google refused the stored access for this location's account, so profile data has stopped syncing.</p>
          <Button size="sm" className="mt-3" onClick={() => connect()}>
            <RefreshCw aria-hidden /> Reconnect Google
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}

function Summary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel title={title}>
      <div className="min-h-16 space-y-1">{children}</div>
    </Panel>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;
const Big = ({ children }: { children: ReactNode }) => <p className="text-2xl font-semibold tabular text-foreground">{children}</p>;

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function percent(change: number | null) {
  return change == null ? null : `${Math.abs(change * 100).toFixed(1)}%`;
}

function RankingsSummary({ data }: { data: LocationOverview }) {
  const section = data.rankings;
  if (!section.available) return <Summary title="Average rank"><Muted>{unavailableText(section)}</Muted></Summary>;
  const change = section.change;
  return (
    <Summary title="Average rank">
      <Big>{section.overall_avg_rank == null ? "—" : section.overall_avg_rank.toFixed(1)}</Big>
      {change != null ? (
        // `change` is previous − current: positive means improved.
        <TrendIndicator direction={change > 0 ? "up" : change < 0 ? "down" : "flat"} value={Math.abs(change).toFixed(1)} positive={change > 0} />
      ) : null}
      <Muted>
        {section.keywords} keyword{section.keywords === 1 ? "" : "s"}
        {formatDate(section.run_at) ? ` · last run ${formatDate(section.run_at)}` : ""}
      </Muted>
    </Summary>
  );
}

function GbpSummary({ data }: { data: LocationOverview }) {
  const section = data.gbp;
  if (!section.available) return <Summary title="GBP score"><Muted>{unavailableText(section)}</Muted></Summary>;
  return (
    <Summary title="GBP score">
      <Big>
        {section.score == null ? "—" : section.score}
        {section.grade ? <span className="ml-2 text-base font-medium text-muted-foreground">{section.grade}</span> : null}
      </Big>
      {section.partial ? <Muted>Some pillars aren't scored yet.</Muted> : null}
      {section.top_fixes.length > 0 ? <Muted>Top fix: {section.top_fixes[0]!.label}</Muted> : null}
    </Summary>
  );
}

function PerformanceSummary({ data }: { data: LocationOverview }) {
  const section = data.performance;
  if (!section.available) return <Summary title="Profile performance"><Muted>{unavailableText(section)}</Muted></Summary>;
  const impressionsChange = percent(section.impressions_change);
  return (
    <Summary title={`Profile performance (${section.range})`}>
      <Big>{section.impressions == null ? "—" : section.impressions.toLocaleString()}</Big>
      <Muted>
        impressions{impressionsChange ? ` (${(section.impressions_change ?? 0) >= 0 ? "+" : "−"}${impressionsChange})` : ""}
      </Muted>
      <Muted>{section.actions == null ? "—" : section.actions.toLocaleString()} actions (calls, website, directions)</Muted>
    </Summary>
  );
}

function ReviewsSummary({ data }: { data: LocationOverview }) {
  const section = data.reviews;
  if (!section.available) return <Summary title="Reviews"><Muted>{unavailableText(section)}</Muted></Summary>;
  return (
    <Summary title="Reviews">
      <Big>{section.rating == null ? "—" : section.rating.toFixed(1)}</Big>
      <Muted>
        {section.count == null ? "—" : section.count.toLocaleString()} reviews
        {section.unreplied != null ? ` · ${section.unreplied} unreplied` : ""}
      </Muted>
    </Summary>
  );
}

function CompetitorsSummary({ data }: { data: LocationOverview }) {
  const section = data.competitors;
  if (!section.available) return <Summary title="Competitors"><Muted>{unavailableText(section)}</Muted></Summary>;
  return (
    <Summary title="Competitors">
      <Big>{section.public_score == null ? "—" : section.public_score}</Big>
      <Muted>your public score · {section.tracked} tracked, {section.compared} compared</Muted>
      {section.best_competitor ? (
        <Muted>
          Strongest: {section.best_competitor.name}
          {section.best_competitor.public_score != null ? ` (${section.best_competitor.public_score})` : ""}
        </Muted>
      ) : null}
    </Summary>
  );
}

export default LocationOverviewPage;
