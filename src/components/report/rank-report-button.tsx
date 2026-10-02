import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, FileText, LoaderCircle } from "lucide-react";
import { createReport, getReport, isApiError, type ReportType } from "@/api";
import { ReportActions } from "@/components/report/report-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRunDate } from "@/lib/rankings/format";
import { REPORT_ACTIVE_STATUSES, REPORT_CREATE_ERRORS, REPORT_TYPES, REPORT_TYPE_LABEL } from "@/lib/reports/report-meta";

/**
 * "Report" on the Rank Tracker: generates the Rank Tracker PDF for the run being
 * shown, then offers download, share and email in place.
 */
export function RankReportButton({ locationId, runId, runAt }: { locationId: string; runId: string; runAt: string }) {
  return <ReportButton locationId={locationId} type="rank_tracker" runId={runId} subtitle={`For the ranking run of ${formatRunDate(runAt, true)}.`} />;
}

/** "Report" on a page: makes that report type's PDF for the location, then download / share / email in place. */
export function ReportButton({
  locationId,
  type,
  runId,
  range,
  subtitle,
}: {
  locationId: string;
  type: ReportType;
  runId?: string;
  range?: string;
  subtitle: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FileText aria-hidden /> Report
      </Button>
      {open ? (
        <ReportDialog
          locationId={locationId}
          type={type}
          {...(runId ? { runId } : {})}
          {...(range ? { range } : {})}
          subtitle={subtitle}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/** "Report" with a menu of every report type, for pages that cover the whole location. */
export function ReportMenuButton({ locationId }: { locationId: string }) {
  const [type, setType] = useState<ReportType | null>(null);
  const chosen = REPORT_TYPES.find((entry) => entry.value === type);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <FileText aria-hidden /> Report <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Create a PDF report</DropdownMenuLabel>
          {REPORT_TYPES.map((entry) => (
            <DropdownMenuItem key={entry.value} onSelect={() => setType(entry.value)} className="flex-col items-start gap-0.5">
              <span className="font-medium">{entry.label}</span>
              <span className="text-xs text-muted-foreground">{entry.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {type && chosen ? <ReportDialog locationId={locationId} type={type} subtitle={chosen.description} onClose={() => setType(null)} /> : null}
    </>
  );
}

function ReportDialog({
  locationId,
  type,
  runId,
  range,
  subtitle,
  onClose,
}: {
  locationId: string;
  type: ReportType;
  runId?: string;
  range?: string;
  subtitle: string;
  onClose: () => void;
}) {
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Create once per opening (a repeat while one is generating returns the same report).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createReport({ location_id: locationId, type, ...(runId ? { run_id: runId } : {}), ...(range ? { range } : {}) })
      .then((report) => setReportId(report.report_id))
      .catch((err: unknown) => {
        const reason = isApiError(err) ? err.reason : undefined;
        setError((reason && REPORT_CREATE_ERRORS[reason]) ?? "The report couldn't be created. Try again.");
      });
  }, [locationId, type, runId, range]);

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
          <DialogTitle>{REPORT_TYPE_LABEL[type] ?? "Report"}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
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
