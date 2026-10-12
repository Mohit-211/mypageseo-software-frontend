import type { CitationNapIssue, CitationStatus } from "@/api";
import type { StatusTone } from "@/components/layout/shared/data-display";

/** Citations are checked by hand by the MyPageSEO team; customers only read them. */

export const CITATION_STATUS_LABEL: Record<CitationStatus, string> = {
  live_correct: "Live & correct",
  nap_wrong: "Wrong name/address/phone",
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
  nap_wrong: "Wrong NAP",
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

/** Filter chips, in the backend's row order (problems first). `removed` is shown only when present. */
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

const NAP_FIELD_LABEL: Record<string, string> = { name: "Name", address: "Address", phone: "Phone", website: "Website" };

/** "Phone: listed as (416) 555-0199, should be 416 555 0100". */
export function napIssueText(issue: CitationNapIssue) {
  const field = NAP_FIELD_LABEL[issue.field] ?? issue.field;
  return `${field}: listed as ${issue.found ?? "nothing"}, should be ${issue.expected ?? "—"}`;
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
