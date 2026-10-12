import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Download, LoaderCircle, Mail, Share2 } from "lucide-react";
import { archiveReport, downloadReportPdf, emailReport, getReportShares, isApiError, revokeReportShare, shareReport } from "@/api";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { useCanEdit } from "@/hooks/use-access";
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
import { formatRunDate } from "@/lib/rankings/format";

/** Download PDF, share link and email for a ready report. */
export function ReportActions({ reportId, size = "sm" }: { reportId: string; size?: "sm" | "default" }) {
  const canEdit = useCanEdit();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const link = Object.assign(window.document.createElement("a"), { href: url, download: filename });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      toast.error(
        reason === "expired"
          ? "This report has expired; its PDF is no longer kept."
          : reason === "not_ready"
            ? "The PDF isn't ready yet."
            : reason === "file_missing"
              ? "The PDF file is missing. Create the report again."
              : "The PDF couldn't be downloaded. Try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} disabled={downloading} onClick={() => void download()}>
        {downloading ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />} Download PDF
      </Button>
      {canEdit ? (
        <>
          <Button size={size} variant="outline" onClick={() => setShareOpen(true)}><Share2 aria-hidden /> Share link</Button>
          <Button size={size} variant="outline" onClick={() => setEmailOpen(true)}><Mail aria-hidden /> Email</Button>
          <Button size={size} variant="ghost" disabled={archiving} onClick={() => setConfirmArchive(true)}>
            {archiving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Archive aria-hidden />} Archive
          </Button>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this report?"
        description="It leaves the library (find it under the Archived filter). Its share links stop working."
        confirmLabel="Archive"
        onConfirm={() => {
          setConfirmArchive(false);
          setArchiving(true);
          void archiveReport(reportId)
            .then(() => {
              void queryClient.invalidateQueries({ queryKey: ["reports"] });
              toast.success("Report archived.");
              navigate("/reports");
            })
            .catch(() => toast.error("The report couldn't be archived. Try again."))
            .finally(() => setArchiving(false));
        }}
      />
      {shareOpen ? <ShareDialog reportId={reportId} onClose={() => setShareOpen(false)} /> : null}
      {emailOpen ? <EmailDialog reportId={reportId} onClose={() => setEmailOpen(false)} /> : null}
    </div>
  );
}

function ShareDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const shares = useQuery({ queryKey: ["reports", reportId, "shares"], queryFn: ({ signal }) => getReportShares(reportId, signal), retry: false });
  const [revoking, setRevoking] = useState<string | null>(null);
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
      void shares.refetch();
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
          <DialogDescription>Anyone with the link can view the report and download its PDF. Copy it now: the link is shown only once.</DialogDescription>
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
        {shares.data && shares.data.length > 0 ? (
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Existing links</p>
            <ul className="space-y-1.5">
              {shares.data.map((share) => (
                <li key={share.share_id} className="flex items-center justify-between gap-2 text-xs">
                  <span className={share.active ? "text-foreground" : "text-muted-foreground line-through"}>
                    {share.purpose === "email_link" ? "Email link" : "Share link"} · created {formatRunDate(share.created_at)}
                    {share.expires_at ? ` · expires ${formatRunDate(share.expires_at)}` : ""} · {share.views} view{share.views === 1 ? "" : "s"}
                  </span>
                  {share.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-critical"
                      disabled={revoking !== null}
                      onClick={() => {
                        setRevoking(share.share_id);
                        void revokeReportShare(reportId, share.share_id)
                          .then(() => shares.refetch())
                          .catch(() => toast.error("The link couldn't be revoked."))
                          .finally(() => setRevoking(null));
                      }}
                    >
                      {revoking === share.share_id ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Revoke
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">{share.revoked_at ? "Revoked" : "Expired"}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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

