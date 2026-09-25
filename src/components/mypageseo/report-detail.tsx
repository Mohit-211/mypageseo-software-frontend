import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  Panel,
  SectionHeader,
  StatusBadge,
  type StatusTone,
} from "@/components/mypageseo/data-display";
import { EmptyState } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import {
  REPORT_STATE_LABEL,
  REPORT_TYPE_LABEL,
  type ReportDetail,
  type ReportState,
  type ReportTableSection,
  type ReportType,
} from "@/lib/mypageseo/reports";

const stateTone: Record<ReportState, StatusTone> = {
  generated: "success",
  scheduled: "info",
  processing: "warning",
  failed: "critical",
};

/** Short explanation shown under each report type's content. */
const typeIntro: Record<ReportType, string> = {
  rank_tracker: "Tracked keyword positions, movement and Local Pack coverage for the reporting period.",
  gbp_audit: "Google Business Profile health findings recorded when the audit ran.",
  competitor_analysis: "Comparison against tracked local competitors across available signals.",
  citation_report: "Directory listing coverage and NAP consistency across audited directories.",
};

export function ReportIdentity({ report }: { report: ReportDetail }) {
  const branding = report.branding;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3 text-xs text-muted-foreground">
      {branding?.logoUrl ? (
        <img src={branding.logoUrl} alt={`${branding.companyName ?? "Report"} logo`} className="h-6 w-auto" />
      ) : null}
      <span className="font-medium text-foreground">{branding?.companyName ?? "Mypageseo"}</span>
      <span>{REPORT_TYPE_LABEL[report.type]}</span>
      {report.clientName ? <span>Client: {report.clientName}</span> : null}
      {report.locationName ? <span>Location: {report.locationName}</span> : null}
      {report.period ? <span>Period: {report.period}</span> : null}
      {report.comparisonPeriod ? <span>Compared with: {report.comparisonPeriod}</span> : null}
      {report.generatedAt ? <span>Generated {report.generatedAt}</span> : null}
      <StatusBadge tone={stateTone[report.state]}>{REPORT_STATE_LABEL[report.state]}</StatusBadge>
    </div>
  );
}

export function ReportBody({ report }: { report: ReportDetail }) {
  const hasContent = report.summary.length > 0 || report.charts.length > 0 || report.tables.length > 0;

  if (!hasContent) {
    return (
      <EmptyState
        title="This report contains no data"
        description="The underlying ranking, Google Business Profile, citation or competitor data was not available when this report was generated."
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{typeIntro[report.type]}</p>

      {report.summary.length > 0 ? (
        <Panel title="Summary">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {report.summary.map((metric) => (
              <div key={metric.label} className="rounded-md border border-border p-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-foreground">{metric.value ?? "Not available"}</dd>
                {metric.comparisonValue ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.comparisonLabel ?? "Comparison period"}: {metric.comparisonValue}
                  </p>
                ) : null}
                {metric.helpText ? <p className="mt-1 text-xs text-muted-foreground">{metric.helpText}</p> : null}
              </div>
            ))}
          </dl>
        </Panel>
      ) : null}

      {report.charts.map((chart) => (
        <Panel key={chart.id}>
          {chart.unavailableReason || chart.points.length === 0 ? (
            <div>
              <SectionHeader title={chart.title} {...(chart.description ? { description: chart.description } : {})} />
              <p className="text-sm text-muted-foreground">
                {chart.unavailableReason ?? "No data was available for this section."}
              </p>
            </div>
          ) : (
            <ChartContainer
              title={chart.title}
              {...(chart.description ? { description: chart.description } : {})}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" name="Current period" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                  <Line
                    type="monotone"
                    dataKey="comparisonValue"
                    name="Comparison period"
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </Panel>
      ))}

      {report.tables.map((table) => (
        <ReportTable key={table.id} section={table} />
      ))}

      <ReportModuleLinks report={report} />
    </div>
  );
}

function ReportTable({ section }: { section: ReportTableSection }) {
  return (
    <Panel title={section.title} {...(section.description ? { description: section.description } : {})}>
      {section.unavailableReason || section.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {section.unavailableReason ?? "No rows were available for this section."}
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {section.columns.map((column) => (
                  <th key={column} className="px-4 py-2 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-2.5 text-foreground">{cell ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Links back into the operational module the report was built from. */
function ReportModuleLinks({ report }: { report: ReportDetail }) {
  if (!report.locationId) return null;
  const locationId = report.locationId;

  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {report.type === "rank_tracker" ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/locations/${locationId}/rankings`}>Open Rankings</Link>
        </Button>
      ) : null}
      {report.type === "gbp_audit" ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/locations/${locationId}/gbp/audit`}>Open GBP Audit</Link>
        </Button>
      ) : null}
      {report.type === "citation_report" ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/locations/${locationId}/citations`}>Open Citations</Link>
        </Button>
      ) : null}
      {report.type === "competitor_analysis" ? (
        <Button asChild variant="outline" size="sm">
          <Link to={`/locations/${locationId}/competitors`}>Open Competitors</Link>
        </Button>
      ) : null}
    </div>
  );
}
