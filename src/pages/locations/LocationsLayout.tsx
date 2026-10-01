import { useEffect } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Keeps the header's location in step with the location page being viewed. */
function LocationsLayout() {
  const { pathname } = useLocation();
  // The id lives in a child route, so read it from the path.
  const locationId = matchPath("/locations/:locationId/*", pathname)?.params.locationId;
  const { activeLocation, locations, setActiveLocationId } = useWorkspace();

  useEffect(() => {
    if (!locationId || activeLocation?.id === locationId) return;
    if (locations.some((location) => location.id === locationId)) setActiveLocationId(locationId);
  }, [locationId, activeLocation, locations, setActiveLocationId]);

  return <Outlet />;
}

export default LocationsLayout;
