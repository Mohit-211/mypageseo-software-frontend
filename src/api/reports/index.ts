import { api, unwrapData } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ReportDetail, ReportRecord, ReportsListResponse } from "../types/rankings";

export type ReportType = "rank_tracker" | "gbp_audit" | "competitor_analysis" | "citation" | "full";

/** `GET reports`, newest first. */
export async function getReports(
  params: { location_id?: string; client_id?: string; type?: ReportType; status?: string; page?: number; limit?: number },
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
