import type { LocationStatus } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";

/**
 * One name, colour and explanation per location status (`GET locations` → `status`), shared by the
 * locations table, the overview hero and the dashboard. Red is kept for the one state that stops
 * data from flowing (Google refused the access).
 */
export const LOCATION_STATUS_META: Record<LocationStatus, { label: string; tone: StatusTone; help: string }> = {
  active: { label: "Active", tone: "success", help: "Tracking and Google data are up to date." },
  setup_required: { label: "Needs setup", tone: "warning", help: "Add keywords and competitors so tracking can start." },
  gbp_not_connected: {
    label: "No Google profile",
    tone: "neutral",
    help: "Rankings and citations work. Connect its Google Business Profile for reviews, posts and profile insights.",
  },
  gbp_disconnected: {
    label: "Profile disconnected",
    tone: "warning",
    help: "Rankings keep working, but profile data, reviews and posts no longer update.",
  },
  reconnect_required: { label: "Reconnect Google", tone: "critical", help: "Google refused the stored access, so profile data stopped syncing." },
};

export function locationStatusMeta(status: LocationStatus | string): { label: string; tone: StatusTone; help: string } {
  return LOCATION_STATUS_META[status as LocationStatus] ?? { label: String(status), tone: "neutral", help: "" };
}

/** Statuses in the order the filter lists them: what needs work first. */
export const LOCATION_STATUS_ORDER: LocationStatus[] = ["active", "setup_required", "reconnect_required", "gbp_disconnected", "gbp_not_connected"];

/**
 * A status that blocks the location until it's fixed (unfinished setup, a disconnected profile,
 * Google access to restore). The Overview's status banner shows these with the fix as the page's
 * primary action. "No Google profile" isn't one: rankings and citations work without it.
 */
export function isBlockingStatus(status: LocationStatus | string): boolean {
  return status === "setup_required" || status === "gbp_disconnected" || status === "reconnect_required";
}
