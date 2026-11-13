import type { ComponentProps } from "react";
import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import type { ReportType } from "@/api";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanEdit } from "@/hooks/use-access";
import { formatRunDate } from "@/lib/rankings/format";
import { REPORT_TYPES, REPORT_TYPE_LABEL } from "@/lib/reports/report-meta";
import { useGenerateReport, type GenerateRequest } from "@/lib/reports/use-generate-report";
import { useWriteBlock } from "@/lib/white-label/write-block";
import { ReportProgress } from "./generate-report-dialog";

/**
 * "PDF report" on the Rank Tracker: generates the Rank Tracker PDF for the run being
 * shown, then offers download, share and email in place.
 */
export function RankReportButton({ locationId, runId, runAt }: { locationId: string; runId: string; runAt: string }) {
  return <ReportButton locationId={locationId} type="rank_tracker" runId={runId} subtitle={`For the ranking run of ${formatRunDate(runAt, true)}.`} />;
}

/** One click: the report is queued at once and its progress shows in a dialog, without leaving the page. */
function useReportJob() {
  const job = useGenerateReport();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<GenerateRequest | null>(null);
  const run = (next: GenerateRequest) => {
    setRequest(next);
    setOpen(true);
    void job.start(next);
  };
  return { job, open, setOpen, request, run };
}

/** "PDF report" on a page: makes that report type's PDF for the location, then download / share / email in place. */
function ReportButtonEditor({
  locationId,
  type,
  runId,
  range,
  subtitle,
  variant = "default",
}: {
  locationId: string;
  type: ReportType;
  runId?: string;
  range?: string;
  subtitle: string;
  /** "outline" where the page has another primary action (one filled button per page). */
  variant?: ButtonProps["variant"];
}) {
  const { job, open, setOpen, request, run } = useReportJob();
  const block = useWriteBlock();
  return (
    <>
      <span title={block.reason ?? undefined}>
        <Button
          variant={variant}
          disabled={block.blocked}
          onClick={() => run({ location_id: locationId, type, ...(runId ? { run_id: runId } : {}), ...(range ? { range } : {}) })}
        >
          <FileText aria-hidden /> PDF report
        </Button>
      </span>
      <ReportJobDialog open={open} onOpenChange={setOpen} job={job} type={type} subtitle={subtitle} onRetry={request ? () => run(request) : undefined} />
    </>
  );
}

/**
 * "PDF report" with a menu of every report type, for pages that cover the whole location.
 * `unavailable` disables a type with the reason shown in its place (e.g. no citation list yet).
 */
function ReportMenuButtonEditor({
  locationId,
  unavailable,
  variant = "default",
}: {
  locationId: string;
  unavailable?: Partial<Record<ReportType, string>> | undefined;
  /** "outline" where the page has another primary action. */
  variant?: ButtonProps["variant"];
}) {
  const { job, open, setOpen, request, run } = useReportJob();
  const block = useWriteBlock();
  const type = request?.type ?? "full";
  const chosen = REPORT_TYPES.find((entry) => entry.value === type);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} disabled={block.blocked} title={block.reason ?? undefined}>
            <FileText aria-hidden /> PDF report <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Create a PDF report</DropdownMenuLabel>
          {REPORT_TYPES.map((entry) => {
            const reason = unavailable?.[entry.value];
            return (
              <DropdownMenuItem
                key={entry.value}
                disabled={Boolean(reason)}
                onSelect={() => run({ location_id: locationId, type: entry.value })}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">{entry.label}</span>
                <span className="text-xs text-muted-foreground">{reason ?? entry.description}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <ReportJobDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        type={type}
        subtitle={chosen?.description ?? ""}
        onRetry={request ? () => run(request) : undefined}
      />
    </>
  );
}

function ReportJobDialog({
  open,
  onOpenChange,
  job,
  type,
  subtitle,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: ReturnType<typeof useGenerateReport>;
  type: ReportType;
  subtitle: string;
  onRetry?: (() => void) | undefined;
}) {
  const label = REPORT_TYPE_LABEL[type] ?? "Report";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <ReportProgress job={job} typeLabel={label} onBack={onRetry} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Hidden for a read-only client_user. */
export function ReportButton(props: ComponentProps<typeof ReportButtonEditor>) {
  return useCanEdit() ? <ReportButtonEditor {...props} /> : null;
}

/** Hidden for a read-only client_user. */
export function ReportMenuButton(props: ComponentProps<typeof ReportMenuButtonEditor>) {
  return useCanEdit() ? <ReportMenuButtonEditor {...props} /> : null;
}
