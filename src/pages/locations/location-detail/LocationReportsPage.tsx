import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { LocationHeader, LocationNavigation } from "@/components/mypageseo/location-workspace";
import { ReportsContent } from "@/components/mypageseo/reports";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { getReports } from "@/lib/mypageseo/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description = "Reports generated or scheduled for this location.";



function LocationReportsPage() {
  const { locationId } = useRequiredParams("locationId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  const all = getReports();
  const data = {
    ...all,
    reports: all.reports.filter((report) => report.locationId === locationId),
  };

  if (workspace.status === "loading") {
    return (
      <AppShell>
        <PageSkeleton />
      </AppShell>
    );
  }

  if (workspace.status === "unavailable") {
    return (
      <AppShell>
        <ErrorState
          description="We couldn't load this location workspace. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  if (!location) {
    return (
      <AppShell>
        <EmptyState
          title="Location not found"
          description="This location isn't available in the current workspace. Choose one from your locations list."
          action={
            <Button asChild variant="outline">
              <Link to="/locations">
                <ArrowLeft aria-hidden /> Back to locations
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <LocationHeader location={location} />
      <LocationNavigation locationId={location.id} activeSection="reports" />
      <PageHeader
        title="Reports"
        description={description}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/reports">All reports</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/reports/create">Create report</Link>
            </Button>
          </div>
        }
      />
      <ReportsContent
        data={data.reports.length === 0 ? { ...data, status: "no_reports" } : data}
        isAgency={workspace.organization?.accountType === "agency"}
        onRetry={() => window.location.reload()}
      />
    </AppShell>
  );
}

export default LocationReportsPage;
