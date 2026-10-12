/** Staff dashboard: admin sign-in and the sales audit (Phase 19). */
import type { Attribution } from "./locations";

export type StaffAdmin = {
  id: string;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  permissions: string[];
  is_active: boolean;
  password_set: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type AuditPlaceSuggestion = {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
};

export type AuditChecklistItem = {
  id: string;
  label: string;
  /** `good | partial | missing`; photos are informational. */
  state: "good" | "partial" | "missing" | string;
  detail: string | null;
};

export type AuditScore = {
  score: number | null;
  grade: string | null;
  flag: string | null;
  parts: { id: string; points: number; max: number; available: boolean }[];
};

export type AuditBusiness = {
  place_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  country: string | null;
  region: string | null;
  rating: number | null;
  user_rating_count: number | null;
  category: string | null;
  website: string | null;
  phone: string | null;
  has_hours: boolean;
  has_editorial_summary?: boolean;
  photo_count: number | null;
  business_status?: string | null;
  score: AuditScore | null;
  checklist: AuditChecklistItem[];
};

export type AuditCell = { row: number; col: number; lat: number; lng: number; rank: number | null; status: "ok" | "not_found" | "error" | string };

export type AuditCompetitor = {
  /** Area position on area-basis audits; the rank at the business on older ones. */
  rank: number;
  name: string;
  address: string | null;
  /** Area-basis audits only. */
  avg_rank?: number | null;
  top3_rate?: number | null;
  /** Same shape as the business's public facts; null when unavailable. */
  facts: Partial<Omit<AuditBusiness, "score" | "checklist">> | null;
  score: AuditScore | null;
  checklist: AuditChecklistItem[] | null;
};

/** A "who ranks higher" row. On area-basis audits the business's own row comes last (`is_self`). */
export type AuditHigherRow = {
  /** Area position (area basis) or the rank at the business (older audits); null when the business wasn't in any top 30. */
  rank: number | null;
  name: string;
  address: string | null;
  is_self: boolean;
  /** Area-basis audits only. */
  avg_rank?: number | null;
  top3_rate?: number | null;
};

export type AuditStatus = "queued" | "running" | "done" | "failed";

export type SalesAudit = {
  id: string;
  status: AuditStatus;
  keyword: string;
  business: AuditBusiness;
  grid: { size: number; radius_km: number; spacing_km: number };
  result: {
    /** `"area"`: "who ranks higher" is across the whole grid. Absent on older audits (centre only). */
    basis?: "area";
    cells: AuditCell[];
    summary: {
      /** Area basis only; null means "30+". */
      area_rank?: number | null;
      center_rank: number | null;
      center_status: string;
      avg_rank: number | null;
      found_rate: number | null;
      top3_rate: number | null;
      points: number;
      failed_points: number;
    };
    /** Null with the `names_unavailable` warning. */
    higher: AuditHigherRow[] | null;
    /** Area basis only: `ahead` can exceed the (up to 10) businesses listed in `higher`. */
    area?: { ahead: number };
    competitors: AuditCompetitor[];
  } | null;
  /** `some_points_failed`, `names_unavailable`, `some_competitors_unavailable`. */
  warnings: string[];
  /** `search_failed`, `places_not_configured`, `enqueue_failed`, `timed_out`, `internal_error`. */
  failure_reason: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string;
  attribution?: Attribution;
};
