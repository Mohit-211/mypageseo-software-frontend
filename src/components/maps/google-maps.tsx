import { useEffect, useMemo, useState } from "react";
import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { BUCKET_MARKER_CLASS } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";
import { GridLegend, PinsLegend } from "./map-legend";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, MARKER_TOUCH_AREA, PIN_KIND_CLASS, type GridMapPoint, type LatLng, type MapPin } from "./map-types";

/**
 * Google Maps versions of the ranking maps (Grid, Map Ranking, setup center).
 * Markers are Advanced Markers with our own HTML, so they need a Map ID; the map's look
 * (muted roads, no business POIs competing with our pins) comes from that Map ID's cloud style.
 * See docs/GOOGLE_MAPS_SETUP.md.
 */

const BOUNDS_PADDING = 48;

function toBounds(points: LatLng[]): { north: number; south: number; east: number; west: number } {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  return { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) };
}

/** Fits the map to the points whenever they change (another keyword, point or run). */
function FitBounds({ points, singleZoom = 13 }: { points: LatLng[]; singleZoom?: number }) {
  const map = useMap();
  const key = points.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]!);
      map.setZoom(singleZoom);
    } else {
      map.fitBounds(toBounds(points), BOUNDS_PADDING);
    }
    // `key` stands for the points' positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, singleZoom]);
  return null;
}

function BaseMap({ className, label, footer, children }: { className: string; label: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="en">
      <div className={cn("relative isolate flex flex-col overflow-hidden rounded-lg border border-border bg-muted", className)} role="region" aria-label={label}>
        <div className="min-h-0 flex-1">
          <Map
            mapId={GOOGLE_MAPS_MAP_ID}
            defaultCenter={{ lat: 39.5, lng: -98.35 }}
            defaultZoom={4}
            // Scroll zooms only with Ctrl / two fingers, so the page still scrolls past the map.
            gestureHandling="cooperative"
            // Fit the points tightly on raster maps too (vector Map IDs zoom fractionally already).
            isFractionalZoomEnabled
            disableDefaultUI
            zoomControl
            fullscreenControl
            clickableIcons={false}
            reuseMaps
            style={{ width: "100%", height: "100%" }}
          >
            {children}
          </Map>
        </div>
        {footer}
      </div>
    </APIProvider>
  );
}

/** A small card above a marker while it's hovered or focused. */
function HoverLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-white shadow-raised">
      {children}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-foreground" />
    </span>
  );
}

/** The search grid: one rank chip per point, coloured by bucket; the business center pulses. */
export function GoogleGridMap({ points, center, className }: { points: GridMapPoint[]; center: LatLng; className?: string | undefined }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const all = useMemo(() => [...points, center], [points, center]);
  // Larger chips for small grids, tighter ones for 11×11 and 13×13.
  const size = points.length > 81 ? 24 : points.length > 25 ? 28 : 34;

  return (
    <BaseMap className={className ?? "h-[460px] w-full"} label="Search grid map" footer={<GridLegend />}>
      <FitBounds points={all} />
      <AdvancedMarker position={center} zIndex={1} title="Business center">
        <span className="relative flex size-12 items-center justify-center" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/25 motion-reduce:animate-none" />
          <span className="relative size-12 rounded-full border-2 border-primary bg-primary/10" />
        </span>
      </AdvancedMarker>
      {points.map((point) => (
        <AdvancedMarker key={point.key} position={point} zIndex={hovered === point.key ? 1000 : 10} title={point.title}>
          <span
            className="relative block"
            onMouseEnter={() => setHovered(point.key)}
            onMouseLeave={() => setHovered((current) => (current === point.key ? null : current))}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full border-2 font-semibold tabular-nums shadow-md ring-1 ring-foreground/10 transition-transform duration-150 motion-reduce:transition-none",
                // Marker numerals are the one place 11px text is allowed.
                size > 30 ? "text-xs" : "text-[11px]",
                hovered === point.key && "scale-125",
                MARKER_TOUCH_AREA,
                BUCKET_MARKER_CLASS[point.bucket],
              )}
              style={{ width: size, height: size }}
            >
              {point.text}
            </span>
            {hovered === point.key ? <HoverLabel>{point.title}</HoverLabel> : null}
          </span>
        </AdvancedMarker>
      ))}
    </BaseMap>
  );
}

/** Pin shapes by kind; the colours come from `PIN_KIND_CLASS` (shared with the legend and the fallback map). */
const PIN_STYLE: Record<MapPin["kind"], { ring: string; tail: string; size: number; z: number }> = {
  self: { ring: "ring-4 ring-primary/25", tail: "bg-primary", size: 34, z: 3000 },
  competitor: { ring: "ring-2 ring-info/25", tail: "bg-info", size: 28, z: 2000 },
  other: { ring: "ring-1 ring-border-strong", tail: "bg-card", size: 26, z: 100 },
};

/** Map Ranking results as numbered pins; your business and tracked competitors stand out. */
export function GooglePinsMap({
  pins,
  searchPoint,
  className,
}: {
  pins: MapPin[];
  searchPoint?: LatLng | null | undefined;
  className?: string | undefined;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const all = useMemo(() => (searchPoint ? [...pins, searchPoint] : pins), [pins, searchPoint]);

  return (
    <BaseMap
      className={className ?? "h-[420px] w-full"}
      label="Map of the search results"
      footer={pins.length > 1 ? <PinsLegend searchPoint={Boolean(searchPoint)} /> : undefined}
    >
      <FitBounds points={all} />
      {searchPoint ? (
        <AdvancedMarker position={searchPoint} zIndex={1} title="Search point">
          <span className="relative flex size-5 items-center justify-center" aria-hidden>
            <span className="absolute size-5 rounded-full bg-foreground/15" />
            <span className="relative size-2.5 rounded-full border-2 border-white bg-foreground shadow" />
          </span>
        </AdvancedMarker>
      ) : null}
      {pins.map((pin) => {
        const style = PIN_STYLE[pin.kind];
        const active = hovered === pin.key;
        return (
          <AdvancedMarker key={pin.key} position={pin} zIndex={active ? 5000 : style.z} title={pin.rank === null ? pin.name : `#${pin.rank} ${pin.name}`}>
            <span
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHovered(pin.key)}
              onMouseLeave={() => setHovered((current) => (current === pin.key ? null : current))}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-raised transition-transform duration-150 motion-reduce:transition-none",
                  active && "scale-110",
                  MARKER_TOUCH_AREA,
                  PIN_KIND_CLASS[pin.kind],
                  style.ring,
                )}
                style={{ width: style.size, height: style.size }}
              >
                {pin.rank ?? <span className="size-2.5 rounded-full bg-current" />}
              </span>
              {/* The pin's point, so it reads as a location, not a badge. */}
              <span className={cn("-mt-1.5 size-2.5 rotate-45 border-b-2 border-r-2 shadow-sm", pin.kind === "other" ? "border-border-strong" : "border-white", style.tail)} aria-hidden />
              {active || pin.kind === "self" ? (
                <HoverLabel>
                  {pin.rank === null ? "" : `#${pin.rank} `}
                  {pin.name}
                  {pin.rank === null ? "" : pin.kind === "self" ? " (you)" : pin.kind === "competitor" ? " · tracked" : ""}
                </HoverLabel>
              ) : null}
            </span>
          </AdvancedMarker>
        );
      })}
    </BaseMap>
  );
}
