/** Sales audit display helpers: cell ranks, colours and the wording for each `reason`. */
import { apiErrorData, isApiError, type AuditCell, type RankBucket } from "@/api";

/** Ranks go to 30; deeper is `not_found` ("30+"), a failed point is `error` ("–"). */
export function cellText(cell: Pick<AuditCell, "rank" | "status">): string {
  if (cell.status === "error") return "–";
  if (cell.status === "not_found" || cell.rank === null) return "30+";
  return String(cell.rank);
}

export function cellBucket(cell: Pick<AuditCell, "rank" | "status">): RankBucket {
  if (cell.status === "error") return "error";
  if (cell.status === "not_found" || cell.rank === null) return "not_found";
  if (cell.rank <= 3) return "pack";
  if (cell.rank <= 10) return "visible";
  if (cell.rank <= 20) return "low";
  return "invisible";
}

export const AUDIT_LEGEND: { bucket: RankBucket; label: string }[] = [
  { bucket: "pack", label: "1–3" },
  { bucket: "visible", label: "4–10" },
  { bucket: "low", label: "11–20" },
  { bucket: "invisible", label: "21–30" },
  { bucket: "not_found", label: "30+" },
  { bucket: "error", label: "No answer" },
];

export const FAILURE_TEXT: Record<string, string> = {
  search_failed: "Every grid search failed, so there is nothing to show.",
  places_not_configured: "Google Places isn't configured on the server. Contact an administrator.",
  enqueue_failed: "The audit couldn't be queued. Try again.",
  timed_out: "The audit didn't finish within 10 minutes.",
  internal_error: "Something went wrong while running the audit.",
};

export const WARNING_TEXT: Record<string, string> = {
  some_points_failed: "Some grid points didn't answer. They show “–” and are left out of the averages.",
  names_unavailable: "Business names couldn't be fetched, so “Who ranks higher” and the top-3 comparison are missing.",
  some_competitors_unavailable: "Details for some of the top 3 couldn't be fetched.",
};

function waitText(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "later";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return hours > 0 ? `in ${hours} h ${minutes} min` : `in ${minutes} min`;
}

/** Why starting an audit (or searching) failed, from `data.reason`. */
export function auditErrorText(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Try again.";
  const data = apiErrorData(error);
  switch (error.reason) {
    case "unsupported_country":
      return "The audit covers businesses in the US and Canada only.";
    case "no_location":
      return "Google has no map location for this business, so the grid can't be placed.";
    case "daily_limit_reached":
      return `You've reached the limit of ${String(data.limit ?? "")} audits in 24 hours. Try again ${waitText(Number(data.retry_after_seconds))}.`;
    case "rate_limited":
      return "Too many searches in the last hour. Try again in a few minutes.";
    case "places_not_configured":
      return "Google Places isn't configured on the server. Contact an administrator.";
    case "places_error":
      return "Google didn't answer. Try again in a moment.";
    case "forbidden":
      return "Your account can't run sales audits.";
    case "audit_not_found":
      return "This audit was closed or has expired.";
    default:
      return error.status === 400 && error.message ? error.message : "Something went wrong. Try again.";
  }
}

export const pct = (rate: number | null | undefined) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);

export const auditQueryKey = (auditId: string) => ["staff", "audit", auditId] as const;
