/** Citations (Phase 16): managed by the MyPageSEO team; customers only read them. */

export type CitationStatus = "live_correct" | "nap_wrong" | "not_found" | "duplicate" | "submitted" | "pending" | "not_checked" | "removed";

export type CitationChange = {
  at: string;
  directory: { name: string; type: string };
  action: string;
  from: CitationStatus | null;
  to: CitationStatus | null;
  changed_fields?: string[];
  /** Always "MyPageSEO team" for customers. */
  by: string;
};

export type CitationRow = {
  directory: { name: string; url: string | null; type: string };
  status: CitationStatus;
  nap_issues: { field: string; found: string | null; expected: string | null }[];
  listing_url: string | null;
  last_checked_at: string | null;
};

/** `GET locations/:id/citations`. Rows come problems first. */
export type CitationsResponse =
  | {
      available: true;
      /** `score` is null while nothing is checked yet ("Being checked by our team"). */
      health: { score: number | null; grade: string | null; coverage: number | null; total: number };
      counts: Partial<Record<CitationStatus, number>>;
      last_checked_at: string | null;
      recent_changes: CitationChange[];
      citations: CitationRow[];
    }
  | { available: false; reason: "no_citations_yet" | string };

export type CitationChangesPage = { changes: CitationChange[]; page: number; limit: number; total: number };
