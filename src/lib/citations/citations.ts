import type { CitationNapIssue, CitationStatus } from "@/api";
import type { StatusTone } from "@/components/layout/shared/data-display";

/** Citations are checked by hand by the MyPageSEO team; customers only read them. */

export const CITATION_STATUS_LABEL: Record<CitationStatus, string> = {
  live_correct: "Live & correct",
  nap_wrong: "Wrong details",
  not_found: "Not listed",
  duplicate: "Duplicate listing",
  submitted: "Submitted",
  pending: "Pending approval",
  not_checked: "Not checked yet",
  removed: "Removed",
};

/** Shorter labels for the count chips. */
export const CITATION_STATUS_SHORT: Record<CitationStatus, string> = {
  ...CITATION_STATUS_LABEL,
  duplicate: "Duplicate",
  pending: "Pending",
  not_checked: "Not checked",
};

export const CITATION_STATUS_TONE: Record<CitationStatus, StatusTone> = {
  live_correct: "success",
  nap_wrong: "warning",
  not_found: "critical",
  duplicate: "critical",
  submitted: "info",
  pending: "info",
  not_checked: "neutral",
  removed: "neutral",
};

/**
 * Every status in a fixed display order (the client page lists its counts this way; good news
 * first). `removed` is shown only when present.
 */
export const CITATION_STATUS_ORDER: CitationStatus[] = [
  "live_correct",
  "nap_wrong",
  "not_found",
  "duplicate",
  "submitted",
  "pending",
  "not_checked",
  "removed",
];

/** The app's filter chips: problems first, in the backend's row order, then what's fine. */
export const CITATION_FILTER_ORDER: CitationStatus[] = [
  "nap_wrong",
  "duplicate",
  "not_found",
  "pending",
  "submitted",
  "not_checked",
  "live_correct",
  "removed",
];

/** Statuses that need fixing (counted in "needs attention"). */
export const CITATION_PROBLEM_STATUSES: CitationStatus[] = ["nap_wrong", "duplicate", "not_found"];

/** Statuses the team is working on with the directory. */
export const CITATION_IN_PROGRESS_STATUSES: CitationStatus[] = ["submitted", "pending"];

/** What the listings table shows: one status, a group of statuses, or everything. */
export type CitationFilter = CitationStatus | "all" | "problems" | "in_progress";

const FILTER_GROUPS: Record<"problems" | "in_progress", CitationStatus[]> = {
  problems: CITATION_PROBLEM_STATUSES,
  in_progress: CITATION_IN_PROGRESS_STATUSES,
};

/** Names for the filters that aren't a single status. */
export const CITATION_GROUP_LABEL: Record<"all" | "problems" | "in_progress", string> = {
  all: "All",
  problems: "Needs attention",
  in_progress: "In progress",
};

/** A `?status=` value as a filter (a status or a group), or "all" for anything unknown. */
export function parseCitationFilter(value: string | null): CitationFilter {
  if (value === "problems" || value === "in_progress") return value;
  return value && (CITATION_STATUS_ORDER as string[]).includes(value) ? (value as CitationStatus) : "all";
}

/** Whether a listing with `status` shows under `filter`. */
export function matchesCitationFilter(status: CitationStatus, filter: CitationFilter): boolean {
  if (filter === "all") return true;
  if (filter === "problems" || filter === "in_progress") return FILTER_GROUPS[filter].includes(status);
  return status === filter;
}

/** The filter's name for headings ("Wrong details", "In progress"…). */
export function citationFilterLabel(filter: CitationFilter): string {
  return filter === "all" || filter === "problems" || filter === "in_progress" ? CITATION_GROUP_LABEL[filter] : CITATION_STATUS_LABEL[filter];
}

const NAP_FIELD_LABEL: Record<string, string> = { name: "Name", address: "Address", phone: "Phone", website: "Website" };

/** "Phone", "Address"… for a NAP issue's field. */
export function napFieldLabel(field: string): string {
  return NAP_FIELD_LABEL[field] ?? field.charAt(0).toUpperCase() + field.slice(1);
}

/** "Phone: listed as (416) 555-0199, should be 416 555 0100". */
export function napIssueText(issue: CitationNapIssue) {
  return `${napFieldLabel(issue.field)}: listed as ${issue.found ?? "nothing"}, should be ${issue.expected ?? "—"}`;
}

/** Copy for a citations `{ available: false, reason }`. */
export const CITATIONS_UNAVAILABLE_COPY: Record<string, string> = {
  no_citations_yet: "Our team is setting up your citation tracking.",
  not_checked_yet: "Being checked by our team.",
};

export function citationsUnavailableText(reason: string) {
  return CITATIONS_UNAVAILABLE_COPY[reason] ?? "Not available yet.";
}

/** "5 of 6 checked" from the 0–1 coverage and the listing total. */
export function coverageText(coverage: number | null, total: number) {
  if (coverage == null) return `${total} listing${total === 1 ? "" : "s"}`;
  return `${Math.round(coverage * total)} of ${total} checked`;
}
