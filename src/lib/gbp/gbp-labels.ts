/** Labels and copy for the GBP report (states, pillars, reasons, Google's attribute ids, fixes). */
import type { CheckState, GbpCheck, GbpPillarId, GbpRange, GbpReport, GbpUnavailableReason } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { locationPath } from "@/lib/mypageseo/section-links";

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

/** Most urgent first: the order the audit groups its checks in. */
export const STATE_ORDER: CheckState[] = ["fail", "partial", "pass", "not_available"];

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
      return { title: "Google Business Profile isn't connected", description: "Connect the profile to see its data. Without it, only the public Profile Comparison is available." };
    case "v4_access_pending":
      return { title: "Waiting for Google access", description: "Reviews, photos and posts need an extra Google approval that is still pending. They appear here as soon as it's granted." };
    case "not_synced_yet":
      return { title: "Not synced yet", description: "This data arrives with the next Google sync. Use Refresh profile data to fetch it now." };
    case "no_data":
      return { title: "No data yet", description: "Google hasn't reported anything for this yet." };
    case "places_not_configured":
      return { title: "Business details unavailable", description: "Business details from Google Maps couldn't be fetched this time." };
    case "no_place_id":
      return { title: "No Google Maps place", description: "This location has no Google Maps place, so it can't be compared." };
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

/* -------------------------------------------------------------------------- */
/* Periods and trends                                                          */
/* -------------------------------------------------------------------------- */

/** The performance windows, in plain words (never the raw "28d"). */
export const RANGE_OPTIONS: readonly { value: GbpRange; label: string }[] = [
  { value: "28d", label: "Last 28 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

/** What a change is measured against, per window ("vs the previous 28 days"). */
export const RANGE_PREVIOUS: Record<GbpRange, string> = {
  "28d": "the previous 28 days",
  "90d": "the previous 90 days",
  "12m": "the previous 12 months",
};

/**
 * A fraction change (0.098) as a trend chip: arrow direction plus "9.8%" (the arrow carries the sign).
 * More views and more actions are always good, so `positive` follows the direction.
 */
export function changeTrend(change: number | null | undefined): { direction: "up" | "down" | "flat"; value: string; positive: boolean } | null {
  const text = formatPercentChange(change);
  if (text === null || change === null || change === undefined) return null;
  const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
  return { direction, value: text.replace(/^[+−]/, ""), positive: change >= 0 };
}

/* -------------------------------------------------------------------------- */
/* Google data freshness                                                       */
/* -------------------------------------------------------------------------- */

/** A Google sync part's status (`ok`, `not_available`, `failed`…) in plain words. */
export function syncStatus(status: string): { label: string; tone: StatusTone } {
  switch (status) {
    case "ok":
      return { label: "Up to date", tone: "success" };
    case "not_available":
      return { label: "Not available", tone: "neutral" };
    case "pending":
    case "running":
      return { label: "Updating", tone: "info" };
    case "skipped":
      return { label: "Skipped", tone: "neutral" };
    default: {
      const text = status.replace(/_/g, " ");
      return { label: text.charAt(0).toUpperCase() + text.slice(1), tone: "warning" };
    }
  }
}

/** Google's verification states in plain words. */
export const VERIFICATION_STATE_LABEL: Record<string, string> = {
  verified: "Verified",
  verification_required: "Verification needed",
  verification_pending: "Verification pending",
  waiting_for_voice_of_merchant: "Waiting for Google",
  ownership_conflict: "Ownership conflict",
  comply_with_guidelines: "Action needed",
};

/* -------------------------------------------------------------------------- */
/* Fixes: where to go to improve a check or close a gap                       */
/* -------------------------------------------------------------------------- */

/**
 * Where people edit their profile on Google. MyPageSEO reads the profile but doesn't edit it, so
 * fixes for description, hours, categories, photos… happen there.
 */
export const GOOGLE_PROFILE_EDIT_URL = "https://business.google.com/";

/** What a "Fix" button does: open a page in the app, open Google, or copy the review link. */
export type FixAction =
  | { kind: "link"; label: string; to: string; ai?: boolean }
  | { kind: "external"; label: string; href: string }
  | { kind: "copy"; label: string; text: string; copied: string };

export type FixContext = {
  locationId: string;
  /** The profile on Google Maps (`profile.maps_uri`), when known. */
  mapsUri?: string | null | undefined;
  /** "Write a review" link (`profile.new_review_uri`), when known. */
  reviewUri?: string | null | undefined;
};

/** Fix context for a report: the location, its Maps listing and its review link. */
export function fixContextFor(report: GbpReport): FixContext {
  const profile = report.profile.available ? report.profile : null;
  return { locationId: report.location_id, mapsUri: profile?.maps_uri ?? null, reviewUri: profile?.new_review_uri ?? null };
}

// Check ids from the backend's GBP score (and older names the report used before), grouped by fix.
const REPLY_CHECKS = new Set(["reply_rate_90d", "median_reply_time", "reply_rate", "reply_time"]);
const RATING_CHECKS = new Set(["average_rating", "rating"]);
const REVIEW_VOLUME_CHECKS = new Set(["review_count", "new_reviews_30d", "new_reviews_90d", "review_velocity"]);
const POST_CHECKS = new Set(["recent_post", "posts_per_month", "posts_recency"]);
const PHOTO_CHECKS = new Set(["recent_owner_photo", "owner_photos", "photos_recency", "photo_count"]);

function askForReviews(ctx: FixContext): FixAction {
  return ctx.reviewUri
    ? { kind: "copy", label: "Copy review link", text: ctx.reviewUri, copied: "Review link copied. Send it to happy customers." }
    : { kind: "link", label: "Open reviews", to: locationPath(ctx.locationId, "reputation") };
}

function addPhotos(ctx: FixContext): FixAction {
  return { kind: "external", label: "Add photos on Google", href: ctx.mapsUri ?? GOOGLE_PROFILE_EDIT_URL };
}

/** A rating to lift: Reviews opened on the 1 and 2 star reviews, the ones worth answering first. */
function lowRatings(ctx: FixContext): FixAction {
  return { kind: "link", label: "See 1–2 star reviews", to: locationPath(ctx.locationId, "reputation", "?rating=1,2") };
}

/** The next step for a check that doesn't earn full points; null when there is nothing to do. */
export function checkFix(check: Pick<GbpCheck, "id" | "pillar" | "state">, ctx: FixContext): FixAction | null {
  if (check.state === "pass" || check.state === "not_available") return null;
  if (REPLY_CHECKS.has(check.id)) return { kind: "link", label: "Draft replies with AI", to: locationPath(ctx.locationId, "ai/replies"), ai: true };
  if (RATING_CHECKS.has(check.id)) return lowRatings(ctx);
  if (REVIEW_VOLUME_CHECKS.has(check.id)) return askForReviews(ctx);
  if (POST_CHECKS.has(check.id)) return { kind: "link", label: "Write a post", to: locationPath(ctx.locationId, "gbp/posts") };
  if (PHOTO_CHECKS.has(check.id)) return addPhotos(ctx);
  if (check.id === "verified") return { kind: "external", label: "Verify on Google", href: GOOGLE_PROFILE_EDIT_URL };
  if (check.id === "no_pending_edits") return { kind: "external", label: "Review edits on Google", href: GOOGLE_PROFILE_EDIT_URL };
  if (check.pillar === "performance") return { kind: "link", label: "See performance", to: locationPath(ctx.locationId, "gbp") };
  if (check.pillar === "reviews") return { kind: "link", label: "Open reviews", to: locationPath(ctx.locationId, "reputation") };
  if (check.pillar === "activity") return { kind: "link", label: "Write a post", to: locationPath(ctx.locationId, "gbp/posts") };
  return { kind: "external", label: "Edit on Google", href: GOOGLE_PROFILE_EDIT_URL };
}

/** The next step for a Profile Comparison insight (`review_gap`, `photos_gap`, `missing_hours`…). */
export function insightFix(id: string, ctx: FixContext): FixAction | null {
  switch (id) {
    case "review_gap":
    case "review_freshness":
      return askForReviews(ctx);
    case "rating_gap":
      return lowRatings(ctx);
    case "photos_gap":
      return addPhotos(ctx);
    case "missing_hours":
    case "missing_website":
    case "missing_phone":
    case "category_mismatch":
      return { kind: "external", label: "Edit on Google", href: GOOGLE_PROFILE_EDIT_URL };
    default:
      return null;
  }
}
