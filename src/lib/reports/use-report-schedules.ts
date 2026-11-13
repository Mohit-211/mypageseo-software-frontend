import { useQuery } from "@tanstack/react-query";
import { getReportSchedules, isApiError, type ReportSchedule } from "@/api";
import { byBoolean, byTime, chain, sortRows } from "@/lib/sort";

export const SCHEDULES_QUERY_KEY = ["reports", "schedules"] as const;

/**
 * `GET /report-schedules` (≤ 200, the whole list), optionally for one client (`client_id`) or
 * location, ordered by the next email: active schedules soonest first, then paused ones.
 */
export function useReportSchedules(query: { client_id?: string; location_id?: string } = {}) {
  return useQuery({
    queryKey: [...SCHEDULES_QUERY_KEY, query],
    queryFn: async ({ signal }) => sortSchedules(await getReportSchedules(query, signal)),
    retry: false,
  });
}

/** Next email first (agenda order); paused or undated ones after, newest first. */
export function sortSchedules(rows: readonly ReportSchedule[]): ReportSchedule[] {
  return sortRows(
    rows,
    chain(
      byBoolean((row) => row.status === "active"),
      byTime((row) => (row.status === "active" ? row.next_expected : null), "asc"),
      byTime((row) => row.created_at, "desc"),
    ),
  );
}

/** Copy for refused schedule changes and for `last_error`, by reason. */
const SCHEDULE_ERRORS: Record<string, string> = {
  manual_only: "This location doesn't refresh automatically, so there's nothing to send after.",
  gbp_not_connected: "A GBP Audit email needs the location connected to Google.",
  agency_only: "Emails for a whole client are for agency accounts.",
  no_citations_yet: "This location has no citation list yet.",
  no_reviews: "This location has no stored reviews yet.",
  no_rank_run: "This location has no finished ranking run yet.",
  no_gbp_report: "The Google Business Profile data hasn't been synced yet.",
  subscription_required: "Your account is read-only until it has an active subscription.",
  organization_suspended: "This account is suspended. Contact support to restore it.",
  read_only: "Your access is read-only.",
};

export function scheduleErrorText(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  const reason = error.reason;
  if (reason && SCHEDULE_ERRORS[reason]) return SCHEDULE_ERRORS[reason];
  return error.status === 400 && error.message ? error.message : fallback;
}

/** Why the last monthly email wasn't sent, short enough for a table cell. */
const LAST_ERROR: Record<string, string> = {
  gbp_not_connected: "the location isn't connected to Google.",
  manual_only: "the location doesn't refresh automatically.",
  no_citations_yet: "no citation list yet.",
  no_reviews: "no stored reviews yet.",
  no_rank_run: "no finished ranking run yet.",
  no_gbp_report: "profile data isn't synced yet.",
  subscription_required: "the account was read-only.",
  organization_suspended: "the account was suspended.",
};

/** `last_error` is a reason code (e.g. `gbp_not_connected`) or a sentence. */
export function scheduleLastErrorText(lastError: string): string {
  return LAST_ERROR[lastError] ?? lastError;
}
