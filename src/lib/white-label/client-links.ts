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

/**
 * Links sit on a neutral domain once the server has one (`WHITE_LABEL_BASE_URL`); until then they
 * are `<API origin>/w/<token>`, which still says MyPageSEO. Copy must not promise otherwise.
 */
export function isNeutralLink(url: string): boolean {
  try {
    return !new URL(url).hostname.toLowerCase().includes("mypageseo");
  } catch {
    return true;
  }
}

/** "marketing-performance-report.com/3q2V…aR4A": short enough for a table cell, still recognisable. */
export function shortLinkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const token = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    const short = token.length > 10 ? `${token.slice(0, 4)}…${token.slice(-4)}` : token;
    return `${parsed.hostname.replace(/^www\./, "")}/${short}`;
  } catch {
    return url;
  }
}

/** Ready-to-paste text for the agency to send with a new link. */
export function clientLinkMessage(locationName: string, url: string): string {
  return `Here is your live local search report for ${locationName}: ${url}\nIt updates itself every month, so you can keep this link and check back any time.`;
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
    case "agency_only":
      return "Client links are for agency accounts.";
    default:
      return error.status === 400 && error.message ? error.message : fallback;
  }
}
