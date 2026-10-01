import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { isApiError } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { ReportsList } from "@/components/report/reports-list";
import { Button } from "@/components/ui/button";
import { useRequiredParams } from "@/hooks/use-required-params";
import { useLocation } from "@/lib/locations/use-locations";

/** One location's reports. */
function LocationReportsPage() {
  const { locationId } = useRequiredParams("locationId");
  const location = useLocation(locationId);

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
      <LocationNavigation locationId={data.location_id} activeSection="reports" />
      <PageHeader title="Reports" description={`Reports generated for ${data.name}. All reports are also under Reports in the menu.`} />
      <ReportsList locationId={data.location_id} reportPath={(reportId) => `/locations/${data.location_id}/reports/${reportId}`} />
    </AppShell>
  );
}

export default LocationReportsPage;
