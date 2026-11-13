import { useEffect } from "react";
import { Outlet, matchPath, useLocation } from "react-router-dom";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/**
 * Keeps the remembered location (the sidebar's location switcher) in step with the location
 * page being viewed. The location's data is started by the route loader (`locationLoader` in
 * src/app/route-loaders.ts), in parallel with the page code.
 */
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
