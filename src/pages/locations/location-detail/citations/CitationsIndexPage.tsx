import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { isApiError } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { CitationsContent, CitationsError, CitationsLoading, CitationsSettingUp } from "@/components/citation/citations";
import { ReportButton } from "@/components/report/rank-report-button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useCitations } from "@/lib/citations/use-citations";
import { useLocation } from "@/lib/locations/use-locations";
import { useRequiredParams } from "@/hooks/use-required-params";

const description =
  "Your business listings on online directories, checked by hand by the MyPageSEO team: which are live and correct, which show the wrong name, address or phone, and where you aren't listed.";

function LocationCitationsPage() {
  const { locationId } = useRequiredParams("locationId");
  const location = useLocation(locationId);
  const citations = useCitations(locationId);

  if (location.isPending) return <AppShell><PageSkeleton /></AppShell>;
  if (location.isError) {
    return (
      <AppShell>
        {isApiError(location.error) && location.error.status === 404 ? (
          <EmptyState
            title="Location not found"
            description="It may have been deleted, or it isn't in this organization."
            action={<Button asChild variant="outline"><Link to="/locations"><ArrowLeft aria-hidden /> Back to locations</Link></Button>}
          />
        ) : (
          <ErrorState description="We couldn't load this location." onRetry={() => void location.refetch()} />
        )}
      </AppShell>
    );
  }

  const data = location.data;
  const available = citations.data?.available === true;

  return (
    <AppShell showLocationContext={false}>
      <LocationHeader
        location={{
          id: data.location_id,
          ...(data.client ? { clientId: data.client.client_id } : {}),
          businessName: data.name,
          area: [data.city, data.state, data.country].filter(Boolean).join(", "),
        }}
      />
      <LocationNavigation locationId={data.location_id} activeSection="citations" />
      <PageHeader
        title="Citations"
        description={description}
        actions={
          available ? (
            <ReportButton locationId={data.location_id} type="citation" subtitle="Citation Health, every listing, wrong details and recent changes." />
          ) : undefined
        }
      />
      {citations.isPending ? (
        <CitationsLoading />
      ) : citations.isError ? (
        <CitationsError onRetry={() => void citations.refetch()} />
      ) : citations.data.available ? (
        <CitationsContent data={citations.data} locationId={data.location_id} />
      ) : (
        <CitationsSettingUp />
      )}
    </AppShell>
  );
}

export default LocationCitationsPage;
