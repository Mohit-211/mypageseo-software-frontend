import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { LocationHeader, LocationNavigation } from "@/components/mypageseo/location-workspace";
import { CitationsContent } from "@/components/mypageseo/citations";
import { EmptyState, ErrorState } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import { getCitations } from "@/lib/mypageseo/citations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description =
  "Monitor this location's business listings across directories and identify citation health, consistency, missing listings, duplicates, and recent changes.";



function LocationCitationsPage() {
  const { locationId } = useRequiredParams("locationId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  const data = getCitations(locationId);

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
          description="Choose an available location to open its citation workspace."
          action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell showLocationContext={false}>
      <LocationHeader location={location} />
      <LocationNavigation locationId={location.id} activeSection="citations" />
      <PageHeader
        title="Citations"
        description={description}
        meta={data.lastCheckedAt ? <p className="text-xs text-muted-foreground">Last checked {data.lastCheckedAt}</p> : undefined}
      />
      <CitationsContent data={data} locationId={location.id} onRetry={() => window.location.reload()} />
    </AppShell>
  );
}

export default LocationCitationsPage;
