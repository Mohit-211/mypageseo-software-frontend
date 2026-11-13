import type { RankBucket } from "@/api";

export type LatLng = { lat: number; lng: number };

export type GridMapPoint = LatLng & { key: string; text: string; bucket: RankBucket; title: string };

/** `rank: null` draws a plain location marker (e.g. the setup center). */
export type MapPin = LatLng & { key: string; rank: number | null; name: string; kind: "self" | "competitor" | "other" };

/**
 * Pin colours by kind, shared by both map libraries and the legend: you in the interactive teal,
 * tracked competitors in the info blue (the copy says "blue"), everyone else white.
 */
export const PIN_KIND_CLASS: Record<MapPin["kind"], string> = {
  self: "bg-primary text-primary-foreground border-white",
  competitor: "bg-info text-info-foreground border-white",
  other: "bg-card text-foreground border-border-strong",
};

/**
 * A marker's tap area on touch screens: an invisible 36px circle centred on it (SPEC: 36px touch
 * targets), so 24–28px markers are easy to tap without drawing bigger markers that would hide each
 * other. Put it on the marker's visible circle. (Centred by size, not by inset: an inset would be
 * measured from inside the marker's border.)
 */
export const MARKER_TOUCH_AREA =
  "relative pointer-coarse:after:absolute pointer-coarse:after:left-1/2 pointer-coarse:after:top-1/2 pointer-coarse:after:size-9 pointer-coarse:after:-translate-x-1/2 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:rounded-full pointer-coarse:after:content-['']";

export const PIN_KIND_LABEL: Record<MapPin["kind"], string> = {
  self: "You",
  competitor: "Tracked competitor",
  other: "Other business",
};

/**
 * A browser key for the Maps JavaScript API (restricted to the app's domains). Without it the
 * maps fall back to OpenStreetMap tiles. See docs/GOOGLE_MAPS_SETUP.md.
 */
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";

/**
 * The Map ID whose cloud style gives the map its look; Advanced Markers need one.
 * `DEMO_MAP_ID` is Google's test ID (default style) for local development.
 */
export const GOOGLE_MAPS_MAP_ID: string = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export const USE_GOOGLE_MAPS = GOOGLE_MAPS_API_KEY.length > 0;
