import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Download, LoaderCircle, Mail, Share2 } from "lucide-react";
import { downloadReportPdf, emailReport, getReport, isApiError, shareReport, type ReportStatus } from "@/api";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { ReportBlocks } from "@/components/report/report-blocks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRequiredParams } from "@/hooks/use-required-params";
import { formatRunDate } from "@/lib/rankings/format";

const ACTIVE: ReportStatus[] = ["queued", "generating"];
const STATUS_TONE: Record<ReportStatus, "info" | "success" | "critical" | "neutral"> = {
  queued: "info",
  generating: "info",
  ready: "success",
  failed: "critical",
  expired: "neutral",
  archived: "neutral",
};

/** One generated report (`GET reports/:id`), polled until it's ready. */
function LocationReportDetailPage() {
  const { locationId, reportId } = useRequiredParams("locationId", "reportId");
  const report = useQuery({
    queryKey: ["reports", reportId],
    queryFn: ({ signal }) => getReport(reportId, signal),
    refetchInterval: (query) => (query.state.data && ACTIVE.includes(query.state.data.report.status) ? 4_000 : false),
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to={`/locations/${locationId}/rankings`}><ArrowLeft aria-hidden /> Rankings</Link>
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
  const ready = record.status === "ready";

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadReportPdf(record.report_id);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(window.document.createElement("a"), { href: url, download: filename });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        isApiError(err) && err.reason === "expired"
          ? "This report has expired; its PDF is no longer kept."
          : isApiError(err) && err.reason === "not_ready"
            ? "The PDF isn't ready yet."
            : isApiError(err) && err.reason === "file_missing"
              ? "The PDF file is missing. Create the report again."
              : "The PDF couldn't be downloaded. Try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppShell>
      {back}
      <PageHeader
        title={document?.title ?? "Rank Tracker Report"}
        description={[record.location?.name, document?.period].filter(Boolean).join(" · ")}
        meta={
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <StatusBadge tone={STATUS_TONE[record.status] ?? "neutral"}>{record.status}</StatusBadge>
            {record.generated_at ? `Generated ${formatRunDate(record.generated_at, true)}` : `Requested ${formatRunDate(record.created_at, true)}`}
            {record.pdf ? ` · ${record.pdf.pages} page${record.pdf.pages === 1 ? "" : "s"}` : ""}
          </p>
        }
        actions={
          ready ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={downloading} onClick={() => void download()}>
                {downloading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} Download PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}><Share2 aria-hidden /> Share link</Button>
              <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}><Mail aria-hidden /> Email</Button>
            </div>
          ) : undefined
        }
      />

      {ACTIVE.includes(record.status) ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-surface p-6 shadow-card">
          <LoaderCircle aria-hidden className="size-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">The report is being generated. This usually takes under a minute.</p>
        </div>
      ) : record.status === "failed" ? (
        <EmptyState title="The report couldn't be generated" description={record.failure_reason ?? "Try creating it again from Rankings."} />
      ) : record.status === "expired" ? (
        <EmptyState title="This report has expired" description="Reports are kept for 24 months. Create a new one from Rankings." />
      ) : document ? (
        <Panel><ReportBlocks blocks={document.blocks} /></Panel>
      ) : null}

      {shareOpen ? <ShareDialog reportId={record.report_id} onClose={() => setShareOpen(false)} /> : null}
      {emailOpen ? <EmailDialog reportId={record.report_id} onClose={() => setEmailOpen(false)} /> : null}
    </AppShell>
  );
}

function ShareDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [days, setDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<{ url: string; expires_at: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const value = days.trim() === "" ? null : Number(days);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 365)) {
      setError("Enter 1–365 days, or leave it empty for no expiry.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      setLink(await shareReport(reportId, value));
    } catch {
      setError("The link couldn't be created. Try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>Anyone with the link can view the report and download its PDF. The link is shown only once.</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input readOnly value={link.url} aria-label="Share link" onFocus={(event) => event.currentTarget.select()} />
              <Button
                variant="outline"
                aria-label="Copy link"
                onClick={() => void navigator.clipboard.writeText(link.url).then(() => toast.success("Link copied"))}
              >
                <Copy aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{link.expires_at ? `Expires ${formatRunDate(link.expires_at)}.` : "Never expires."}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="share-days">Expires after (days)</Label>
            <Input id="share-days" inputMode="numeric" value={days} placeholder="No expiry" onChange={(event) => setDays(event.target.value)} />
            {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{link ? "Done" : "Cancel"}</Button>
          {!link ? (
            <Button disabled={creating} onClick={() => void create()}>
              {creating ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Create link
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const list = recipients.split(/[,;\s]+/).map((value) => value.trim()).filter(Boolean);
    if (list.length === 0 || list.some((value) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))) {
      setError("Enter one or more valid email addresses, separated by commas.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await emailReport(reportId, list, message.trim() || undefined);
      toast.success(`Report sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}${result.delivery === "link" ? " as a link" : ""}.`);
      onClose();
    } catch (err) {
      setError(isApiError(err) && err.reason === "rate_limited" ? "Too many emails this hour. Try again later." : "The email couldn't be sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || sending ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email this report</DialogTitle>
          <DialogDescription>The PDF is attached (or linked when it's large).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email-recipients">Recipients</Label>
            <Input id="email-recipients" value={recipients} placeholder="owner@example.com, manager@example.com" onChange={(event) => setRecipients(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-message">Message (optional)</Label>
            <Textarea id="email-message" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
          </div>
          {error ? <p role="alert" className="text-sm text-critical">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button disabled={sending} onClick={() => void send()}>
            {sending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Mail aria-hidden />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationReportDetailPage;
