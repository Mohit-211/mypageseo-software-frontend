import { isApiError, type ReportStatus, type ReportType } from "@/api";

/**
 * One name per report type, used everywhere a report is named: the create dialog and menus, the
 * PDF reports list, monthly emails and the report page (the PDF's own title can differ; the report
 * page shows it too).
 */
const TYPE_NAME: Record<ReportType, string> = {
  rank_tracker: "Rank Tracker report",
  gbp_audit: "GBP Audit report",
  competitor_analysis: "Competitor Analysis",
  citation: "Citation report",
  reputation: "Reputation report",
  full: "Full report",
};

export const REPORT_TYPE_LABEL: Record<string, string> = {
  ...TYPE_NAME,
  // Always-current pages in the app, listed with the reports (no PDF). Not "live": on White Label
  // that word means a client link.
  gbp_report: "GBP report (always current)",
  review_insights: "Review insights (always current)",
};

/** Report types the user can create, in menu order. */
export const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "rank_tracker", label: TYPE_NAME.rank_tracker, description: "Keyword ranks, history, the grid and who ranks around you." },
  { value: "gbp_audit", label: TYPE_NAME.gbp_audit, description: "Profile score, checks, performance and search keywords. Needs a connected profile." },
  { value: "competitor_analysis", label: TYPE_NAME.competitor_analysis, description: "Public scores, ranks and insights against nearby businesses." },
  { value: "citation", label: TYPE_NAME.citation, description: "Directory listings and name/address/phone issues." },
  { value: "reputation", label: TYPE_NAME.reputation, description: "Review summary, star distribution, reviews needing attention, replies sent and review insights." },
  { value: "full", label: TYPE_NAME.full, description: "All of the above in one document." },
];

/** Types whose report covers a period (performance, citation changes): the create dialog offers one. */
export const REPORT_TYPES_WITH_PERIOD: ReportType[] = ["gbp_audit", "citation", "full"];

export type ReportRange = "28d" | "90d" | "12m";

export const REPORT_RANGES: { value: ReportRange; label: string }[] = [
  { value: "28d", label: "Last 28 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

/** "Last 28 days" for `28d` (never show the raw code). */
export function reportRangeLabel(range: string | null | undefined): string | null {
  if (!range) return null;
  return REPORT_RANGES.find((entry) => entry.value === range)?.label ?? range;
}

export const REPORT_ACTIVE_STATUSES: ReportStatus[] = ["queued", "generating"];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  queued: "Queued",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
  expired: "Expired",
  archived: "Archived",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, "info" | "success" | "critical" | "neutral"> = {
  queued: "info",
  generating: "info",
  ready: "success",
  failed: "critical",
  expired: "neutral",
  archived: "neutral",
};

/** Status filter options, in menu order (archived reports are listed only with `status=archived`). */
export const REPORT_STATUS_FILTERS: ReportStatus[] = ["ready", "queued", "generating", "failed", "expired", "archived"];

/** Copy for `POST reports` refusals, by `data.reason`. */
export const REPORT_CREATE_ERRORS: Record<string, string> = {
  no_rank_run: "This location has no finished ranking run yet.",
  gbp_not_connected: "This report needs a connected Google Business Profile.",
  no_gbp_report: "The Google Business Profile data hasn't been synced yet.",
  no_data: "There's no data for this report yet.",
  no_reviews: "This location has no reviews stored yet. Refresh reviews on the Reviews page first.",
  no_citations_yet: "No citations are tracked for this location yet.",
  read_only: "Your access is read-only, so you can't create reports.",
  invalid_section: "One of the report sections isn't available.",
  subscription_required: "Your account is read-only until it has an active subscription, so new reports are paused.",
  organization_suspended: "This account is suspended, so new reports can't be created. Contact support to restore it.",
  feature_not_included: "Your plan doesn't include PDF reports.",
};

/** The message for a refused report creation. */
export function reportCreateErrorText(error: unknown): string {
  const reason = isApiError(error) ? error.reason : undefined;
  return (reason && REPORT_CREATE_ERRORS[reason]) ?? "The report couldn't be created. Try again.";
}

/** Recipients per email or schedule (backend `MAX_SCHEDULE_RECIPIENTS`). */
export const MAX_RECIPIENTS = 10;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Splits "a@x.com, b@y.com" into addresses (duplicates removed, case-insensitively), or says what's wrong.
 */
export function parseRecipients(text: string): { recipients: string[]; error: string | null } {
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const value of text.split(/[,;\s]+/).map((entry) => entry.trim()).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(value);
  }
  if (recipients.length === 0) return { recipients, error: "Add at least one email address." };
  const invalid = recipients.find((value) => !EMAIL.test(value));
  if (invalid) return { recipients, error: `"${invalid}" isn't an email address.` };
  if (recipients.length > MAX_RECIPIENTS) return { recipients, error: `Up to ${MAX_RECIPIENTS} recipients. Remove ${recipients.length - MAX_RECIPIENTS}.` };
  return { recipients, error: null };
}
