import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeft, CalendarClock, FilePlus2, Info, Stamp } from "lucide-react";
import { getReport, isApiError, type ReportRow, type ReportStatus, type ReportType } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { EmptyState, ErrorState, PageSkeleton, ProcessingState } from "@/components/layout/shared/feedback/states";
import { ReportActions } from "@/components/report/report-actions";
import { ReportBlocks } from "@/components/report/report-blocks";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reportTypeIcon } from "@/lib/reports/report-icons";
import {
  REPORT_ACTIVE_STATUSES,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  REPORT_TYPES,
  REPORT_TYPE_LABEL,
  reportRangeLabel,
} from "@/lib/reports/report-meta";
import { GenerateReportDialog } from "./generate-report-dialog";

/** One generated report (`GET reports/:id`), polled until it's ready, with what it is and where it came from. */
export function ReportDetailView({ reportId, backTo, backLabel }: { reportId: string; backTo: string; backLabel: string }) {
  const navigate = useNavigate();
  const canEdit = useCanEdit();
  const [recreating, setRecreating] = useState(false);
  const report = useQuery({
    queryKey: ["reports", reportId],
    queryFn: ({ signal }) => getReport(reportId, signal),
    refetchInterval: (query) => (query.state.data && REPORT_ACTIVE_STATUSES.includes(query.state.data.report.status) ? 4_000 : false),
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 -mb-2 self-start text-muted-foreground hover:text-foreground">
      <Link to={backTo}>
        <ArrowLeft aria-hidden /> {backLabel}
      </Link>
    </Button>
  );

  if (report.isPending) {
    return (
      <>
        {back}
        <PageSkeleton metrics={0} rows={8} columns={4} />
      </>
    );
  }
  if (report.isError) {
    return (
      <>
        {back}
        {isApiError(report.error) && report.error.status === 404 ? (
          <EmptyState
            title="Report not found"
            description="It may have been removed, or it belongs to another organization."
            action={
              <Button asChild variant="outline">
                <Link to={backTo}>Back to {backLabel}</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState description="The report couldn't be loaded." onRetry={() => void report.refetch()} />
        )}
      </>
    );
  }

  const { document } = report.data;
  const record = report.data.report as ReportRow;
  const status: ReportStatus = record.status;
  const Icon = reportTypeIcon(record.type);
  const typeLabel = REPORT_TYPE_LABEL[record.type] ?? "Report";
  // The page uses the name the list and the create dialog use; the PDF's own title (e.g. "Local SEO
  // Report" for a Full report) is named too, so the page still matches what the client receives.
  const pdfTitle = document?.title && document.title.toLowerCase() !== typeLabel.toLowerCase() ? `PDF title: ${document.title}` : null;
  const canRecreate = canEdit && Boolean(record.location && !record.location.deleted) && REPORT_TYPES.some((entry) => entry.value === record.type);
  const recreate = canRecreate ? (
    <Button onClick={() => setRecreating(true)}>
      <FilePlus2 aria-hidden /> Create it again
    </Button>
  ) : undefined;

  return (
    <>
      {back}
      <PageHeader
        icon={Icon}
        tone="reports"
        title={typeLabel}
        description={[pdfTitle, record.location?.name, document?.period ?? reportRangeLabel(record.range)].filter(Boolean).join(" · ")}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <StatusBadge tone={REPORT_STATUS_TONE[status] ?? "neutral"}>{REPORT_STATUS_LABEL[status] ?? status}</StatusBadge>
            <span>{record.generated_at ? `Generated ${formatDateTime(record.generated_at)}` : `Requested ${formatDateTime(record.created_at)}`}</span>
            {record.pdf ? (
              <span>
                {record.pdf.pages} page{record.pdf.pages === 1 ? "" : "s"}
              </span>
            ) : null}
            {record.trigger === "schedule" ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock aria-hidden className="size-3.5" /> Sent by a monthly email
              </span>
            ) : null}
          </div>
        }
        actions={status === "ready" ? <ReportActions reportId={record.report_id} onArchived={() => void navigate(backTo)} /> : undefined}
      />

      {REPORT_ACTIVE_STATUSES.includes(status) ? (
        <ProcessingState title="Generating your report" description="This usually takes under a minute. The page updates by itself when the PDF is ready." />
      ) : status === "failed" ? (
        <ErrorState
          title="The report couldn't be generated"
          description={record.failure_reason ?? "Something went wrong while making the PDF."}
          action={recreate}
        />
      ) : status === "expired" ? (
        <EmptyState
          title="This report has expired"
          description="Reports are kept for 24 months, then their PDF and contents are removed. Create a fresh one."
          action={recreate}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {status === "archived" ? (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-foreground">
                <Archive aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                Archived: it's out of your PDF reports list and its share links no longer open.
              </p>
            ) : null}
            {document ? (
              <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card sm:p-6">
                <ReportBlocks blocks={document.blocks} />
              </article>
            ) : (
              <EmptyState compact title="Nothing to show" description="This report has no content to display in the app. Download its PDF instead." />
            )}
          </div>
          <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-xl border border-border bg-card shadow-card">
              <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">About this report</h2>
              <dl className="divide-y divide-border text-sm">
                <Fact label="Location">
                  {record.location ? (
                    record.location.deleted ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {record.location.name ?? "Unnamed location"}
                        <StatusBadge tone="neutral" size="sm">
                          Deleted location
                        </StatusBadge>
                      </span>
                    ) : (
                      <Link
                        to={locationPath(record.location.location_id)}
                        className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {record.location.name ?? "Open the location"}
                      </Link>
                    )
                  ) : (
                    "—"
                  )}
                </Fact>
                {record.client?.name ? <Fact label="Client">{record.client.name}</Fact> : null}
                <Fact label="Report">{typeLabel}</Fact>
                {record.run_at ? <Fact label="Ranking run">{formatDate(record.run_at)}</Fact> : null}
                {record.range ? <Fact label="Period">{reportRangeLabel(record.range)}</Fact> : null}
                {record.expires_at ? <Fact label="Kept until">{formatDate(record.expires_at)}</Fact> : null}
              </dl>
              <p className="flex items-start gap-2 border-t border-border bg-surface-strong px-4 py-3 text-xs text-muted-foreground">
                <Stamp aria-hidden className="mt-px size-3.5 shrink-0" />
                The brand and the numbers are frozen when a report is made, so later changes never alter it.
              </p>
            </div>
            <p className="mt-3 flex items-start gap-2 px-1 text-xs text-muted-foreground">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              The PDF has the same content, laid out for print.
            </p>
          </aside>
        </div>
      )}

      {canRecreate ? (
        <GenerateReportDialog
          open={recreating}
          onOpenChange={setRecreating}
          locationId={record.location?.location_id ?? null}
          lockLocation
          defaultType={record.type as ReportType}
        />
      ) : null}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}
