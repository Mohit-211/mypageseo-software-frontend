import { DEMO_DATA_ENABLED, withDemoFallback } from "../mypageseo/demo/demo-mode";
import { DEMO_CLIENTS, demoLocation } from "../mypageseo/demo/entities";
import {
  DEMO_COMPARISON_PERIODS,
  DEMO_REPORT_BRANDING,
  demoReportContent,
  demoReportKeywordGroups,
  demoReportRows,
  demoReportSchedules,
  demoReportSeed,
} from "../mypageseo/demo/reports";

export type ReportsStatus = "loading" | "ready" | "no_reports" | "error";

/** Report types defined by the Mypageseo product. */
export type ReportType = "rank_tracker" | "gbp_audit" | "competitor_analysis" | "citation_report";

/** Lifecycle states reported by the backend. */
export type ReportState = "generated" | "scheduled" | "processing" | "failed";

export type ReportRow = {
  id: string;
  name: string;
  type: ReportType;
  clientId: string | null;
  clientName: string | null;
  locationId: string | null;
  locationName: string | null;
  state: ReportState;
  createdAt: string | null;
  generatedAt: string | null;
  updatedAt: string | null;
  /** Reporting period label supplied by the backend, e.g. "1 Aug – 31 Aug". */
  period: string | null;
  /** Next delivery timestamp for scheduled reports. */
  scheduledFor: string | null;
  scheduleSummary: string | null;
  failureReason: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export type ReportsCapabilities = {
  canCreate: boolean;
  canSearch: boolean;
  canView: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canDuplicate: boolean;
  canSchedule: boolean;
  canDelete: boolean;
  /** Whether the backend exposes report types actually available to this org. */
  availableTypes: ReportType[];
};

export type ReportsData = {
  status: ReportsStatus;
  reports: ReportRow[];
  capabilities: ReportsCapabilities;
};

/**
 * No report generation, scheduling or storage feed is wired into this
 * frontend, so no reports, statuses, periods or files are returned and every
 * report operation stays disabled until that backend exists.
 */
export function getReports(real?: ReportsData | null): ReportsData {
  return withDemoFallback(real, () => ({
    status: "ready",
    reports: demoReportRows(),
    capabilities: {
      canCreate: true,
      canSearch: true,
      canView: true,
      canDownload: true,
      canEdit: false,
      canDuplicate: false,
      canSchedule: true,
      canDelete: true,
      availableTypes: ["rank_tracker", "gbp_audit", "competitor_analysis", "citation_report"],
    },
  }));
}

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  rank_tracker: "Rank Tracker",
  gbp_audit: "GBP Audit",
  competitor_analysis: "Competitor Analysis",
  citation_report: "Citation Report",
};

export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  generated: "Generated",
  scheduled: "Scheduled",
  processing: "Processing",
  failed: "Failed",
};

export const REPORTS_PAGE_SIZE = 25;

export type ReportTypeOption = {
  value: ReportType;
  label: string;
  description: string;
  /** Whether the backend can currently generate this report type. */
  available: boolean;
  /** Why the type cannot be generated, when unavailable. */
  unavailableReason: string | null;
  supportsDateRange: boolean;
  supportsComparisonPeriod: boolean;
};

export type ReportCreationOptions = {
  /** Whether the backend exposes a report generation operation at all. */
  canGenerate: boolean;
  types: ReportTypeOption[];
  /** Additional supported configuration; empty until the backend exposes it. */
  keywordGroups: { id: string; name: string }[];
  brandingOptions: { id: string; name: string }[];
  comparisonPeriods: { value: string; label: string }[];
};

/**
 * No report generation backend is wired into this frontend, so no report type
 * can be generated and no configuration options (keyword groups, branding,
 * comparison periods) are offered.
 */
export function getReportCreationOptions(real?: ReportCreationOptions | null): ReportCreationOptions {
  return withDemoFallback(real, () => ({
    canGenerate: true,
    types: [
      {
        value: "rank_tracker",
        label: "Rank Tracker",
        description: "Tracked keyword positions, movement and distribution for the selected location.",
        available: true,
        unavailableReason: null,
        supportsDateRange: true,
        supportsComparisonPeriod: true,
      },
      {
        value: "gbp_audit",
        label: "GBP Audit",
        description: "Google Business Profile completeness, health findings and recommended fixes.",
        available: true,
        unavailableReason: null,
        supportsDateRange: false,
        supportsComparisonPeriod: false,
      },
      {
        value: "competitor_analysis",
        label: "Competitor Analysis",
        description: "Side-by-side comparison against tracked local competitors across available signals.",
        available: true,
        unavailableReason: null,
        supportsDateRange: true,
        supportsComparisonPeriod: false,
      },
      {
        value: "citation_report",
        label: "Citation Report",
        description: "Directory listing coverage, NAP consistency and outstanding citation issues.",
        available: true,
        unavailableReason: null,
        supportsDateRange: false,
        supportsComparisonPeriod: false,
      },
    ],
    keywordGroups: demoReportKeywordGroups(),
    brandingOptions: [{ id: "northbound", name: DEMO_REPORT_BRANDING.companyName ?? "Northbound Digital" }],
    comparisonPeriods: DEMO_COMPARISON_PERIODS,
  }));
}

export type ReportDetailStatus = "loading" | "ready" | "processing" | "failed" | "not_found" | "error";

export type ReportMetric = {
  label: string;
  value: string | null;
  comparisonLabel: string | null;
  comparisonValue: string | null;
  helpText: string | null;
};

export type ReportTableSection = {
  id: string;
  title: string;
  description: string | null;
  columns: string[];
  rows: (string | null)[][];
  /** Set when the backend could not supply this section. */
  unavailableReason: string | null;
};

export type ReportSeriesPoint = { label: string; value: number | null; comparisonValue: number | null };

export type ReportChartSection = {
  id: string;
  title: string;
  description: string | null;
  points: ReportSeriesPoint[];
  unavailableReason: string | null;
};

export type ReportBranding = {
  /** Agency white-label configuration, when the backend supplies one. */
  companyName: string | null;
  logoUrl: string | null;
};

export type ReportDetailCapabilities = {
  canDownload: boolean;
  canShare: boolean;
  canSchedule: boolean;
  canRegenerate: boolean;
  canEdit: boolean;
};

export type ReportDetail = {
  id: string;
  name: string;
  type: ReportType;
  state: ReportState;
  clientName: string | null;
  locationId: string | null;
  locationName: string | null;
  period: string | null;
  comparisonPeriod: string | null;
  generatedAt: string | null;
  failureReason: string | null;
  branding: ReportBranding | null;
  summary: ReportMetric[];
  charts: ReportChartSection[];
  tables: ReportTableSection[];
  downloadUrl: string | null;
  capabilities: ReportDetailCapabilities;
};

export type ReportDetailResult = {
  status: ReportDetailStatus;
  report: ReportDetail | null;
};

/**
 * No report storage or generation backend is wired into this frontend, so no
 * report record can be resolved for any id and no report content, metrics,
 * charts, branding or export files are returned.
 */
export function getReportDetail(reportId: string, real?: ReportDetailResult | null): ReportDetailResult {
  return withDemoFallback(real, () => demoReportDetail(reportId));
}

function demoReportDetail(reportId: string): ReportDetailResult {
  if (!DEMO_DATA_ENABLED) return { status: "not_found", report: null };

  const seed = demoReportSeed(reportId);
  if (!seed) return { status: "not_found", report: null };

  const location = demoLocation(seed.locationId);
  const content = seed.state === "processing" || seed.state === "failed" || !seed.locationId
    ? { summary: [], charts: [], tables: [] }
    : demoReportContent(seed.type, seed.locationId);

  const report: ReportDetail = {
    id: seed.id,
    name: `${location.businessName} — ${REPORT_TYPE_LABEL[seed.type]}`,
    type: seed.type,
    state: seed.state,
    clientName: DEMO_CLIENTS.find((c) => c.id === location.clientId)?.name ?? null,
    locationId: location.id,
    locationName: `${location.businessName} — ${location.area}`,
    period: seed.period,
    comparisonPeriod: seed.type === "rank_tracker" ? "Previous period" : null,
    generatedAt: seed.generatedAt,
    failureReason: seed.failureReason,
    branding: DEMO_REPORT_BRANDING,
    summary: content.summary,
    charts: content.charts,
    tables: content.tables,
    downloadUrl: seed.state === "generated" ? `/reports/${seed.id}?format=pdf` : null,
    capabilities: {
      canDownload: seed.state === "generated",
      canShare: seed.state === "generated",
      canSchedule: true,
      canRegenerate: seed.state === "failed",
      canEdit: false,
    },
  };

  return { status: seed.state === "processing" ? "processing" : seed.state === "failed" ? "failed" : "ready", report };
}

export type ScheduleStatus = "active" | "paused" | "failed";

export type ScheduleRunStatus = "succeeded" | "failed" | "running";

export type ReportSchedule = {
  id: string;
  name: string;
  type: ReportType;
  clientId: string | null;
  clientName: string | null;
  locationId: string | null;
  locationName: string | null;
  /** Reporting period label supplied by the backend. */
  period: string | null;
  /** Frequency label supplied by the backend, e.g. "Monthly". */
  frequency: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: ScheduleRunStatus | null;
  lastRunReportId: string | null;
  /** Delivery summary supplied by the backend, e.g. recipient count. */
  delivery: string | null;
  status: ScheduleStatus;
  failureReason: string | null;
};

export type SchedulesCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canPause: boolean;
  canRunNow: boolean;
  canDelete: boolean;
  canSearch: boolean;
  /** Frequencies the backend can actually run. */
  frequencies: { value: string; label: string }[];
};

export type SchedulesData = {
  status: "loading" | "ready" | "no_schedules" | "error";
  schedules: ReportSchedule[];
  capabilities: SchedulesCapabilities;
};

/**
 * No report scheduling backend is wired into this frontend, so no schedules,
 * frequencies, delivery methods, run history or schedule operations exist.
 */
export function getReportSchedules(real?: SchedulesData | null): SchedulesData {
  return withDemoFallback(real, () => ({
    status: "ready",
    schedules: demoReportSchedules(),
    capabilities: {
      canCreate: true,
      canEdit: true,
      canPause: true,
      canRunNow: true,
      canDelete: true,
      canSearch: true,
      frequencies: [
        { value: "Daily", label: "Daily" },
        { value: "Weekly", label: "Weekly" },
        { value: "Biweekly", label: "Biweekly" },
        { value: "Monthly", label: "Monthly" },
      ],
    },
  }));
}

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  active: "Active",
  paused: "Paused",
  failed: "Failed",
};

export const SCHEDULE_RUN_STATUS_LABEL: Record<ScheduleRunStatus, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  running: "Running",
};

export const SCHEDULES_PAGE_SIZE = 25;
