import { useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RankBucket } from "@/api";
import { BUCKET_MARKER_CLASS } from "@/lib/rankings/format";

/**
 * Map tiles. OpenStreetMap by default; set `VITE_MAP_TILE_URL` and
 * `VITE_MAP_TILE_ATTRIBUTION` to use another provider (OSM's public tiles are
 * meant for light use).
 */
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type LatLng = { lat: number; lng: number };

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function boundsFor(points: LatLng[]): L.LatLngBounds {
  return L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])).pad(0.08);
}

export type GridMapPoint = LatLng & { key: string; text: string; bucket: RankBucket; title: string };

/** The search grid on a map: one coloured rank marker per point; the business center is outlined. */
export function GridMap({ points, center, className }: { points: GridMapPoint[]; center: LatLng; className?: string }) {
  const bounds = useMemo(() => boundsFor([...points, center]), [points, center]);
  // Fewer, larger markers for small grids; tighter ones for 11×11 and 13×13.
  const size = points.length > 81 ? 22 : points.length > 25 ? 26 : 32;

  return (
    <MapContainer bounds={bounds} scrollWheelZoom={false} className={className ?? "h-[460px] w-full rounded-md"}>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {points.map((point) => (
        <Marker
          key={point.key}
          position={[point.lat, point.lng]}
          title={point.title}
          icon={L.divIcon({
            className: "",
            iconSize: [size, size],
            html: `<span class="flex size-full items-center justify-center rounded-full border-2 text-[11px] font-semibold shadow ${BUCKET_MARKER_CLASS[point.bucket]}">${escapeHtml(point.text)}</span>`,
          })}
        >
          <Tooltip>{point.title}</Tooltip>
        </Marker>
      ))}
      <CircleMarker center={[center.lat, center.lng]} radius={size / 2 + 6} pathOptions={{ color: "#0f172a", weight: 2, fill: false }}>
        <Tooltip>Business center</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}

export type MapPin = LatLng & { key: string; rank: number; name: string; kind: "self" | "competitor" | "other" };

const PIN_CLASS: Record<MapPin["kind"], string> = {
  self: "bg-primary text-primary-foreground border-white ring-2 ring-primary/40",
  competitor: "bg-info text-white border-white",
  other: "bg-background text-foreground border-border",
};

/** Map Ranking results as numbered pins; your business and tracked competitors stand out. */
export function PinsMap({
  pins,
  searchPoint,
  className,
}: {
  pins: MapPin[];
  /** Where this search was made from. */
  searchPoint?: LatLng | null;
  className?: string;
}) {
  const points = useMemo(() => (searchPoint ? [...pins, searchPoint] : pins), [pins, searchPoint]);
  const bounds = useMemo(() => boundsFor(points), [points]);
  // A single point has no extent to fit: show it at city level instead of the closest zoom.
  const single = points.length === 1 ? points[0]! : null;
  return (
    <MapContainer
      {...(single ? { center: [single.lat, single.lng] as [number, number], zoom: 11 } : { bounds })}
      scrollWheelZoom={false}
      className={className ?? "h-[420px] w-full rounded-md"}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      {searchPoint ? (
        <CircleMarker center={[searchPoint.lat, searchPoint.lng]} radius={7} pathOptions={{ color: "#0f172a", weight: 2, fillOpacity: 0.15 }}>
          <Tooltip>Search point</Tooltip>
        </CircleMarker>
      ) : null}
      {/* Draw "other" pins first so yours and competitors sit on top. */}
      {[...pins]
        .sort((a, b) => (a.kind === "other" ? 0 : 1) - (b.kind === "other" ? 0 : 1))
        .map((pin) => (
          <Marker
            key={pin.key}
            position={[pin.lat, pin.lng]}
            title={`#${pin.rank} ${pin.name}`}
            zIndexOffset={pin.kind === "self" ? 1000 : pin.kind === "competitor" ? 500 : 0}
            icon={L.divIcon({
              className: "",
              iconSize: [26, 26],
              html: `<span class="flex size-full items-center justify-center rounded-full border-2 text-[11px] font-semibold shadow ${PIN_CLASS[pin.kind]}">${pin.rank}</span>`,
            })}
          >
            <Tooltip>{`#${pin.rank} ${pin.name}`}</Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}
