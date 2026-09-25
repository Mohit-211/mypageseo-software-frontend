import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ReportBody, ReportIdentity } from "@/components/mypageseo/report-detail";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { REPORT_TYPE_LABEL, getReportDetail } from "@/lib/mypageseo/reports";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useRequiredParams } from "@/hooks/use-required-params";

const description = "Inspect a generated Mypageseo report before downloading, sharing or taking further action.";



function BackToReports() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/reports">Back to reports</Link>
    </Button>
  );
}

function ReportDetailPage() {
  const { reportId } = useRequiredParams("reportId");
  const workspace = useWorkspace();
  const result = getReportDetail(reportId);

  if (workspace.status === "loading" || result.status === "loading") {
    return (
      <AppShell>
        <div className="space-y-4">
          <div role="status" aria-live="polite" className="h-9 w-64 animate-pulse rounded-md bg-muted" aria-label="Loading report" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </AppShell>
    );
  }

  if (workspace.status === "unavailable" || result.status === "error") {
    return (
      <AppShell>
        <PageHeader title="Report" description={description} actions={<BackToReports />} />
        <ErrorState
          description="We couldn't load this report. Try again without leaving this page."
          onRetry={() => window.location.reload()}
        />
      </AppShell>
    );
  }

  const report = result.report;

  if (result.status === "not_found" || !report) {
    return (
      <AppShell>
        <PageHeader title="Report" description={description} actions={<BackToReports />} />
        <EmptyState
          title="This report isn't available"
          description="No generated report exists for this link. Reports appear here once ranking, Google Business Profile, citation or competitor data has been collected and a report has been generated."
          action={
            <Button asChild size="sm">
              <Link to="/reports/create">Create report</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const capabilities = report.capabilities;

  return (
    <AppShell>
      <PageHeader
        title={report.name}
        description={`${REPORT_TYPE_LABEL[report.type]}${report.period ? ` · ${report.period}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BackToReports />
            {capabilities.canEdit ? (
              <Button variant="outline" size="sm">Edit</Button>
            ) : null}
            {capabilities.canSchedule ? (
              <Button variant="outline" size="sm">Schedule</Button>
            ) : null}
            {capabilities.canShare ? (
              <Button variant="outline" size="sm">Share</Button>
            ) : null}
            {capabilities.canRegenerate ? (
              <Button variant="outline" size="sm">Regenerate</Button>
            ) : null}
            {capabilities.canDownload && report.downloadUrl ? (
              <Button asChild size="sm">
                <a href={report.downloadUrl} download>Download</a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-6">
        <ReportIdentity report={report} />

        {report.state === "processing" ? (
          <EmptyState
            title="Report is being generated"
            description="This report is still processing. The content will appear here once generation finishes."
          />
        ) : report.state === "failed" ? (
          <ErrorState
            description={report.failureReason ?? "Report generation failed."}
            {...(capabilities.canRegenerate ? { onRetry: () => window.location.reload() } : {})}
          />
        ) : (
          <ReportBody report={report} />
        )}
      </div>
    </AppShell>
  );
}

export default ReportDetailPage;
