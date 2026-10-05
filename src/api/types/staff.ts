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
  rank: number;
  name: string;
  address: string | null;
  /** Same shape as the business's public facts; null when unavailable. */
  facts: Partial<Omit<AuditBusiness, "score" | "checklist">> | null;
  score: AuditScore | null;
  checklist: AuditChecklistItem[] | null;
};

export type AuditStatus = "queued" | "running" | "done" | "failed";

export type SalesAudit = {
  id: string;
  status: AuditStatus;
  keyword: string;
  business: AuditBusiness;
  grid: { size: number; radius_km: number; spacing_km: number };
  result: {
    cells: AuditCell[];
    summary: {
      center_rank: number | null;
      center_status: string;
      avg_rank: number | null;
      found_rate: number | null;
      top3_rate: number | null;
      points: number;
      failed_points: number;
    };
    higher: { rank: number; name: string; address: string | null; is_self: boolean }[] | null;
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
