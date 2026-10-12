import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ReportDetail, ReportRecord, ReportsListResponse } from "../types/rankings";

export type ReportType = "rank_tracker" | "gbp_audit" | "competitor_analysis" | "citation" | "reputation" | "full";

/** `GET reports`, newest first. */
export async function getReports(
  params: {
    location_id?: string;
    client_id?: string;
    type?: ReportType;
    status?: string;
    /** false hides reports of deleted locations. */
    include_deleted?: boolean;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<ReportsListResponse> {
  return unwrapData(await api.get(ENDPOINTS.reports.list, { query: params, ...(signal ? { signal } : {}) }));
}

/**
 * Queues a report (202). One active report per location and type: a repeat returns it
 * with `existing: true`. `run_id` makes a rank_tracker / full report for an older run.
 */
export async function createReport(body: {
  location_id: string;
  type: ReportType;
  range?: string;
  run_id?: string;
}): Promise<ReportRecord> {
  return unwrapData(await api.post(ENDPOINTS.reports.create, body));
}

export async function getReport(reportId: string, signal?: AbortSignal): Promise<ReportDetail> {
  return unwrapData(await api.get(ENDPOINTS.reports.detail(reportId), signal ? { signal } : {}));
}

/** Downloads the PDF. 409 `not_ready` / `expired`. */
export async function downloadReportPdf(reportId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await api.get<Response>(ENDPOINTS.reports.pdf(reportId), { responseType: "blob", timeoutMs: 60_000 });
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? `report-${reportId}.pdf` };
}

/** A share link; the URL is returned only here. `expiresInDays` null = no expiry. */
export async function shareReport(
  reportId: string,
  expiresInDays: number | null,
): Promise<{ share_id: string; url: string; expires_at: string | null }> {
  return unwrapData(await api.post(ENDPOINTS.reports.share(reportId), { expires_in_days: expiresInDays }));
}

export async function emailReport(
  reportId: string,
  recipients: string[],
  message?: string,
): Promise<{ sent: boolean; recipients: number; delivery: string }> {
  return unwrapData(await api.post(ENDPOINTS.reports.email(reportId), { recipients, ...(message ? { message } : {}) }));
}

export type ReportShare = {
  share_id: string;
  purpose: "share" | "email_link";
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  active: boolean;
  views: number;
  last_viewed_at: string | null;
};

/** The report's share links (the URLs themselves are shown only once, when created). */
export async function getReportShares(reportId: string, signal?: AbortSignal): Promise<ReportShare[]> {
  const result = unwrapData<ReportShare[] | { shares: ReportShare[] }>(await api.get(ENDPOINTS.reports.shares(reportId), signal ? { signal } : {}));
  return Array.isArray(result) ? result : result.shares;
}

export async function revokeReportShare(reportId: string, shareId: string): Promise<{ revoked: boolean }> {
  return unwrapData(await api.delete(ENDPOINTS.reports.shareLink(reportId, shareId)));
}

/** Archives the report (listed only with `status=archived`). */
export async function archiveReport(reportId: string): Promise<unknown> {
  return unwrapData(await api.delete(ENDPOINTS.reports.detail(reportId)));
}

/** A monthly schedule: sent after each covered location's automatic monthly refresh, not on a fixed date. */
export type ReportSchedule = {
  schedule_id: string;
  scope: "location" | "client";
  location_id: string | null;
  client_id: string | null;
  type: ReportType;
  sections: string[];
  range: "28d" | "90d" | "12m" | null;
  recipients: string[];
  frequency: "monthly";
  status: "active" | "paused";
  locations: { location_id: string; name: string }[];
  next_expected: string | null;
  last_sent_at: string | null;
  last_error: string | null;
  last_report_id: string | null;
  created_at: string;
};

export type ReportScheduleInput = {
  scope: "location" | "client";
  location_id?: string;
  client_id?: string;
  type: ReportType;
  range?: "28d" | "90d" | "12m";
  recipients: string[];
};

export async function getReportSchedules(
  query: { location_id?: string; client_id?: string } = {},
  signal?: AbortSignal,
): Promise<ReportSchedule[]> {
  const result = unwrapData<ReportSchedule[] | { schedules: ReportSchedule[] }>(
    await api.get(ENDPOINTS.reportSchedules.list, { query, ...(signal ? { signal } : {}) }),
  );
  return Array.isArray(result) ? result : result.schedules;
}

/** 400 `manual_only`, `gbp_not_connected`; 403 `agency_only` (client scope in a business organization). */
export async function createReportSchedule(input: ReportScheduleInput): Promise<ReportSchedule> {
  return unwrapData(await api.post(ENDPOINTS.reportSchedules.list, input));
}

export async function updateReportSchedule(
  scheduleId: string,
  patch: { status?: "active" | "paused"; recipients?: string[]; type?: ReportType; range?: "28d" | "90d" | "12m" },
): Promise<ReportSchedule> {
  return unwrapData(await api.patch(ENDPOINTS.reportSchedules.detail(scheduleId), patch));
}

export async function deleteReportSchedule(scheduleId: string): Promise<{ deleted: boolean }> {
  return unwrapData(await api.delete(ENDPOINTS.reportSchedules.detail(scheduleId)));
}
