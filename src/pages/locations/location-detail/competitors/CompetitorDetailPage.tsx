import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { LocationHeader, LocationNavigation } from "@/components/mypageseo/location-workspace";
import { CompetitorDetailContent } from "@/components/mypageseo/competitor-detail";
import { EmptyState, ErrorState } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { getCompetitorDetail } from "@/lib/mypageseo/competitors";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description =
  "Detailed comparison of this competitor against your selected business across the rankings, reviews, citations, profile and website signals available to the workspace.";



function CompetitorDetailPage() {
  const { locationId, competitorId } = useRequiredParams("locationId", "competitorId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  const data = getCompetitorDetail(competitorId, locationId);

  if (workspace.status === "loading") {
    return <AppShell><div role="status" aria-live="polite" className="h-64 animate-pulse rounded-lg bg-muted" aria-label="Loading location workspace" /></AppShell>;
  }
  if (workspace.status === "unavailable") {
    return <AppShell><ErrorState description="We couldn't load this location workspace. Try again without leaving this page." onRetry={() => window.location.reload()} /></AppShell>;
  }
  if (!location) {
    return (
      <AppShell>
        <PageHeader title="Location unavailable" description="This location is not available in the current organization." />
        <EmptyState
          title="Location not found"
          description="Choose an available location to open its competitor workspace."
          action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell showLocationContext={false}>
      <LocationHeader location={location} />
      <LocationNavigation locationId={location.id} activeSection="competitors" />
      <PageHeader
        title={data.competitor?.businessName ?? "Competitor analysis"}
        description={`${description} Your business, ${location.businessName}, is the comparison baseline.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={`/locations/${location.id}/competitors`}>
              <ArrowLeft aria-hidden /> Back to competitors
            </Link>
          </Button>
        }
      />
      <CompetitorDetailContent data={data} locationId={location.id} onRetry={() => window.location.reload()} />
    </AppShell>
  );
}

export default CompetitorDetailPage;
