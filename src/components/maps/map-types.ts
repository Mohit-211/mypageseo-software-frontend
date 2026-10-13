import type { RankBucket } from "@/api";

export type LatLng = { lat: number; lng: number };

export type GridMapPoint = LatLng & { key: string; text: string; bucket: RankBucket; title: string };

/** `rank: null` draws a plain location marker (e.g. the setup center). */
export type MapPin = LatLng & { key: string; rank: number | null; name: string; kind: "self" | "competitor" | "other" };

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
