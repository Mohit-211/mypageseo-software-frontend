import {
  reportPath,
  reportTheme,
  whiteLabelActions,
  type AgencyBranding,
  type AgencyClient,
  type ClientReport,
  type ReportModule,
  type WhiteLabelSnapshot,
} from "@/lib/white-label/white-label";

/** Modules shown when previewing branding before any report exists. */
const SAMPLE_MODULES: ReportModule[] = ["gbp", "ai_visibility", "reviews", "posts"];

/**
 * Picks the report a preview shows: the requested one, otherwise the first
 * client's report, otherwise the first published report. With no reports at
 * all it previews the first client with a sample set of modules.
 */
export function pickPreviewReport(snapshot: WhiteLabelSnapshot, reportId?: string | null): { report: ClientReport | null; client: AgencyClient | null } {
  const byId = reportId ? snapshot.reports.find((r) => r.id === reportId) : undefined;
  const firstClient = snapshot.clients[0];
  const report =
    byId ??
    snapshot.reports.find((r) => r.clientId === firstClient?.id && r.status !== "disabled") ??
    snapshot.reports.find((r) => r.status === "published") ??
    snapshot.reports[0] ??
    null;
  const client = report ? (snapshot.clients.find((c) => c.id === report.clientId) ?? null) : (firstClient ?? null);
  return { report, client };
}

/** Everything needed to render a branded report preview. `branding` may be an unsaved draft. */
export function reportPreview(snapshot: WhiteLabelSnapshot, branding: AgencyBranding | null, reportId?: string | null) {
  const { report, client } = pickPreviewReport(snapshot, reportId);
  // Deterministic and cheap; becomes a query once Get Report Preview is an API call.
  const data = client ? whiteLabelActions.getReportPreview(client) : null;
  return {
    report,
    client,
    data,
    modules: report?.modules ?? SAMPLE_MODULES,
    theme: reportTheme(branding, report?.branding ?? "agency"),
    url: client ? reportPath(snapshot.domain, snapshot.agencySlug, client) : snapshot.domain.defaultDomain,
    pageTitle: client ? `${client.name} · ${branding?.agencyName || "Client Report"}` : "Client Report",
  };
}
