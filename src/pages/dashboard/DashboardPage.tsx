import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getReports, type AgencyDashboard as LiveAgency, type BusinessDashboard as LiveBusiness } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { SectionErrorBoundary } from "@/components/layout/shared/feedback/failure-states";
import { AgencyDashboardView, BusinessDashboardView, DashboardSkeleton } from "@/components/dashboard/dashboard";
import { Button } from "@/components/ui/button";
import { toAgencyDashboard, toBusinessDashboard } from "@/lib/dashboard/dashboard-data";
import { useGbpReport } from "@/lib/gbp/use-gbp-report";
import { useRankTracker } from "@/lib/rankings/use-rankings";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * The dashboard. Live figures from `GET /dashboard`; for a business, the detail
 * panels (GBP health factors, competitors, review stats) also read the focus
 * location's GBP report and Rank Tracker.
 */
function DashboardPage() {
  const { organization, activeLocation, locations, status: workspaceStatus } = useWorkspace();
  const isAgency = organization?.accountType === "agency";
  const focus = activeLocation ?? locations[0] ?? null;

  const dashboard = useQuery({
    queryKey: ["dashboard", organization?.id ?? "none"],
    queryFn: ({ signal }) => getDashboard({ limit: 100 }, signal),
    enabled: Boolean(organization),
    // Figures change when runs, syncs and reports finish in the background.
    refetchInterval: 60_000,
  });

  const contextLabel = isAgency ? (organization?.name ?? "Portfolio") : (focus?.businessName ?? organization?.name ?? "Workspace");

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={
          isAgency
            ? "See portfolio performance, what changed, and where your team should act next."
            : "See how local search is performing, what changed, and what to act on next."
        }
        meta={
          <p className="text-xs text-muted-foreground">
            {contextLabel}
            {!isAgency && focus?.area ? ` · ${focus.area}` : ""}
          </p>
        }
      />

      {workspaceStatus === "ready" && locations.length === 0 ? (
        <EmptyState
          title="Connect a location to start"
          description="Mypageseo builds this dashboard from your Google Business Profile locations. Add or connect a location to see visibility, ranking movement, profile health, reviews and citation issues."
          action={<Button asChild size="sm"><Link to="/locations/add">Add a location</Link></Button>}
        />
      ) : workspaceStatus === "loading" || dashboard.isPending ? (
        <DashboardSkeleton agency={isAgency} />
      ) : dashboard.isError || !dashboard.data ? (
        <ErrorState description="The dashboard couldn't be loaded." onRetry={() => void dashboard.refetch()} />
      ) : (
        <SectionErrorBoundary title="The dashboard couldn't be shown">
          {dashboard.data.type === "agency" ? (
            <AgencyContainer live={dashboard.data} />
          ) : focus ? (
            <BusinessWithFocus live={dashboard.data} focusId={focus.id} focusName={focus.businessName} />
          ) : (
            <BusinessDashboardView data={toBusinessDashboard(dashboard.data, { locationId: null, name: null })} />
          )}
        </SectionErrorBoundary>
      )}
    </AppShell>
  );
}

/** Business: adds the focus location's GBP report (factors, competitors, review stats) and Rank Tracker. */
function BusinessWithFocus({ live, focusId, focusName }: { live: LiveBusiness; focusId: string; focusName: string }) {
  const report = useGbpReport(focusId, "28d");
  const tracker = useRankTracker(focusId, undefined);
  const data = toBusinessDashboard(live, { locationId: focusId, name: focusName, report: report.data, tracker: tracker.data });
  return <BusinessDashboardView data={data} />;
}

/** Agency: adds report counts and each location's area. */
function AgencyContainer({ live }: { live: LiveAgency }) {
  const { locations } = useWorkspace();
  const ready = useQuery({ queryKey: ["reports", "count", "ready"], queryFn: ({ signal }) => getReports({ status: "ready", limit: 1 }, signal) });
  const failed = useQuery({ queryKey: ["reports", "count", "failed"], queryFn: ({ signal }) => getReports({ status: "failed", limit: 1 }, signal) });
  const areas = useMemo(() => new Map(locations.map((location) => [location.id, location.area])), [locations]);
  const data = toAgencyDashboard(live, { ready: ready.data?.total ?? null, scheduled: null, failed: failed.data?.total ?? null }, areas);
  return <AgencyDashboardView data={data} />;
}

export default DashboardPage;
