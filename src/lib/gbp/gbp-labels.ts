/** Labels and copy for the GBP report (states, pillars, reasons, Google's attribute ids). */
import type { CheckState, GbpPillarId, GbpUnavailableReason } from "@/api";

export const STATE_LABEL: Record<CheckState, string> = {
  pass: "Good",
  partial: "Could be better",
  fail: "Needs work",
  not_available: "Not available",
};

export const STATE_TONE: Record<CheckState, "success" | "warning" | "critical" | "neutral"> = {
  pass: "success",
  partial: "warning",
  fail: "critical",
  not_available: "neutral",
};

export const PILLAR_LABEL: Record<GbpPillarId, string> = {
  completeness: "Profile completeness",
  activity: "Activity",
  reviews: "Reviews",
  performance: "Performance",
};

export const PILLAR_DESCRIPTION: Record<GbpPillarId, string> = {
  completeness: "Is the profile filled in: verification, description, categories, hours, contact details, attributes and services.",
  activity: "Is the profile kept fresh: recent posts and photos.",
  reviews: "Rating, how many reviews, how recent they are and how quickly they're answered.",
  performance: "Google's own numbers: how often the profile is seen and how often people act on it.",
};

/** Copy for a section that can't be shown, by `reason`. */
export function unavailableCopy(reason: GbpUnavailableReason | string): { title: string; description: string } {
  switch (reason) {
    case "gbp_not_connected":
      return { title: "Google Business Profile isn't connected", description: "Connect the profile to see its data. Without it, only the public competitor comparison is available." };
    case "v4_access_pending":
      return { title: "Waiting for Google access", description: "Reviews, photos and posts need an extra Google API approval that is still pending. They appear here as soon as it's granted." };
    case "not_synced_yet":
      return { title: "Not synced yet", description: "This data arrives with the next Google sync. Use Refresh GBP to fetch it now." };
    case "no_data":
      return { title: "No data yet", description: "Google hasn't reported anything for this yet." };
    case "places_not_configured":
      return { title: "Competitor details unavailable", description: "Business details from Google Places couldn't be fetched." };
    case "no_place_id":
      return { title: "No Google place", description: "This location has no Google Maps place, so it can't be compared." };
    default:
      return { title: "Not available", description: "This section isn't available yet." };
  }
}

/** "has_wheelchair_accessible_entrance" → "Wheelchair accessible entrance". */
export function attributeLabel(name: string): string {
  const cleaned = name.replace(/^attributes\//, "").replace(/^(has|is|offers|accepts|welcomes|pay|requires)_/, (match) =>
    match === "pay_" ? "Pay " : match === "accepts_" ? "Accepts " : match === "offers_" ? "Offers " : "",
  );
  const text = cleaned.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** An attribute's values as text: booleans as Yes/No, lists joined. */
export function attributeValue(values: unknown[]): string {
  if (values.length === 0) return "—";
  return values
    .map((value) => (value === true ? "Yes" : value === false ? "No" : typeof value === "string" ? value.replace(/_/g, " ").toLowerCase() : JSON.stringify(value)))
    .join(", ");
}

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** Opening hours as "Monday: 08:00–17:00" lines, Monday first; days without a period are closed. */
export function formatHours(periods: { open_day: string | null; open_time: string | null; close_time: string | null }[]): { day: string; hours: string }[] {
  return DAY_ORDER.map((day) => {
    const today = periods.filter((period) => period.open_day === day);
    const label = day.charAt(0) + day.slice(1).toLowerCase();
    if (today.length === 0) return { day: label, hours: "Closed" };
    return {
      day: label,
      hours: today.map((period) => (period.open_time === "00:00" && period.close_time === "24:00" ? "Open 24 hours" : `${period.open_time ?? "?"}–${period.close_time ?? "?"}`)).join(", "),
    };
  });
}

/** A fraction change (0.068) as "+6.8%". */
export function formatPercentChange(change: number | null | undefined): string | null {
  if (change === null || change === undefined || !Number.isFinite(change)) return null;
  const pct = change * 100;
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`;
}
