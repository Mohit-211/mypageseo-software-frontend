import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { CompetitorsContent } from "@/components/competitor/competitors";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { getCompetitors } from "@/lib/competitors/competitors";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description =
  "Monitor the local businesses competing with this location and understand where it is stronger or weaker across rankings, reviews, citations and Google Business Profile signals.";



function LocationCompetitorsPage() {
  const { locationId } = useRequiredParams("locationId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  const data = getCompetitors(locationId);

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
        title="Competitors"
        description={description}
        meta={data.lastCheckedAt ? <p className="text-xs text-muted-foreground">Last updated {data.lastCheckedAt}</p> : undefined}
      />
      <CompetitorsContent data={data} locationId={location.id} onRetry={() => window.location.reload()} />
    </AppShell>
  );
}

export default LocationCompetitorsPage;
