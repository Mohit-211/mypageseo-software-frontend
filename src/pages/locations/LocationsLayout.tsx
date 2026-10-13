import { useEffect } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { gbpReportQuery } from "@/lib/gbp/use-gbp-report";
import { locationOverviewQuery, locationQuery } from "@/lib/locations/use-locations";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { rankTrackerQuery } from "@/lib/rankings/use-rankings";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";

/**
 * Keeps the header's location in step with the location page being viewed, and loads
 * the location's sections in the background so switching tabs (Rankings → GBP → Reviews)
 * shows data instead of a skeleton. Each is one stored-data read; nothing calls Google.
 */
function LocationsLayout() {
  const { pathname } = useLocation();
  // The id lives in a child route, so read it from the path.
  const locationId = matchPath("/locations/:locationId/*", pathname)?.params.locationId;
  const { activeLocation, locations, setActiveLocationId } = useWorkspace();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!locationId || activeLocation?.id === locationId) return;
    if (locations.some((location) => location.id === locationId)) setActiveLocationId(locationId);
  }, [locationId, activeLocation, locations, setActiveLocationId]);

  useEffect(() => {
    if (!locationId || locationId === "add") return;
    // prefetchQuery skips data that's still fresh, and never throws.
    void queryClient.prefetchQuery(locationQuery(locationId));
    void queryClient.prefetchQuery(locationOverviewQuery(locationId));
    void queryClient.prefetchQuery(rankTrackerQuery(locationId));
    void queryClient.prefetchQuery(gbpReportQuery(locationId, "28d"));
    void queryClient.prefetchQuery(reviewsSummaryQuery(locationId));
  }, [locationId, queryClient]);

  return <Outlet />;
}

export default LocationsLayout;
