import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Copy, ExternalLink, LoaderCircle, Pencil, Send, ShieldAlert, Sparkles, Star, Trash2 } from "lucide-react";
import {
  deleteReply,
  deleteReplyDraft,
  draftAppeal,
  generateReplyDrafts,
  saveReplyDraft,
  sendReplies,
  setReportStatus,
  type Review,
  type ReviewReportStatus,
  type ReviewsSummary,
} from "@/api";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

/** Google's Reviews Management Tool (Google has no API to report a review). */
const GOOGLE_REPORT_URL = "https://support.google.com/business/workflow/16726127";

const REPORT_STATUS_LABEL: Record<ReviewReportStatus, string> = {
  not_reported: "Not reported",
  reported: "Reported to Google",
  appeal_submitted: "Appeal submitted",
  removed: "Removed by Google",
  kept: "Google kept it",
};

const POLICY_LABEL: Record<string, string> = {
  spam: "Spam",
  off_topic: "Off-topic",
  conflict_of_interest: "Conflict of interest",
  offensive: "Offensive",
  harassment: "Harassment",
  hate_speech: "Hate speech",
  personal_information: "Personal information",
  restricted_content: "Restricted content",
  none_applies: "No policy clearly applies",
};

const SKIP_REASON: Record<string, string> = {
  has_reply: "Already replied.",
  suspicious: "Flagged as suspicious; review it before replying.",
  no_text: "No written review.",
};

function replyText(reply: Review["reply"]): string | null {
  if (!reply) return null;
  return typeof reply === "string" ? reply : reply.comment;
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return null;
  return (
    <span className="inline-flex items-center" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} aria-hidden className={cn("size-3.5", value <= rating ? "fill-warning text-warning" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

/** One review with its reply, flags, AI analysis and removal-request draft. */
export function ReviewCard({
  locationId,
  review,
  summary,
  selected,
  onSelect,
}: {
  locationId: string;
  review: Review;
  summary: ReviewsSummary;
  selected: boolean;
  onSelect: (checked: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reportUrl, setReportUrl] = useState(GOOGLE_REPORT_URL);
  const ai = summary.ai;
  const aiUsable = ai.configured && !ai.paused_today;
  const published = replyText(review.reply);
  const draftText = text ?? review.draft?.text ?? (editing ? (published ?? "") : "");
  const showEditor = editing || review.reply_state === "draft" || review.reply_state === "failed";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
    void queryClient.invalidateQueries({ queryKey: ["billing", "tokens"] });
  };
  const fail = (err: unknown, fallback: string) => {
    const { message, buyTokens } = reviewErrorMessage(err, fallback);
    toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
  };
  const run = async (key: string, action: () => Promise<unknown>, fallback: string, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      return true;
    } catch (err) {
      fail(err, fallback);
      return false;
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const save = () => {
    const value = draftText.trim();
    if (!value || value.length > 4000) {
      toast.error("A reply needs 1–4,000 characters.");
      return Promise.resolve(false);
    }
    return run("save", () => saveReplyDraft(locationId, review.review_id, value), "The reply couldn't be saved.");
  };
  const send = async () => {
    // Save first when the text was changed, so Google gets what's on screen.
    if (text !== null && text.trim() !== (review.draft?.text ?? "")) {
      if (!(await save())) return;
    }
    await run(
      "send",
      async () => {
        const result = await sendReplies(locationId, [review.review_id]);
        const outcome = result.results[0];
        if (outcome && outcome.status !== "sent") throw new Error(outcome.reason ?? "The reply wasn't sent.");
      },
      "The reply couldn't be sent.",
      "Reply published on Google.",
    );
    setText(null);
    setEditing(false);
  };

  const reviewer = review.reviewer?.is_anonymous ? "Anonymous" : (review.reviewer?.display_name ?? "A Google user");
  const edited = review.update_time && review.create_time && review.update_time !== review.create_time;

  return (
    <article className={cn("rounded-lg border bg-surface p-4 shadow-card", review.flag_level === "suspicious" ? "border-critical/40" : review.flag_level === "attention" ? "border-warning/50" : "border-border")}>
      <header className="flex items-start gap-3">
        <Checkbox className="mt-1" checked={selected} onCheckedChange={(value) => onSelect(value === true)} aria-label={`Select review by ${reviewer}`} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Stars rating={review.rating} />
            <span className="font-medium text-foreground">{reviewer}</span>
            <span className="text-xs text-muted-foreground">
              {review.create_time ? formatRunDate(review.create_time) : ""}
              {edited ? " · edited" : ""}
            </span>
            {review.flag_level === "suspicious" ? (
              <StatusBadge tone="critical"><ShieldAlert aria-hidden className="size-3" /> Suspicious indicators</StatusBadge>
            ) : review.flag_level === "attention" ? (
              <StatusBadge tone="warning"><AlertTriangle aria-hidden className="size-3" /> Needs attention</StatusBadge>
            ) : null}
            {review.report_status !== "not_reported" ? <StatusBadge tone="info">{REPORT_STATUS_LABEL[review.report_status]}</StatusBadge> : null}
          </p>
          {review.flags.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {review.flags.map((flag) => (
                <li key={flag.code} className="rounded border border-border bg-surface-strong px-1.5 py-0.5 text-xs text-muted-foreground" title={flag.detail ?? undefined}>
                  {flag.label}
                </li>
              ))}
            </ul>
          ) : null}
          <p className={cn("mt-2 whitespace-pre-line text-sm", review.comment ? "text-foreground" : "italic text-muted-foreground")}>
            {review.comment ?? "No written review, rating only."}
          </p>

          {review.analysis ? (
            <div className="mt-3 rounded-md border border-border bg-surface-strong p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles aria-hidden className="size-3.5" /> AI analysis
                {review.analysis.stale ? <StatusBadge tone="warning">Review changed since</StatusBadge> : null}
              </p>
              <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-[120px_1fr]">
                {review.analysis.summary ? <><dt className="text-muted-foreground">Summary</dt><dd>{review.analysis.summary}</dd></> : null}
                <dt className="text-muted-foreground">Sentiment</dt><dd className="capitalize">{review.analysis.sentiment ?? "—"}{review.analysis.severity ? ` · ${review.analysis.severity} severity` : ""}</dd>
                {review.analysis.suspicious_indicators.length > 0 ? (
                  <><dt className="text-muted-foreground">Suspicious indicators</dt><dd>{review.analysis.suspicious_indicators.join("; ")}</dd></>
                ) : null}
                {review.analysis.recommended_action ? <><dt className="text-muted-foreground">Suggested</dt><dd>{review.analysis.recommended_action}</dd></> : null}
              </dl>
            </div>
          ) : null}

          {/* Reply */}
          <div className="mt-3 space-y-2">
            {published && !showEditor ? (
              <div className="rounded-md border-l-2 border-primary/50 bg-brand-tint/40 px-3 py-2 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">Your reply{review.sent_at ? ` · ${formatRunDate(review.sent_at)}` : ""}</p>
                <p className="mt-0.5 whitespace-pre-line text-foreground">{published}</p>
              </div>
            ) : null}

            {review.reply_state === "failed" && review.send_error ? (
              <p role="alert" className="text-sm text-critical">Last send failed: {review.send_error}</p>
            ) : null}

            {showEditor ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {review.draft ? <StatusBadge tone={review.draft.source === "ai" ? "brand" : "neutral"}>{review.draft.source === "ai" && !review.draft.edited ? "AI draft" : "Draft"}</StatusBadge> : null}
                  {review.draft?.stale ? <StatusBadge tone="warning">The review changed since this draft</StatusBadge> : null}
                  {published ? <span>Sending replaces the reply on Google.</span> : null}
                </div>
                <Textarea
                  aria-label="Reply"
                  rows={4}
                  maxLength={4000}
                  value={draftText}
                  placeholder="Write a reply…"
                  onChange={(event) => setText(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy !== null || !draftText.trim()} onClick={() => void send()}>
                    {busy === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />} Send reply
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null || text === null} onClick={() => void save().then((ok) => ok && setText(null))}>
                    {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save draft
                  </Button>
                  {review.draft ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void run("discard", () => deleteReplyDraft(locationId, review.review_id), "The draft couldn't be discarded.").then(() => { setText(null); setEditing(false); })}
                    >
                      Discard draft
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => { setText(null); setEditing(false); }}>Cancel</Button>
                  )}
                  {aiUsable && review.ai_reply_eligible ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => void run("ai", () => generateReplyDrafts(locationId, [review.review_id], Boolean(review.draft)), "The AI draft couldn't be made.").then(() => setText(null))}
                    >
                      {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                      {review.draft ? "New AI draft" : "AI draft"} ({ai.token_costs.reply_drafts_per_10} token{ai.token_costs.reply_drafts_per_10 === 1 ? "" : "s"})
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> {published ? "Edit reply" : "Write a reply"}
                </Button>
                {!published && aiUsable && review.ai_reply_eligible ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void run("ai", () => generateReplyDrafts(locationId, [review.review_id]), "The AI draft couldn't be made.")}
                  >
                    {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                    AI draft ({ai.token_costs.reply_drafts_per_10} token{ai.token_costs.reply_drafts_per_10 === 1 ? "" : "s"})
                  </Button>
                ) : null}
                {published ? (
                  <Button size="sm" variant="ghost" className="text-critical" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
                    <Trash2 aria-hidden /> Remove reply
                  </Button>
                ) : null}
                {!published && !review.ai_reply_eligible && review.ai_reply_skip_reason && SKIP_REASON[review.ai_reply_skip_reason] ? (
                  <span className="self-center text-xs text-muted-foreground">{SKIP_REASON[review.ai_reply_skip_reason]}</span>
                ) : null}
              </div>
            )}
          </div>

          {/* Removal request (Google has no reporting API: copy, open Google's tool, record the outcome) */}
          {review.appeal_eligible ? (
            <div className="mt-3 border-t border-border pt-3">
              {review.appeal ? (
                <div className="space-y-2 text-sm">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Removal request draft · {POLICY_LABEL[review.appeal.policy_reason] ?? review.appeal.policy_reason}
                    {review.appeal.stale ? <StatusBadge tone="warning">Review changed since</StatusBadge> : null}
                  </p>
                  <p className="whitespace-pre-line rounded-md border border-border bg-surface-strong p-2.5 text-foreground">{review.appeal.text}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(review.appeal!.text).then(() => toast.success("Copied"))}>
                      <Copy aria-hidden /> Copy
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={reportUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> Open Google's report tool</a>
                    </Button>
                    <Select
                      value={review.report_status}
                      onValueChange={(value) => void run("status", () => setReportStatus(locationId, review.review_id, value as ReviewReportStatus), "The status couldn't be saved.")}
                    >
                      <SelectTrigger className="h-8 w-48 bg-background text-xs" aria-label="What happened on Google"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(REPORT_STATUS_LABEL) as ReviewReportStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>{REPORT_STATUS_LABEL[status]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Google has no way to report reviews automatically: paste this into Google's tool, then record what happened.</p>
                </div>
              ) : aiUsable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      "appeal",
                      async () => {
                        const result = await draftAppeal(locationId, review.review_id);
                        if (result.report_url) setReportUrl(result.report_url);
                      },
                      "The removal request couldn't be drafted.",
                    )
                  }
                >
                  {busy === "appeal" ? <LoaderCircle aria-hidden className="animate-spin" /> : <ShieldAlert aria-hidden />}
                  Draft removal request ({ai.token_costs.appeal} token{ai.token_costs.appeal === 1 ? "" : "s"})
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your reply from Google?"
        description="The reply disappears from the review on Google. You can write a new one afterwards."
        confirmLabel="Remove reply"
        onConfirm={() => {
          setConfirmRemove(false);
          void run("remove", () => deleteReply(locationId, review.review_id), "The reply couldn't be removed.", "Reply removed from Google.");
        }}
      />
    </article>
  );
}
