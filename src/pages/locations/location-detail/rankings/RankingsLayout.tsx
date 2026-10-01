import { Link, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { isApiError } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/lib/locations/use-locations";
import type { RankingsContext } from "@/lib/rankings/rankings-context";
import { useRequiredParams } from "@/hooks/use-required-params";

/** Loads the real location (`GET locations/:id`) and frames the ranking pages. */
function LocationRankingsLayout() {
  const { locationId } = useRequiredParams("locationId");
  const location = useLocation(locationId);

  if (location.isPending) {
    return <AppShell><PageSkeleton /></AppShell>;
  }

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
          <ErrorState description="We couldn't load this location. Try again without leaving this page." onRetry={() => void location.refetch()} />
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
      <LocationNavigation locationId={data.location_id} activeSection="rankings" />
      <Outlet context={{ location: data } satisfies RankingsContext} />
    </AppShell>
  );
}

export default LocationRankingsLayout;
