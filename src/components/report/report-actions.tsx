import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Check, Copy, Download, Link2, LoaderCircle, Mail, Share2 } from "lucide-react";
import { archiveReport, emailReport, getReportShares, isApiError, revokeReportShare, shareReport } from "@/api";
import { ConfirmDialog, FormTextField, FormTextareaField } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useCanEdit } from "@/hooks/use-access";
import { formatDate } from "@/lib/datetime";
import { MAX_RECIPIENTS, parseRecipients } from "@/lib/reports/report-meta";
import { useReportPdfDownload } from "@/lib/reports/use-report-pdf";
import { useWhiteLabelAccess } from "@/lib/white-label/access";
import { useWriteBlock } from "@/lib/white-label/write-block";

/**
 * Download PDF, share link, email and archive for a ready report. A client user only downloads.
 * `onArchived` decides what happens after archiving (default: back to the reports list).
 */
export function ReportActions({
  reportId,
  size = "sm",
  showArchive = true,
  onArchived,
}: {
  reportId: string;
  size?: "sm" | "default";
  showArchive?: boolean;
  onArchived?: () => void;
}) {
  const canEdit = useCanEdit();
  const block = useWriteBlock();
  const { download, downloading } = useReportPdfDownload();
  const [dialog, setDialog] = useState<"share" | "email" | "archive" | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size={size} disabled={downloading !== null} aria-busy={downloading !== null || undefined} onClick={() => void download(reportId)}>
        {downloading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} Download PDF
      </Button>
      {canEdit ? (
        <>
          <Button size={size} variant="outline" onClick={() => setDialog("share")}>
            <Share2 aria-hidden /> Share link
          </Button>
          <span title={block.reason ?? undefined}>
            <Button size={size} variant="outline" disabled={block.blocked} onClick={() => setDialog("email")}>
              <Mail aria-hidden /> Email
            </Button>
          </span>
          {showArchive ? (
            <Button size={size} variant="ghost" onClick={() => setDialog("archive")}>
              <Archive aria-hidden /> Archive
            </Button>
          ) : null}
        </>
      ) : null}
      {dialog === "share" ? <ShareDialog reportId={reportId} onClose={() => setDialog(null)} /> : null}
      {dialog === "email" ? <EmailDialog reportId={reportId} onClose={() => setDialog(null)} /> : null}
      <ArchiveReportDialog reportId={reportId} open={dialog === "archive"} onOpenChange={(open) => setDialog(open ? "archive" : null)} onArchived={onArchived} />
    </div>
  );
}

/** Confirms, archives (it leaves the list; its share links stop working) and says where to find it. */
export function ArchiveReportDialog({
  reportId,
  open,
  onOpenChange,
  onArchived,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { reportsPath } = useWhiteLabelAccess();
  const [pending, setPending] = useState(false);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
      title="Archive this report?"
      description="It leaves your PDF reports (find it again with Status → Archived) and its share links stop working. The PDF itself is kept."
      confirmLabel="Archive"
      pending={pending}
      onConfirm={() => {
        setPending(true);
        void archiveReport(reportId)
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ["reports"] });
            toast.success("Report archived. Find it under Status → Archived.");
            onOpenChange(false);
            if (onArchived) onArchived();
            else void navigate(reportsPath);
          })
          .catch(() => toast.error("The report couldn't be archived. Try again."))
          .finally(() => setPending(false));
      }}
    />
  );
}

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never" },
] as const;
type Expiry = (typeof EXPIRY_OPTIONS)[number]["value"];

/** A public link to the report (view and PDF). The URL is shown once, so it's copied right away. */
export function ShareDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const shares = useQuery({ queryKey: ["reports", reportId, "shares"], queryFn: ({ signal }) => getReportShares(reportId, signal), retry: false });
  const [revoking, setRevoking] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<{ url: string; expires_at: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { canWhiteLabel } = useWhiteLabelAccess();

  const copy = (url: string) =>
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Link copied");
      },
      () => toast.error("Couldn't copy. Select the link and copy it yourself."),
    );

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await shareReport(reportId, expiry === "never" ? null : Number(expiry));
      setLink(created);
      void shares.refetch();
    } catch (err) {
      setError(isApiError(err) && err.reason === "read_only" ? "Your access is read-only." : "The link couldn't be created. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const activeShares = shares.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => (open || creating ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>Anyone with the link can view this report and download its PDF.</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-2 rounded-lg border border-success/25 bg-success-surface/50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Check aria-hidden className="size-4 text-success" /> Link ready. Copy it now: it's shown only once.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link.url}
                aria-label="Share link"
                onFocus={(event) => event.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-xs text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button onClick={() => copy(link.url)}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{link.expires_at ? `Works until ${formatDate(link.expires_at)}.` : "Never expires. Revoke it here any time."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Link expires after</p>
            <SegmentedControl size="sm" aria-label="Link expires after" value={expiry} onValueChange={setExpiry} options={EXPIRY_OPTIONS} />
            {error ? (
              <p role="alert" className="text-sm font-medium text-critical">
                {error}
              </p>
            ) : null}
          </div>
        )}
        {canWhiteLabel ? (
          <p className="flex items-start gap-2 rounded-lg bg-brand-tint/60 px-3 py-2 text-xs text-foreground">
            <Link2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
            For a page that updates itself every month, send the location's client link instead (White Label → Client links).
          </p>
        ) : null}
        {activeShares.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links made so far</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {activeShares.map((share) => (
                <li key={share.share_id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                      {share.purpose === "email_link" ? "Email link" : "Share link"}
                      {share.active ? (
                        <StatusBadge tone="success" size="sm">
                          Active
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral" size="sm">
                          {share.revoked_at ? "Revoked" : "Expired"}
                        </StatusBadge>
                      )}
                    </span>
                    <span className="block text-muted-foreground">
                      Made {formatDate(share.created_at)}
                      {share.expires_at ? ` · until ${formatDate(share.expires_at)}` : " · no expiry"} · {share.views} view{share.views === 1 ? "" : "s"}
                    </span>
                  </span>
                  {share.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-critical hover:text-critical"
                      disabled={revoking !== null}
                      onClick={() => {
                        setRevoking(share.share_id);
                        void revokeReportShare(reportId, share.share_id)
                          .then(() => shares.refetch())
                          .then(() => toast.success("Link revoked. It no longer opens."))
                          .catch(() => toast.error("The link couldn't be revoked. Try again."))
                          .finally(() => setRevoking(null));
                      }}
                    >
                      {revoking === share.share_id ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={creating}>
            {link ? "Done" : "Cancel"}
          </Button>
          {!link ? (
            <Button disabled={creating} aria-busy={creating || undefined} onClick={() => void create()}>
              {creating ? <LoaderCircle aria-hidden className="animate-spin" /> : <Share2 aria-hidden />} Create link
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function emailErrorText(error: unknown): string {
  if (!isApiError(error)) return "The email couldn't be sent. Try again.";
  if (error.reason === "rate_limited") return "That's the most emails for this hour (20). Try again later.";
  if (error.reason === "subscription_required") return "Your account is read-only until it has an active subscription.";
  if (error.reason === "organization_suspended") return "This account is suspended. Contact support to restore it.";
  if (error.reason === "read_only") return "Your access is read-only.";
  if (error.status === 409) return "This report can't be emailed (it's archived or not ready).";
  return error.status === 400 && error.message ? error.message : "The email couldn't be sent. Try again.";
}

const MESSAGE_MAX = 1000;

/** Emails the PDF (attached, or linked when it's large) with an optional note. Sender and reply-to come from the brand. */
export function EmailDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [recipients, setRecipients] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const parsed = parseRecipients(recipients);
  const fieldError = tried ? parsed.error : null;

  const send = async () => {
    if (sending) return;
    setTried(true);
    if (parsed.error) return;
    setSending(true);
    setError(null);
    try {
      const result = await emailReport(reportId, parsed.recipients, message.trim() || undefined);
      toast.success(`Report sent to ${result.recipients} recipient${result.recipients === 1 ? "" : "s"}${result.delivery === "link" ? " as a link (the PDF is large)" : ""}.`);
      onClose();
    } catch (err) {
      setError(emailErrorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || sending ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email this report</DialogTitle>
          <DialogDescription>The PDF is attached, or linked when it's large. It comes from your brand's sender name and reply-to address.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormTextField
            id="email-recipients"
            label="Recipients"
            value={recipients}
            onChange={setRecipients}
            placeholder="owner@example.com, manager@example.com"
            inputMode="email"
            autoComplete="off"
            error={fieldError}
            hint={`Separate addresses with commas. Up to ${MAX_RECIPIENTS}.`}
          />
          <FormTextareaField
            id="email-message"
            label="Message"
            optional
            rows={3}
            value={message}
            onChange={setMessage}
            maxLength={MESSAGE_MAX}
            hint={`${message.length}/${MESSAGE_MAX}`}
          />
          {error ? (
            <p role="alert" className="text-sm font-medium text-critical">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button disabled={sending} aria-busy={sending || undefined} onClick={() => void send()}>
            {sending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Mail aria-hidden />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
