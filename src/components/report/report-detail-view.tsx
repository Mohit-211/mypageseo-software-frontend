import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { getReport, isApiError, type ReportStatus } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { ReportActions } from "@/components/report/report-actions";
import { ReportBlocks } from "@/components/report/report-blocks";
import { Button } from "@/components/ui/button";
import { formatRunDate } from "@/lib/rankings/format";
import { REPORT_ACTIVE_STATUSES, REPORT_STATUS_LABEL, REPORT_STATUS_TONE, REPORT_TYPE_LABEL } from "@/lib/reports/report-meta";

/** One generated report (`GET reports/:id`), polled until it's ready. */
export function ReportDetailView({ reportId, backTo, backLabel }: { reportId: string; backTo: string; backLabel: string }) {
  const report = useQuery({
    queryKey: ["reports", reportId],
    queryFn: ({ signal }) => getReport(reportId, signal),
    refetchInterval: (query) =>
      query.state.data && REPORT_ACTIVE_STATUSES.includes(query.state.data.report.status) ? 4_000 : false,
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to={backTo}><ArrowLeft aria-hidden /> {backLabel}</Link>
    </Button>
  );

  if (report.isPending) return <AppShell>{back}<PageSkeleton /></AppShell>;
  if (report.isError) {
    return (
      <AppShell>
        {back}
        {isApiError(report.error) && report.error.status === 404 ? (
          <EmptyState title="Report not found" description="It may have been removed or belong to another organization." />
        ) : (
          <ErrorState description="The report couldn't be loaded." onRetry={() => void report.refetch()} />
        )}
      </AppShell>
    );
  }

  const { report: record, document } = report.data;
  const status: ReportStatus = record.status;

  return (
    <AppShell>
      {back}
      <PageHeader
        title={document?.title ?? REPORT_TYPE_LABEL[record.type] ?? "Report"}
        description={[record.location?.name, document?.period].filter(Boolean).join(" · ")}
        meta={
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone={REPORT_STATUS_TONE[status] ?? "neutral"}>{REPORT_STATUS_LABEL[status] ?? status}</StatusBadge>
            {record.generated_at ? `Generated ${formatRunDate(record.generated_at, true)}` : `Requested ${formatRunDate(record.created_at, true)}`}
            {record.run_at ? ` · ranking run of ${formatRunDate(record.run_at)}` : ""}
            {record.pdf ? ` · ${record.pdf.pages} page${record.pdf.pages === 1 ? "" : "s"}` : ""}
          </p>
        }
        actions={status === "ready" ? <ReportActions reportId={record.report_id} /> : undefined}
      />

      {REPORT_ACTIVE_STATUSES.includes(status) ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-6 shadow-card">
          <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">The report is being generated. This usually takes under a minute.</p>
        </div>
      ) : status === "failed" ? (
        <EmptyState title="The report couldn't be generated" description={record.failure_reason ?? "Try creating it again."} />
      ) : status === "expired" ? (
        <EmptyState title="This report has expired" description="Reports are kept for 24 months. Create a new one." />
      ) : document ? (
        <Panel><ReportBlocks blocks={document.blocks} /></Panel>
      ) : null}
    </AppShell>
  );
}
