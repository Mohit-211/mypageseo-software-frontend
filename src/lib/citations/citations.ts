import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoCitationDetail, demoCitationsData } from "../mypageseo/demo/citations";

export type CitationsStatus = "loading" | "ready" | "not_scanned" | "error";

export type CitationState =
  | "correct"
  | "inconsistent"
  | "missing"
  | "duplicate"
  | "pending"
  | "unknown";

/** Campaign workflow states, only used when the backend supplies them. */
export type CitationCampaignState =
  | "ordered"
  | "todo"
  | "submitted"
  | "pending"
  | "live"
  | "updated"
  | "existing"
  | "replaced";

export type CitationNap = {
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
};

export type CitationDiscrepancy = {
  field: "name" | "address" | "phone" | "website";
  expected: string | null;
  found: string | null;
};

export type Citation = {
  id: string;
  directory: string;
  directoryType: string | null;
  state: CitationState;
  campaignState: CitationCampaignState | null;
  nap: CitationNap;
  discrepancies: CitationDiscrepancy[];
  /** Directory strength metric supplied by the backend, never derived here. */
  authority: number | null;
  priority: "high" | "medium" | "low" | null;
  lastChecked: string | null;
  listingUrl: string | null;
};

export type CitationsSummary = {
  checked: number | null;
  correct: number | null;
  inconsistent: number | null;
  missing: number | null;
  duplicate: number | null;
  recentlyChanged: number | null;
};

export type CitationIssue = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  citationId: string | null;
};

export type CitationsCapabilities = {
  canScan: boolean;
  canSearch: boolean;
  canFilterByDate: boolean;
  canFixListing: boolean;
  canRunCampaign: boolean;
};

export type CitationsData = {
  status: CitationsStatus;
  lastCheckedAt: string | null;
  summary: CitationsSummary;
  citations: Citation[];
  issues: CitationIssue[];
  capabilities: CitationsCapabilities;
};

/**
 * The live citation scanning source is not connected in this frontend, so
 * this adapter falls back to a deterministic demo dataset scoped to the
 * active location. Genuine "not scanned" states are returned untouched once a
 * real source exists.
 */
export function getCitations(locationId?: string | null, real?: CitationsData | null): CitationsData {
  return withDemoFallback(real, () => demoCitationsData(locationId));
}

export const CITATION_STATE_LABEL: Record<CitationState, string> = {
  correct: "Correct",
  inconsistent: "Inconsistent",
  missing: "Missing",
  duplicate: "Duplicate",
  pending: "Pending",
  unknown: "Unknown",
};

export const CITATION_CAMPAIGN_LABEL: Record<CitationCampaignState, string> = {
  ordered: "Ordered",
  todo: "To do",
  submitted: "Submitted",
  pending: "Pending",
  live: "Live",
  updated: "Updated",
  existing: "Existing",
  replaced: "Replaced",
};

export const CITATIONS_PAGE_SIZE = 25;

export type CitationHistoryEvent = {
  id: string;
  occurredAt: string;
  label: string;
  detail: string | null;
  state: CitationState | null;
};

export type CitationDetailStatus = "loading" | "ready" | "not_found" | "error";

export type CitationDetailData = {
  status: CitationDetailStatus;
  citation: Citation | null;
  /** Expected values as stored for the business, used for NAP comparison. */
  expectedNap: CitationNap | null;
  category: string | null;
  history: CitationHistoryEvent[] | null;
  issues: CitationIssue[];
  capabilities: CitationsCapabilities;
};

/**
 * The live citation record source is not connected in this frontend, so this
 * falls back to the deterministic demo listing for the requested citation.
 */
export function getCitationDetail(
  citationId: string,
  locationId?: string | null,
  real?: CitationDetailData | null,
): CitationDetailData {
  return withDemoFallback(real, () => demoCitationDetail(citationId, locationId));
}
