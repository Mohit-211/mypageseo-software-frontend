/**
 * Citations (Phase 16): `/locations/:id/citations`. Read-only for organization users;
 * the MyPageSEO team picks the directories, checks each listing and records the result.
 */

export type CitationStatus =
  | "not_checked"
  | "live_correct"
  | "nap_wrong"
  | "not_found"
  | "duplicate"
  | "submitted"
  | "pending"
  | "removed";

export type CitationCounts = Record<CitationStatus, number>;

export type CitationNapField = "name" | "address" | "phone" | "website";

export type CitationNapIssue = { field: CitationNapField | string; found: string | null; expected: string | null };

export type CitationRow = {
  directory: { name: string; url: string | null; type: string | null };
  status: CitationStatus;
  nap_issues: CitationNapIssue[];
  listing_url: string | null;
  last_checked_at: string | null;
};

/** One history row. Every change reads "MyPageSEO team" in `by`. */
export type CitationChange = {
  at: string;
  directory: { name: string; type: string | null };
  action: string;
  from: CitationStatus | null;
  to: CitationStatus | null;
  changed_fields: string[];
  by: string;
};

/** `GET locations/:id/citations`. Rows come problems first. */
export type CitationsResponse =
  | {
      available: true;
      /** `score` is null while nothing is checked yet. `coverage` is the share of listings checked (0–1). */
      health: { score: number | null; grade: string | null; coverage: number | null; total: number };
      counts: CitationCounts;
      last_checked_at: string | null;
      recent_changes: CitationChange[];
      citations: CitationRow[];
    }
  | { available: false; reason: "no_citations_yet" | string };

/** `GET locations/:id/citations/changes`. */
export type CitationChangesResponse = { changes: CitationChange[]; page: number; limit: number; total: number };

/** Citation Health as it appears on location rows and agency dashboard rows; null until checked. */
export type CitationHealthSummary = { score: number | null; grade: string | null; nap_wrong: number };
