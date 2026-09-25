import { Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { LocationHeader, LocationNavigation } from "@/components/location_component/location-workspace";
import { CitationDetailContent } from "@/components/citation/citation-detail";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { CITATION_STATE_LABEL, getCitationDetail } from "@/lib/mypageseo/citations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description = "Inspect one directory listing, compare it against your stored business information, and act on detected discrepancies.";



function CitationDetailPage() {
  const { locationId, citationId } = useRequiredParams("locationId", "citationId");
  const workspace = useWorkspace();
  const location = workspace.locations.find((item) => item.id === locationId) ?? null;

  useEffect(() => {
    if (location && workspace.activeLocation?.id !== location.id) {
      workspace.setActiveClientId(location.clientId ?? null);
      workspace.setActiveLocationId(location.id);
    }
  }, [location, workspace]);

  const data = getCitationDetail(citationId, locationId);

  const backToCitations = (
    <Button asChild variant="outline" size="sm">
      <Link to={`/locations/${locationId}/citations`}>
        <ArrowLeft aria-hidden /> Back to citations
      </Link>
    </Button>
  );

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

  const citation = data.citation;

  return (
    <AppShell showLocationContext={false}>
      <LocationHeader location={location} />
      <LocationNavigation locationId={location.id} activeSection="citations" />
      <PageHeader
        title={citation?.directory ?? "Citation record"}
        description={citation ? `${citation.directoryType ?? "Directory listing"} record for ${location.businessName}` : description}
        actions={backToCitations}
        meta={
          citation ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={citation.state === "correct" ? "success" : citation.state === "inconsistent" || citation.state === "pending" ? "warning" : "critical"}>
                {CITATION_STATE_LABEL[citation.state]}
              </StatusBadge>
              {citation.lastChecked ? <span className="text-xs text-muted-foreground">Last checked {citation.lastChecked}</span> : null}
            </div>
          ) : undefined
        }
      />
      {data.status === "not_found" ? (
        <EmptyState
          title="Citation record not found"
          description="This listing is not available. No directory scan data has been collected for this location, so individual citation records cannot be opened yet."
          className="min-h-64"
          action={backToCitations}
        />
      ) : (
        <CitationDetailContent data={data} onRetry={() => window.location.reload()} />
      )}
    </AppShell>
  );
}

export default CitationDetailPage;
