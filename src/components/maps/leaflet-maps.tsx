import { useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { BUCKET_MARKER_CLASS } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";
import { GridLegend, PinsLegend } from "./map-legend";
import { MARKER_TOUCH_AREA, PIN_KIND_CLASS, type GridMapPoint, type LatLng, type MapPin } from "./map-types";

/**
 * The OpenStreetMap fallback, used when no Google Maps key is configured.
 *
 * Map tiles. OpenStreetMap by default; set `VITE_MAP_TILE_URL` and
 * `VITE_MAP_TILE_ATTRIBUTION` to use another provider (OSM's public tiles are
 * meant for light use).
 */
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Rings and dots drawn by Leaflet itself (SVG): the ink colour, from the theme. */
const INK = "var(--color-foreground)";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function boundsFor(points: LatLng[]): L.LatLngBounds {
  return L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])).pad(0.08);
}

/**
 * Fitting a grid or a set of pins: quarter zoom steps, so the points fill the map instead of snapping
 * to the next whole zoom level out (which left most of the map empty), with room kept for the zoom
 * buttons (top left) and the tile credit (bottom right). The buttons still zoom one whole level.
 */
const FIT_ZOOM_SNAP = 0.25;
const FIT_BOUNDS_OPTIONS: L.FitBoundsOptions = { paddingTopLeft: [44, 12], paddingBottomRight: [12, 20] };

/**
 * Leaflet's zoom buttons are 30px; on touch screens they become 36px (SPEC: 36px touch targets).
 * `!important` because leaflet.css is not in a cascade layer, so it beats Tailwind's utilities otherwise.
 */
const ZOOM_TOUCH = "pointer-coarse:[&_.leaflet-bar_a]:size-9! pointer-coarse:[&_.leaflet-bar_a]:leading-9!";

/** The search grid on a map: one coloured rank marker per point; the business center is outlined. */
export function LeafletGridMap({ points, center, className }: { points: GridMapPoint[]; center: LatLng; className?: string | undefined }) {
  const bounds = useMemo(() => boundsFor([...points, center]), [points, center]);
  // Fewer, larger markers for small grids; tighter ones for 11×11 and 13×13.
  const size = points.length > 81 ? 24 : points.length > 25 ? 28 : 34;
  // Marker numerals are the one place 11px text is allowed; bigger markers get 12px.
  const text = size > 30 ? "text-xs" : "text-[11px]";

  return (
    <div className={cn("relative isolate flex flex-col overflow-hidden rounded-lg border border-border", ZOOM_TOUCH, className ?? "h-[460px] w-full")}>
      <MapContainer bounds={bounds} boundsOptions={FIT_BOUNDS_OPTIONS} zoomSnap={FIT_ZOOM_SNAP} scrollWheelZoom={false} className="min-h-0 w-full flex-1">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {points.map((point) => (
          <Marker
            key={point.key}
            position={[point.lat, point.lng]}
            title={point.title}
            icon={L.divIcon({
              className: "",
              iconSize: [size, size],
              html: `<span class="flex size-full items-center justify-center rounded-full border-2 ${text} font-semibold tabular-nums shadow-md ${MARKER_TOUCH_AREA} ${BUCKET_MARKER_CLASS[point.bucket]}">${escapeHtml(point.text)}</span>`,
            })}
          >
            <Tooltip>{point.title}</Tooltip>
          </Marker>
        ))}
        <CircleMarker center={[center.lat, center.lng]} radius={size / 2 + 6} pathOptions={{ color: INK, weight: 2, fill: false, dashArray: "4 3" }}>
          <Tooltip>Business center</Tooltip>
        </CircleMarker>
      </MapContainer>
      <GridLegend />
    </div>
  );
}

/** Map Ranking results as numbered pins; your business and tracked competitors stand out. */
export function LeafletPinsMap({
  pins,
  searchPoint,
  className,
}: {
  pins: MapPin[];
  /** Where this search was made from. */
  searchPoint?: LatLng | null | undefined;
  className?: string | undefined;
}) {
  const points = useMemo(() => (searchPoint ? [...pins, searchPoint] : pins), [pins, searchPoint]);
  const bounds = useMemo(() => boundsFor(points), [points]);
  // A single point has no extent to fit: show it at city level instead of the closest zoom.
  const single = points.length === 1 ? points[0]! : null;
  const legend = pins.length > 1;
  return (
    <div className={cn("relative isolate flex flex-col overflow-hidden rounded-lg border border-border", ZOOM_TOUCH, className ?? "h-[420px] w-full")}>
      <MapContainer
        {...(single
          ? { center: [single.lat, single.lng] as [number, number], zoom: 11 }
          : { bounds, boundsOptions: FIT_BOUNDS_OPTIONS, zoomSnap: FIT_ZOOM_SNAP })}
        scrollWheelZoom={false}
        className="min-h-0 w-full flex-1"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {searchPoint ? (
          <CircleMarker center={[searchPoint.lat, searchPoint.lng]} radius={8} pathOptions={{ color: INK, weight: 2, fillColor: INK, fillOpacity: 0.15 }}>
            <Tooltip>Search point</Tooltip>
          </CircleMarker>
        ) : null}
        {/* Draw "other" pins first so yours and competitors sit on top. */}
        {[...pins]
          .sort((a, b) => (a.kind === "other" ? 0 : 1) - (b.kind === "other" ? 0 : 1))
          .map((pin) => {
            const size = pin.kind === "self" ? 32 : 26;
            return (
              <Marker
                key={pin.key}
                position={[pin.lat, pin.lng]}
                title={pin.rank === null ? pin.name : `#${pin.rank} ${pin.name}`}
                zIndexOffset={pin.kind === "self" ? 1000 : pin.kind === "competitor" ? 500 : 0}
                icon={L.divIcon({
                  className: "",
                  iconSize: [size, size],
                  html: `<span class="flex size-full items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums shadow-md ${MARKER_TOUCH_AREA} ${PIN_KIND_CLASS[pin.kind]}${pin.kind === "self" ? " ring-4 ring-primary/25" : ""}">${pin.rank ?? "•"}</span>`,
                })}
              >
                <Tooltip>
                  {pin.rank === null ? pin.name : `#${pin.rank} ${pin.name}`}
                  {pin.rank !== null && pin.kind === "self" ? " (you)" : pin.rank !== null && pin.kind === "competitor" ? " · tracked" : ""}
                </Tooltip>
              </Marker>
            );
          })}
      </MapContainer>
      {legend ? <PinsLegend searchPoint={Boolean(searchPoint)} /> : null}
    </div>
  );
}
