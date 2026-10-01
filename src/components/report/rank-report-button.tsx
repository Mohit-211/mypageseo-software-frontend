import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, LoaderCircle } from "lucide-react";
import { createReport, getReport, isApiError } from "@/api";
import { ReportActions } from "@/components/report/report-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRunDate } from "@/lib/rankings/format";
import { REPORT_ACTIVE_STATUSES, REPORT_CREATE_ERRORS } from "@/lib/reports/report-meta";

/**
 * "Report" on the Rank Tracker: generates the Rank Tracker PDF for the run being
 * shown, then offers download, share and email in place.
 */
export function RankReportButton({ locationId, runId, runAt }: { locationId: string; runId: string; runAt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FileText aria-hidden /> Report
      </Button>
      {open ? <RankReportDialog locationId={locationId} runId={runId} runAt={runAt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RankReportDialog({ locationId, runId, runAt, onClose }: { locationId: string; runId: string; runAt: string; onClose: () => void }) {
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Create once per opening (a repeat while one is generating returns the same report).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createReport({ location_id: locationId, type: "rank_tracker", run_id: runId })
      .then((report) => setReportId(report.report_id))
      .catch((err: unknown) => {
        const reason = isApiError(err) ? err.reason : undefined;
        setError((reason && REPORT_CREATE_ERRORS[reason]) ?? "The report couldn't be created. Try again.");
      });
  }, [locationId, runId]);

  const report = useQuery({
    queryKey: ["reports", reportId],
    queryFn: ({ signal }) => getReport(reportId!, signal),
    enabled: Boolean(reportId),
    refetchInterval: (query) =>
      !query.state.data || REPORT_ACTIVE_STATUSES.includes(query.state.data.report.status) ? 3_000 : false,
  });
  const status = report.data?.report.status;

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rank Tracker report</DialogTitle>
          <DialogDescription>For the ranking run of {formatRunDate(runAt, true)}.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-critical">{error}</p>
        ) : status === "ready" && reportId ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 aria-hidden className="size-4 text-success" /> Your report is ready.
            </p>
            <ReportActions reportId={reportId} />
            <Button asChild variant="link" className="h-auto p-0">
              <Link to={`/locations/${locationId}/reports/${reportId}`}>View it in the app</Link>
            </Button>
          </div>
        ) : status === "failed" ? (
          <p role="alert" className="text-sm text-critical">
            The report couldn't be generated{report.data?.report.failure_reason ? `: ${report.data.report.failure_reason}` : "."}
          </p>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Generating the PDF. This usually takes under a minute; you can close this and find it under Reports.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
