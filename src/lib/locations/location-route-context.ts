import { createContext, useContext } from "react";
import type { LocationHeader } from "@/api";

/**
 * What the location layout (`/locations/:locationId/*`) hands to every page inside it.
 * The layout loads `GET locations/:id` once and owns the pending, not-found and error
 * states, so pages under it can rely on `location` being present.
 */
export type LocationRouteValue = {
  location: LocationHeader;
};

export const LocationRouteContext = createContext<LocationRouteValue | null>(null);

/** The current location page's data. Only call it from pages under `/locations/:locationId/*`. */
export function useLocationRoute(): LocationRouteValue {
  const value = useContext(LocationRouteContext);
  if (!value) throw new Error("useLocationRoute() must be used under /locations/:locationId (LocationLayout).");
  return value;
}

/** The current location page's data, or null outside a location (for shared headers and widgets). */
export function useOptionalLocationRoute(): LocationRouteValue | null {
  return useContext(LocationRouteContext);
}
