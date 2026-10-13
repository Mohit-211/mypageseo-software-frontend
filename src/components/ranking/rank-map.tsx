import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import { USE_GOOGLE_MAPS, type GridMapPoint, type LatLng, type MapPin } from "@/components/maps/map-types";

export type { GridMapPoint, MapPin } from "@/components/maps/map-types";

/*
 * Google Maps when a browser key is configured, otherwise the OpenStreetMap fallback.
 * Only the library in use is downloaded.
 */
const GridImpl = lazy(() =>
  USE_GOOGLE_MAPS
    ? import("@/components/maps/google-maps").then((module) => ({ default: module.GoogleGridMap }))
    : import("@/components/maps/leaflet-maps").then((module) => ({ default: module.LeafletGridMap })),
);
const PinsImpl = lazy(() =>
  USE_GOOGLE_MAPS
    ? import("@/components/maps/google-maps").then((module) => ({ default: module.GooglePinsMap }))
    : import("@/components/maps/leaflet-maps").then((module) => ({ default: module.LeafletPinsMap })),
);

function MapLoading({ className }: { className: string }) {
  return <div role="status" aria-label="Loading map" className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** The search grid on a map: one coloured rank marker per point; the business center is marked. */
export function GridMap(props: { points: GridMapPoint[]; center: LatLng; className?: string }) {
  return (
    <Suspense fallback={<MapLoading className={props.className ?? "h-[460px] w-full"} />}>
      <GridImpl {...props} />
    </Suspense>
  );
}

/** Map Ranking results as numbered pins; your business and tracked competitors stand out. */
export function PinsMap(props: { pins: MapPin[]; searchPoint?: LatLng | null; className?: string }) {
  return (
    <Suspense fallback={<MapLoading className={props.className ?? "h-[420px] w-full"} />}>
      <PinsImpl {...props} />
    </Suspense>
  );
}
