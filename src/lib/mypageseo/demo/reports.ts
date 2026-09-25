/**
 * Demo dataset for the reporting surfaces (Reports Center, Create Report,
 * report detail/preview and Scheduled Reports). Derived from the shared demo
 * entities so report content matches rankings, GBP, citations and
 * competitors shown elsewhere in the product.
 */
import { demoDate, demoDateAhead, pickInt, seedFrom } from "./demo-mode";
import {
  DEMO_CLIENTS,
  DEMO_DIRECTORIES,
  demoCompetitors,
  demoKeywords,
  demoLocation,
  demoLocationsForClient,
  type DemoLocationFacts,
} from "./entities";
import type {
  ReportBranding,
  ReportChartSection,
  ReportMetric,
  ReportRow,
  ReportSchedule,
  ReportState,
  ReportTableSection,
  ReportType,
} from "../reports";

function clientName(clientId: string): string {
  return DEMO_CLIENTS.find((c) => c.id === clientId)?.name ?? clientId;
}

/** Fixed reporting periods, kept stable against the fixed demo "today". */
export const DEMO_REPORT_PERIODS = {
  julFull: "1 Jul – 31 Jul 2026",
  augFull: "1 Aug – 31 Aug 2026",
  sepToDate: "1 Sep – 11 Sep 2026",
} as const;

type DemoReportSeed = {
  id: string;
  type: ReportType;
  locationId: string;
  state: ReportState;
  period: string | null;
  generatedAt: string | null;
  scheduledFor: string | null;
  failureReason: string | null;
};

const REPORT_SEEDS: DemoReportSeed[] = [
  { id: "rpt_riverside_north_rank_aug", type: "rank_tracker", locationId: "loc_riverside_north", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(11), scheduledFor: null, failureReason: null },
  { id: "rpt_riverside_north_gbp_aug", type: "gbp_audit", locationId: "loc_riverside_north", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(10), scheduledFor: null, failureReason: null },
  { id: "rpt_riverside_south_comp_aug", type: "competitor_analysis", locationId: "loc_riverside_south", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(9), scheduledFor: null, failureReason: null },
  { id: "rpt_riverside_round_rock_cit_aug", type: "citation_report", locationId: "loc_riverside_round_rock", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(8), scheduledFor: null, failureReason: null },
  { id: "rpt_hearth_downtown_rank_aug", type: "rank_tracker", locationId: "loc_hearth_downtown", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(7), scheduledFor: null, failureReason: null },
  { id: "rpt_hearth_cherry_gbp_sep", type: "gbp_audit", locationId: "loc_hearth_cherry", state: "processing", period: DEMO_REPORT_PERIODS.sepToDate, generatedAt: null, scheduledFor: null, failureReason: null },
  { id: "rpt_summit_main_rank_aug", type: "rank_tracker", locationId: "loc_summit_main", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(6), scheduledFor: null, failureReason: null },
  { id: "rpt_lumen_main_cit_jul", type: "citation_report", locationId: "loc_lumen_main", state: "failed", period: DEMO_REPORT_PERIODS.julFull, generatedAt: null, scheduledFor: null, failureReason: "Citation directories could not be re-crawled before the reporting deadline." },
  { id: "rpt_summit_main_gbp_jul", type: "gbp_audit", locationId: "loc_summit_main", state: "generated", period: DEMO_REPORT_PERIODS.julFull, generatedAt: demoDate(38), scheduledFor: null, failureReason: null },
  { id: "rpt_lumen_main_rank_aug", type: "rank_tracker", locationId: "loc_lumen_main", state: "generated", period: DEMO_REPORT_PERIODS.augFull, generatedAt: demoDate(12), scheduledFor: null, failureReason: null },
  { id: "rpt_riverside_north_rank_sep", type: "rank_tracker", locationId: "loc_riverside_north", state: "scheduled", period: DEMO_REPORT_PERIODS.sepToDate, generatedAt: null, scheduledFor: demoDateAhead(19), failureReason: null },
  { id: "rpt_hearth_downtown_comp_sep", type: "competitor_analysis", locationId: "loc_hearth_downtown", state: "scheduled", period: DEMO_REPORT_PERIODS.sepToDate, generatedAt: null, scheduledFor: demoDateAhead(4), failureReason: null },
];

function reportName(type: ReportType, location: DemoLocationFacts, period: string | null): string {
  const label: Record<ReportType, string> = {
    rank_tracker: "Rank Tracker",
    gbp_audit: "GBP Audit",
    competitor_analysis: "Competitor Analysis",
    citation_report: "Citation Report",
  };
  return `${location.businessName} — ${label[type]}${period ? ` (${period})` : ""}`;
}

export function demoReportRows(): ReportRow[] {
  return REPORT_SEEDS.map((seed) => {
    const location = demoLocation(seed.locationId);
    return {
      id: seed.id,
      name: reportName(seed.type, location, seed.period),
      type: seed.type,
      clientId: location.clientId,
      clientName: clientName(location.clientId),
      locationId: location.id,
      locationName: `${location.businessName} — ${location.area}`,
      state: seed.state,
      createdAt: seed.generatedAt ?? seed.scheduledFor,
      generatedAt: seed.generatedAt,
      updatedAt: seed.generatedAt ?? seed.scheduledFor,
      period: seed.period,
      scheduledFor: seed.scheduledFor,
      scheduleSummary: seed.state === "scheduled" ? "Generated automatically from a recurring schedule" : null,
      failureReason: seed.failureReason,
      previewUrl: seed.state === "generated" ? `/reports/${seed.id}` : null,
      downloadUrl: seed.state === "generated" ? `/reports/${seed.id}?format=pdf` : null,
    };
  });
}

export function demoReportSeed(reportId: string): DemoReportSeed | null {
  return REPORT_SEEDS.find((s) => s.id === reportId) ?? null;
}

export const DEMO_REPORT_BRANDING: ReportBranding = {
  companyName: "Northbound Digital",
  logoUrl: null,
};

function positionSummary(locationId: string) {
  const keywords = demoKeywords(locationId);
  const ranked = keywords.filter((k) => k.currentPosition !== null);
  const top3 = ranked.filter((k) => (k.currentPosition ?? 99) <= 3).length;
  const top10 = ranked.filter((k) => (k.currentPosition ?? 99) <= 10).length;
  const avg = ranked.length
    ? Math.round((ranked.reduce((sum, k) => sum + (k.currentPosition ?? 0), 0) / ranked.length) * 10) / 10
    : null;
  const improved = keywords.filter(
    (k) => k.currentPosition !== null && k.previousPosition !== null && k.currentPosition < k.previousPosition,
  ).length;
  const declined = keywords.filter(
    (k) => k.currentPosition !== null && k.previousPosition !== null && k.currentPosition > k.previousPosition,
  ).length;
  return { keywords, ranked, top3, top10, avg, improved, declined };
}

function buildRankTrackerDetail(location: DemoLocationFacts): { summary: ReportMetric[]; charts: ReportChartSection[]; tables: ReportTableSection[] } {
  const { keywords, top3, top10, avg, improved, declined } = positionSummary(location.id);

  const summary: ReportMetric[] = [
    { label: "Tracked keywords", value: String(keywords.length), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Average position", value: avg !== null ? avg.toFixed(1) : "Not ranked", comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Top 3 rankings", value: String(top3), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Top 10 rankings", value: String(top10), comparisonLabel: null, comparisonValue: null, helpText: `${improved} improved · ${declined} declined this period` },
  ];

  const trendSeed = seedFrom(location.id, "rank-trend");
  const points = ["Week 1", "Week 2", "Week 3", "Week 4"].map((label, index) => ({
    label,
    value: Math.max(1, Math.round(location.averageRank + pickInt(trendSeed + index, -3, 3))),
    comparisonValue: Math.max(1, Math.round(location.averageRank + location.averageRankChange + pickInt(trendSeed + index + 9, -3, 3))),
  }));

  const charts: ReportChartSection[] = [
    { id: "rank-trend", title: "Average position trend", description: "Weekly average across all tracked keywords.", points, unavailableReason: null },
  ];

  const tables: ReportTableSection[] = [
    {
      id: "keyword-positions",
      title: "Keyword positions",
      description: "Current vs. previous period position for every tracked keyword.",
      columns: ["Keyword", "Group", "Result type", "Current position", "Previous position", "Search volume"],
      rows: keywords.map((k) => [
        k.keyword,
        k.group,
        k.resultType === "local_finder" ? "Local Finder" : "Google",
        k.currentPosition !== null ? String(k.currentPosition) : "Not ranked",
        k.previousPosition !== null ? String(k.previousPosition) : "Not ranked",
        k.searchVolume.toLocaleString(),
      ]),
      unavailableReason: null,
    },
  ];

  return { summary, charts, tables };
}

function buildGbpAuditDetail(location: DemoLocationFacts): { summary: ReportMetric[]; charts: ReportChartSection[]; tables: ReportTableSection[] } {
  const seed = seedFrom(location.id, "gbp-audit");
  const findings: { area: string; finding: string; severity: string; recommendation: string }[] = [
    {
      area: "Profile completeness",
      finding: location.gbpHealth >= 80 ? "Business description, hours and attributes are complete." : "Business description is missing seasonal hours updates.",
      severity: location.gbpHealth >= 80 ? "Passed" : "Medium",
      recommendation: location.gbpHealth >= 80 ? "No action needed." : "Update holiday hours and re-verify service attributes.",
    },
    {
      area: "Photos",
      finding: `${location.photoCount} photos published, last added ${demoDate(pickInt(seed, 2, 18))}.`,
      severity: location.photoCount >= 100 ? "Passed" : "Medium",
      recommendation: location.photoCount >= 100 ? "Maintain a monthly upload cadence." : "Add at least 10 new interior/exterior photos this month.",
    },
    {
      area: "Reviews",
      finding: `${location.unansweredReviews} reviews awaiting a response out of ${location.reviewCount} total.`,
      severity: location.unansweredReviews > 15 ? "High" : location.unansweredReviews > 5 ? "Medium" : "Passed",
      recommendation: location.unansweredReviews > 5 ? "Respond to outstanding reviews within 48 hours." : "Keep current response time.",
    },
    {
      area: "Categories",
      finding: `Primary category "${location.primaryCategory}" with ${location.additionalCategories.length} additional categories.`,
      severity: "Passed",
      recommendation: "Categories match services offered.",
    },
    {
      area: "Posts",
      finding: location.gbpHealth >= 70 ? "Weekly Google Posts are published on schedule." : "No Google Post published in the last 30 days.",
      severity: location.gbpHealth >= 70 ? "Passed" : "High",
      recommendation: location.gbpHealth >= 70 ? "Continue weekly posting." : "Publish a Google Post at least weekly.",
    },
  ];

  const summary: ReportMetric[] = [
    { label: "GBP health score", value: String(location.gbpHealth), comparisonLabel: null, comparisonValue: null, helpText: "Out of 100" },
    { label: "Findings flagged", value: String(findings.filter((f) => f.severity !== "Passed").length), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Rating", value: location.rating.toFixed(1), comparisonLabel: null, comparisonValue: null, helpText: `${location.reviewCount} reviews` },
    { label: "Photos published", value: String(location.photoCount), comparisonLabel: null, comparisonValue: null, helpText: null },
  ];

  const tables: ReportTableSection[] = [
    {
      id: "gbp-findings",
      title: "Audit findings",
      description: "Profile areas reviewed during this audit and recommended fixes.",
      columns: ["Area", "Finding", "Severity", "Recommendation"],
      rows: findings.map((f) => [f.area, f.finding, f.severity, f.recommendation]),
      unavailableReason: null,
    },
  ];

  return { summary, charts: [], tables };
}

function buildCompetitorDetail(location: DemoLocationFacts): { summary: ReportMetric[]; charts: ReportChartSection[]; tables: ReportTableSection[] } {
  const competitors = demoCompetitors(location.id);
  const better = competitors.filter((c) => c.averageRank < location.averageRank).length;

  const summary: ReportMetric[] = [
    { label: "Tracked competitors", value: String(competitors.length), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Your average position", value: location.averageRank.toFixed(1), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Competitors ranking higher", value: String(better), comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Your local pack share", value: `${location.localPackCoverage}%`, comparisonLabel: null, comparisonValue: null, helpText: null },
  ];

  const tables: ReportTableSection[] = [
    {
      id: "competitor-comparison",
      title: "Competitor comparison",
      description: "Side-by-side comparison across ranking, review and authority signals.",
      columns: ["Competitor", "Avg. position", "Rating", "Reviews", "Local pack share", "Domain authority"],
      rows: [
        [`${location.businessName} (you)`, location.averageRank.toFixed(1), location.rating.toFixed(1), String(location.reviewCount), `${location.localPackCoverage}%`, "—"],
        ...competitors.map((c) => [c.name, c.averageRank.toFixed(1), c.rating.toFixed(1), String(c.reviewCount), `${c.localPackShare}%`, String(c.domainAuthority)]),
      ],
      unavailableReason: null,
    },
  ];

  return { summary, charts: [], tables };
}

function buildCitationDetail(location: DemoLocationFacts): { summary: ReportMetric[]; charts: ReportChartSection[]; tables: ReportTableSection[] } {
  const rows = DEMO_DIRECTORIES.map((directory, index) => {
    const seed = seedFrom(location.id, directory);
    const hasIssue = pickInt(seed, 0, 9) < Math.round((location.citationIssues / location.citationTotal) * 10);
    const listed = index < Math.round((location.citationTotal / DEMO_DIRECTORIES.length) * DEMO_DIRECTORIES.length);
    return {
      directory,
      status: listed ? (hasIssue ? "Inconsistent NAP" : "Listed") : "Not listed",
    };
  });

  const summary: ReportMetric[] = [
    { label: "Citation health", value: `${location.citationHealth}%`, comparisonLabel: null, comparisonValue: null, helpText: null },
    { label: "Directories listed", value: String(location.citationTotal), comparisonLabel: null, comparisonValue: null, helpText: `Out of ${DEMO_DIRECTORIES.length} audited` },
    { label: "Issues found", value: String(location.citationIssues), comparisonLabel: null, comparisonValue: null, helpText: "NAP inconsistencies or missing listings" },
  ];

  const tables: ReportTableSection[] = [
    {
      id: "citation-summary",
      title: "Directory listing summary",
      description: "Coverage and NAP consistency for every audited directory.",
      columns: ["Directory", "Status"],
      rows: rows.map((r) => [r.directory, r.status]),
      unavailableReason: null,
    },
  ];

  return { summary, charts: [], tables };
}

export function demoReportContent(type: ReportType, locationId: string) {
  const location = demoLocation(locationId);
  if (type === "rank_tracker") return buildRankTrackerDetail(location);
  if (type === "gbp_audit") return buildGbpAuditDetail(location);
  if (type === "competitor_analysis") return buildCompetitorDetail(location);
  return buildCitationDetail(location);
}

type DemoScheduleSeed = {
  id: string;
  name: string;
  type: ReportType;
  locationId: string;
  period: string;
  frequency: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: "succeeded" | "failed" | "running" | null;
  lastRunReportId: string | null;
  delivery: string;
  status: "active" | "paused" | "failed";
  failureReason: string | null;
};

const SCHEDULE_SEEDS: DemoScheduleSeed[] = [
  {
    id: "sch_riverside_north_rank_monthly",
    name: "Riverside North — Monthly Rank Tracker",
    type: "rank_tracker",
    locationId: "loc_riverside_north",
    period: "Monthly, calendar month",
    frequency: "Monthly",
    nextRunAt: demoDateAhead(19),
    lastRunAt: demoDate(11),
    lastRunStatus: "succeeded",
    lastRunReportId: "rpt_riverside_north_rank_aug",
    delivery: "3 recipients · email",
    status: "active",
    failureReason: null,
  },
  {
    id: "sch_riverside_north_gbp_monthly",
    name: "Riverside North — Monthly GBP Audit",
    type: "gbp_audit",
    locationId: "loc_riverside_north",
    period: "Monthly, calendar month",
    frequency: "Monthly",
    nextRunAt: demoDateAhead(20),
    lastRunAt: demoDate(10),
    lastRunStatus: "succeeded",
    lastRunReportId: "rpt_riverside_north_gbp_aug",
    delivery: "2 recipients · email",
    status: "active",
    failureReason: null,
  },
  {
    id: "sch_hearth_downtown_comp_biweekly",
    name: "Hearth Downtown — Biweekly Competitor Analysis",
    type: "competitor_analysis",
    locationId: "loc_hearth_downtown",
    period: "Biweekly, rolling 14 days",
    frequency: "Biweekly",
    nextRunAt: demoDateAhead(4),
    lastRunAt: demoDate(10),
    lastRunStatus: "succeeded",
    lastRunReportId: null,
    delivery: "1 recipient · email",
    status: "active",
    failureReason: null,
  },
  {
    id: "sch_lumen_main_citation_monthly",
    name: "Lumen Family Law — Monthly Citation Report",
    type: "citation_report",
    locationId: "loc_lumen_main",
    period: "Monthly, calendar month",
    frequency: "Monthly",
    nextRunAt: demoDateAhead(30),
    lastRunAt: demoDate(42),
    lastRunStatus: "failed",
    lastRunReportId: null,
    delivery: "1 recipient · email",
    status: "failed",
    failureReason: "The last run failed because directory data could not be refreshed in time.",
  },
  {
    id: "sch_summit_main_rank_weekly",
    name: "Summit Auto Care — Weekly Rank Tracker",
    type: "rank_tracker",
    locationId: "loc_summit_main",
    period: "Weekly, rolling 7 days",
    frequency: "Weekly",
    nextRunAt: demoDateAhead(2),
    lastRunAt: demoDate(6),
    lastRunStatus: "succeeded",
    lastRunReportId: "rpt_summit_main_rank_aug",
    delivery: "2 recipients · email",
    status: "paused",
    failureReason: null,
  },
];

export function demoReportSchedules(): ReportSchedule[] {
  return SCHEDULE_SEEDS.map((seed) => {
    const location = demoLocation(seed.locationId);
    return {
      id: seed.id,
      name: seed.name,
      type: seed.type,
      clientId: location.clientId,
      clientName: clientName(location.clientId),
      locationId: location.id,
      locationName: `${location.businessName} — ${location.area}`,
      period: seed.period,
      frequency: seed.frequency,
      nextRunAt: seed.nextRunAt,
      lastRunAt: seed.lastRunAt,
      lastRunStatus: seed.lastRunStatus,
      lastRunReportId: seed.lastRunReportId,
      delivery: seed.delivery,
      status: seed.status,
      failureReason: seed.failureReason,
    };
  });
}

export function demoReportKeywordGroups(): { id: string; name: string }[] {
  const groups = new Set<string>();
  demoLocationsForClient("cl_riverside")
    .concat(demoLocationsForClient("cl_hearth"), demoLocationsForClient("cl_summit"), demoLocationsForClient("cl_lumen"))
    .forEach((location) => demoKeywords(location.id).forEach((k) => groups.add(k.group)));
  return Array.from(groups).map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name }));
}

export const DEMO_COMPARISON_PERIODS = [
  { value: "previous_period", label: "Previous period" },
  { value: "same_period_last_year", label: "Same period last year" },
];
