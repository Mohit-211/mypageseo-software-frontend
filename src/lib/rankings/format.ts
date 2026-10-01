import type { ChangeLabel, RankBucket } from "@/api";

/**
 * A target's display name: the stored business name (Phase 17), else the location's
 * own name for `self`, else the slot ("Competitor 1") when no name was found.
 */
export function targetLabel(key: string, selfName = "Your business", name?: string | null): string {
  if (key === "self") return selfName;
  if (name) return name;
  const match = /^competitor_(\d+)$/.exec(key);
  return match ? `Competitor ${match[1]}` : key;
}

/** "Lower is better" change across runs, with how many keywords it covers when not all. */
export function comparableNote(comparable: number | undefined, total: number | undefined): string | null {
  if (comparable === undefined || total === undefined || comparable === total) return null;
  return `on ${comparable} of ${total} keyword${total === 1 ? "" : "s"}`;
}

/** The fixed explanation of what is measured (backend wording, Phase 17). */
export const RANKINGS_SOURCE_NOTE =
  "Rankings are Google Maps results, measured with the Google Places API from each point around your business.";

/** km → "8 km (5 mi)". */
export function formatDistance(km: number): string {
  const miles = km / 1.609344;
  return `${km % 1 === 0 ? km : km.toFixed(1)} km (${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi)`;
}

/** ms → "about 32 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `about ${hours} h${rest ? ` ${rest} min` : ""}`;
}

export function formatAvgRank(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

/** 0–1 → "40%". */
export function formatRate(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

export function formatRunDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export const CHANGE_LABEL_TEXT: Record<ChangeLabel, string> = {
  improved: "Improved",
  declined: "Declined",
  unchanged: "Unchanged",
  entered_top_60: "Entered top 60",
  dropped_out_of_top_60: "Dropped out of top 60",
};

export const BUCKET_LABEL: Record<RankBucket, string> = {
  pack: "1–3 (map pack)",
  visible: "4–10",
  low: "11–20",
  invisible: "21–60",
  not_found: "Not in top 60",
  error: "Search failed",
};

/** Colour classes per rank bucket, shared by rank cells and map markers. */
export const BUCKET_CLASS: Record<RankBucket, string> = {
  pack: "border-success/30 bg-success-surface text-success",
  visible: "border-info/30 bg-info-surface text-info",
  low: "border-warning/35 bg-warning-surface text-warning-foreground",
  invisible: "border-critical/25 bg-critical-surface text-critical",
  not_found: "border-border bg-muted text-muted-foreground",
  error: "border-dashed border-border bg-background text-muted-foreground",
};

/** Solid marker colours per bucket for the map (text stays readable on top). */
export const BUCKET_MARKER_CLASS: Record<RankBucket, string> = {
  pack: "bg-success text-white border-white",
  visible: "bg-info text-white border-white",
  low: "bg-warning text-warning-foreground border-white",
  invisible: "bg-critical text-white border-white",
  not_found: "bg-muted-foreground text-white border-white",
  error: "bg-background text-muted-foreground border-dashed border-muted-foreground",
};

/**
 * "Measured around: …" from a center's source (run or location header).
 * Null when the source isn't known (runs before 2026-10-01).
 */
export function centerDescription(center: { source?: "place" | "manual" | null; label?: string | null } | null | undefined): string | null {
  if (!center?.source) return null;
  if (center.source === "place") return `Measured around: your Google Maps pin${center.label ? `, ${center.label}` : ""}`;
  return `Measured around: ${center.label ?? "the city or ZIP"} (set during setup)`;
}
