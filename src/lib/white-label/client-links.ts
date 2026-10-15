import { isApiError, type WhiteLabelReportType } from "@/api";

/** `GET organization/branding`: the white-label settings. */
export const BRANDING_KEY = ["organization", "branding"] as const;
export const WHITE_LABEL_LINKS_KEY = ["white-label-links"] as const;
export const whiteLabelLinkKey = (locationId: string) => ["white-label-link", locationId] as const;

/** Report types a client link can show, in page order. */
export const CLIENT_LINK_REPORTS: { value: WhiteLabelReportType; label: string }[] = [
  { value: "rank_tracker", label: "Rank Tracker" },
  { value: "gbp_audit", label: "GBP Audit" },
  { value: "competitor_analysis", label: "Competitor Analysis" },
  { value: "citation", label: "Citations" },
  { value: "reputation", label: "Reputation" },
];

export const CLIENT_LINK_REPORT_LABEL = Object.fromEntries(CLIENT_LINK_REPORTS.map((entry) => [entry.value, entry.label])) as Record<
  WhiteLabelReportType,
  string
>;

/** Why a report type has no data yet (`types[].reason`). */
const UNAVAILABLE_COPY: Record<string, string> = {
  gbp_not_connected: "Needs a connected Google Business Profile.",
  no_gbp_report: "Profile data hasn't been synced yet.",
  no_rank_run: "No ranking run has finished yet.",
  no_citations_yet: "No citations tracked yet.",
  no_reviews: "No reviews stored yet.",
  no_insights: "No review insights yet.",
  no_data: "No data yet.",
};

export function clientLinkUnavailableText(reason: string | null): string {
  return (reason && UNAVAILABLE_COPY[reason]) ?? "No data yet.";
}

/** The refusals that mean "this account can't use client links": the UI hides the feature. */
export function isClientLinksUnavailable(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && ["agency_only", "read_only", "feature_not_included"].includes(error.reason ?? "");
}

/** Copy for a failed change, by `data.reason`. */
export function clientLinkErrorText(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  switch (error.reason) {
    case "subscription_required":
      return "Your subscription isn't active, so client links can't be changed. Links already sent keep working only while billing is active.";
    case "organization_suspended":
      return "This organization is suspended, so client links can't be changed.";
    case "read_only":
      return "Your access is read-only.";
    case "feature_not_included":
      return "Your plan doesn't include white-label client links.";
    case "logo_too_large":
      return "The logo must be 512 KB or smaller.";
    case "logo_type":
      return "Use a PNG or JPEG logo.";
    case "no_link":
      return "This location has no active client link. Reload the page.";
    default:
      return error.status === 400 && error.message ? error.message : fallback;
  }
}
