import { useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/mypageseo/app-shell";
import { ComparisonControl, PageHeader } from "@/components/mypageseo/data-display";
import { EmptyState, ErrorState } from "@/components/mypageseo/states";
import { SectionError, SectionErrorBoundary } from "@/components/mypageseo/failure-states";
import {
  AgencyDashboardView,
  BusinessDashboardView,
  DashboardSkeleton,
} from "@/components/mypageseo/dashboard";
import { Button } from "@/components/ui/button";
import {
  comparisonRanges,
  useDashboardData,
  type ComparisonRange,
} from "@/lib/mypageseo/dashboard-data";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const title = "Dashboard | Mypageseo";
const description =
  "Local search performance overview: visibility, rankings, Google Business Profile health, reviews and citations.";



function DashboardPage() {
  const { organization, activeLocation, locations, status: workspaceStatus } = useWorkspace();
  const accountType = organization?.accountType ?? "business";
  const [range, setRange] = useState<ComparisonRange>("28d");
  const { status, data, retry } = useDashboardData(accountType, range, activeLocation?.id ?? null);

  const isAgency = accountType === "agency";
  const contextLabel = isAgency
    ? (organization?.name ?? "Portfolio")
    : (activeLocation?.businessName ?? organization?.name ?? "Workspace");

  const hasLocations = locations.length > 0;

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
            {!isAgency && activeLocation?.area ? ` · ${activeLocation.area}` : ""}
          </p>
        }
        actions={
          hasLocations ? (
            <ComparisonControl
              value={range}
              options={comparisonRanges}
              onChange={setRange}
              ariaLabel="Comparison period"
            />
          ) : null
        }
      />

      {workspaceStatus === "unavailable" ? (
        <SectionError
          kind="service_unavailable"
          title="Your workspace couldn't be loaded"
          description="Dashboard data can't be shown until the workspace loads. This is usually temporary."
        />
      ) : !hasLocations ? (
        <EmptyState
          title="Connect a location to start"
          description="Mypageseo builds this dashboard from your Google Business Profile locations. Add or connect a location to see visibility, ranking movement, profile health, reviews and citation issues."
          action={
            <Button asChild size="sm">
              <Link to="/locations">Add a location</Link>
            </Button>
          }
        />
      ) : status === "loading" ? (
        <DashboardSkeleton agency={isAgency} />
      ) : status === "error" || !data ? (
        <ErrorState
          description="Dashboard data could not be retrieved for this period. Your other data is unaffected."
          onRetry={retry}
        />
      ) : data.kind === "agency" ? (
        <SectionErrorBoundary title="Portfolio overview couldn't be displayed">
          <AgencyDashboardView data={data} />
        </SectionErrorBoundary>
      ) : (
        <SectionErrorBoundary title="Dashboard overview couldn't be displayed">
          <BusinessDashboardView data={data} />
        </SectionErrorBoundary>
      )}
    </AppShell>
  );
}

export default DashboardPage;
