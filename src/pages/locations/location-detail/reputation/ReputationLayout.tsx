import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { isApiError } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { LocationHeader, LocationNavigation } from "@/components/location/location-workspace";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import type { GbpContext } from "@/lib/gbp/gbp-context";
import { useLocation } from "@/lib/locations/use-locations";
import { useRequiredParams } from "@/hooks/use-required-params";
import { cn } from "@/lib/utils";

/** Loads the real location and frames the Reputation pages (Reviews, Insights). */
function ReputationLayout() {
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
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn("block rounded px-3 py-1.5 text-xs font-medium transition-colors", isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");
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
      <LocationNavigation locationId={data.location_id} activeSection="reputation" />
      <nav aria-label="Reputation views" className="overflow-x-auto">
        <ul className="flex min-w-max gap-1 rounded-md bg-brand-tint-strong/60 p-1">
          <li><NavLink end to={`/locations/${data.location_id}/reputation`} className={tab}>Reviews</NavLink></li>
          <li><NavLink to={`/locations/${data.location_id}/reputation/insights`} className={tab}>Insights</NavLink></li>
        </ul>
      </nav>
      <Outlet context={{ location: data } satisfies GbpContext} />
    </AppShell>
  );
}

export default ReputationLayout;
