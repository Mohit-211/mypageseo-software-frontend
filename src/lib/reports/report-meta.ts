import type { ReportStatus, ReportType } from "@/api";

export const REPORT_TYPE_LABEL: Record<string, string> = {
  rank_tracker: "Rank Tracker Report",
  gbp_audit: "GBP Audit Report",
  competitor_analysis: "Competitor Analysis",
  citation: "Citation Report",
  reputation: "Reputation Report",
  full: "Full Report",
  // Live, always-current pages listed with the reports.
  gbp_report: "GBP report (live)",
  review_insights: "Review insights (live)",
};

/** Report types the user can create, in menu order. */
export const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: "rank_tracker", label: "Rank Tracker", description: "Keyword ranks, history, the grid and who ranks around you." },
  { value: "gbp_audit", label: "GBP Audit", description: "Profile score, checks, performance and search keywords. Needs a connected profile." },
  { value: "competitor_analysis", label: "Competitor Analysis", description: "Public scores, ranks and insights against nearby businesses." },
  { value: "citation", label: "Citations", description: "Directory listings and name/address/phone issues." },
  { value: "reputation", label: "Reputation", description: "Review summary, star distribution, reviews needing attention, replies sent and review insights." },
  { value: "full", label: "Full report", description: "All of the above in one document." },
];

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
};
