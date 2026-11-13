import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  CornerDownRight,
  ExternalLink,
  LoaderCircle,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Pencil,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  analyzeReviews,
  deleteReply,
  deleteReplyDraft,
  draftAppeal,
  generateReplyDrafts,
  saveReplyDraft,
  sendReplies,
  setReportStatus,
  type Review,
  type ReviewReportStatus,
} from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCanEdit } from "@/hooks/use-access";
import { estimateAnalysisCost, formatTokens } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import type { AiStatus } from "@/lib/ai/ai-status";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { formatDate, formatDateTime, formatRelative } from "@/lib/datetime";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { nameHash, reviewerInitials } from "@/lib/reviews/review-metrics";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { ReviewStars } from "./review-stars";

/** Google's Reviews Management Tool (Google has no API to report a review). */
const GOOGLE_REPORT_URL = "https://support.google.com/business/workflow/16726127";

const MAX_REPLY = 4000;

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

/** Why AI won't draft a reply for this review (`ai_reply_skip_reason`); null when nothing needs saying. */
const SKIP_REASON: Record<string, string | null> = {
  already_replied: null,
  has_reply: null,
  suspicious: "AI doesn't reply to reviews with suspicious indicators. Ask Google to remove it instead.",
  flagged: "AI doesn't reply to reviews with suspicious indicators. Ask Google to remove it instead.",
  no_rating: "AI drafts need a star rating.",
  no_text: "No written review to answer.",
  deleted_on_google: "This review is no longer on Google.",
};

const SEND_REASON: Record<string, string> = {
  no_draft: "There's no reply to send.",
  already_replied: "It already has a reply.",
  deleted_on_google: "The review is no longer on Google.",
  google_error: "Google didn't accept the reply. Try again.",
};

const SENTIMENT_TONE: Record<string, "success" | "warning" | "neutral"> = { positive: "success", negative: "warning", mixed: "neutral", neutral: "neutral" };
const SEVERITY_TONE: Record<string, "critical" | "warning" | "neutral"> = { high: "critical", medium: "warning", low: "neutral" };

// Soft, distinct avatar tints (no violet: that means AI; no red: that means trouble).
const AVATAR_TONES = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-3/12 text-chart-3",
  "bg-chart-4/12 text-chart-4",
  "bg-chart-8/12 text-chart-8",
  "bg-chart-2/12 text-chart-2",
  "bg-chart-7/15 text-chart-7-ink",
] as const;

/** A soft violet button for AI actions inside busy cards (the solid violet is kept for page-level AI actions). */
const AI_SOFT_BUTTON = "border-ai/30 bg-ai-surface text-ai hover:border-ai/50 hover:bg-ai-surface hover:text-ai-hover";

function replyText(reply: Review["reply"]): string | null {
  if (!reply) return null;
  return typeof reply === "string" ? reply : reply.comment;
}

const DAY_MS = 86_400_000;

/** "3 days ago" within a week (when `now` is known), otherwise "Oct 2, 2026". */
function whenLabel(iso: string | null, now: number | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (now !== undefined && Number.isFinite(time) && now - time < 7 * DAY_MS) return formatRelative(iso, now);
  return formatDate(iso, "");
}

type BusyKey = "send" | "save" | "discard" | "ai" | "analyze" | "appeal" | "status" | "remove";

export type ReviewCardProps = {
  locationId: string;
  review: Review;
  /** `useAiStatus(locationId)` from the page: whether AI can run, why not, and its prices. */
  ai: AiStatus;
  /** Show a selection checkbox (bulk actions). */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  /** The current time (`useNow()`), for "3 days ago". */
  now?: number;
  /** Leave out the "Needs reply" pill (the list shows only unanswered reviews, so it would repeat on every card). */
  hideNeedsReply?: boolean;
  className?: string;
};

/** One review: the rating, the text, its checks and AI analysis, the reply (or the AI draft to check) and, when it applies, a removal request. */
export function ReviewCard({ locationId, review, ai, selectable = false, selected = false, onSelect, now, hideNeedsReply = false, className }: ReviewCardProps) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  const canEdit = useCanEdit();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reportUrl, setReportUrl] = useState(GOOGLE_REPORT_URL);

  const published = replyText(review.reply);
  const draft = review.draft;
  const draftText = text ?? draft?.text ?? (editing ? (published ?? "") : "");
  const showEditor = canEdit && (editing || review.reply_state === "draft" || review.reply_state === "failed");
  const aiDraft = Boolean(draft && draft.source === "ai" && !draft.edited);
  const suspicious = review.flag_level === "suspicious";
  const reviewer = review.reviewer?.is_anonymous ? "Anonymous" : (review.reviewer?.display_name ?? "A Google user");
  const edited = review.update_time && review.create_time && review.update_time !== review.create_time;
  const replyCost = ai.costs.reply_drafts_per_10;
  const analysisCost = estimateAnalysisCost([review], ai.costs.analysis_per_10, Boolean(review.analysis));
  const canAnalyze = Boolean(review.comment?.trim()) && (!review.analysis || review.analysis.stale);
  const skipReason = review.ai_reply_skip_reason ? (SKIP_REASON[review.ai_reply_skip_reason] ?? null) : null;
  const aiBlocked = !ai.canRun;
  // A read-only or suspended account: the backend also refuses sending and removing a reply (both
  // need billing). Saving a draft still works.
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";
  const accountReason = ai.blockedBy === "suspended" ? "This account is suspended." : "Sending replies needs an active subscription.";
  // The appeal changed since it was drafted: a new draft is charged only because the review changed.
  const canRedraftAppeal = Boolean(review.appeal?.stale && review.appeal_eligible);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };

  const run = async (key: BusyKey, action: () => Promise<unknown>, options: { fallback: string; success?: string; ai?: boolean }) => {
    setBusy(key);
    try {
      await action();
      if (options.ai) noteAiSuccess();
      if (options.success) toast.success(options.success);
      return true;
    } catch (err) {
      if (options.ai) toastAiError(err, { fallback: options.fallback });
      else {
        // Not a useMutation, so tell the account banner about a 402/403 here (toastAiError does for AI).
        noteAccountError(err);
        toast.error(reviewErrorMessage(err, options.fallback).message);
      }
      return false;
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const save = () => {
    const value = draftText.trim();
    if (!value || value.length > MAX_REPLY) {
      toast.error("A reply needs 1 to 4,000 characters.");
      return Promise.resolve(false);
    }
    return run("save", () => saveReplyDraft(locationId, review.review_id, value), { fallback: "The reply couldn't be saved.", success: "Draft saved." });
  };

  const send = async () => {
    // Save first when there's no saved draft or the text was changed, so Google gets what's on screen.
    if (!draft || (text !== null && text.trim() !== draft.text)) {
      const value = draftText.trim();
      if (!value || value.length > MAX_REPLY) {
        toast.error("A reply needs 1 to 4,000 characters.");
        return;
      }
      setBusy("send");
      try {
        await saveReplyDraft(locationId, review.review_id, value);
      } catch (err) {
        setBusy(null);
        noteAccountError(err);
        toast.error(reviewErrorMessage(err, "The reply couldn't be saved.").message);
        return;
      }
    }
    const ok = await run(
      "send",
      async () => {
        const result = await sendReplies(locationId, [review.review_id]);
        const outcome = result.results[0];
        if (outcome && outcome.status !== "sent") throw new Error(outcome.reason ? (SEND_REASON[outcome.reason] ?? outcome.reason) : "The reply wasn't sent.");
      },
      { fallback: "The reply couldn't be sent.", success: "Reply published on Google." },
    );
    if (ok) {
      setText(null);
      setEditing(false);
    }
  };

  const draftWithAi = () =>
    void run("ai", () => generateReplyDrafts(locationId, [review.review_id], Boolean(draft)), {
      fallback: "The AI draft couldn't be made.",
      success: draft ? "New AI draft ready to check." : "AI draft ready to check.",
      ai: true,
    }).then((ok) => {
      if (ok) {
        setText(null);
        setEditing(false);
      }
    });

  const analyze = () =>
    void run("analyze", () => analyzeReviews(locationId, [review.review_id], Boolean(review.analysis)), {
      fallback: "The review couldn't be analyzed.",
      success: "Analysis added to the review.",
      ai: true,
    });

  const draftRemovalRequest = () =>
    void run(
      "appeal",
      async () => {
        const result = await draftAppeal(locationId, review.review_id);
        if (result.report_url) setReportUrl(result.report_url);
      },
      { fallback: "The removal request couldn't be drafted.", success: "Removal request drafted. Copy it into Google's tool.", ai: true },
    );

  const menuItems = canEdit
    ? [
        canAnalyze ? "analyze" : null,
        review.appeal_eligible && !review.appeal && !suspicious ? "appeal" : null,
        published ? "remove" : null,
      ].filter((item): item is "analyze" | "appeal" | "remove" => item !== null)
    : [];

  return (
    <article
      aria-label={`Review by ${reviewer}`}
      className={cn(
        "relative min-w-0 rounded-xl border bg-card p-4 shadow-card transition-[border-color,box-shadow] sm:p-5",
        suspicious ? "border-critical/30" : review.flag_level === "attention" ? "border-warning/45" : "border-border",
        selected && "border-primary/50 ring-2 ring-primary/20",
        className,
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        {selectable && canEdit && onSelect ? (
          // The label pads the 16px box out to a 36px target.
          <label className="-my-2 -ml-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg sm:mt-0.5">
            <Checkbox checked={selected} onCheckedChange={(value) => onSelect(value === true)} aria-label={`Select the review by ${reviewer}`} />
          </label>
        ) : null}
        <ReviewerAvatar name={review.reviewer?.display_name ?? null} anonymous={Boolean(review.reviewer?.is_anonymous) || !review.reviewer?.display_name} />

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{reviewer}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <ReviewStars value={review.rating} />
                {review.create_time ? (
                  <time dateTime={review.create_time} title={formatDateTime(review.create_time)}>
                    {whenLabel(review.create_time, now)}
                  </time>
                ) : null}
                {edited ? <span>· Edited</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {hideNeedsReply && review.reply_state === "none" ? null : <ReplyStateBadge review={review} aiDraft={aiDraft} />}
              {suspicious ? (
                <StatusBadge tone="critical" icon={ShieldAlert} size="sm">
                  Suspicious indicators
                </StatusBadge>
              ) : review.flag_level === "attention" ? (
                <StatusBadge tone="warning" icon={AlertTriangle} size="sm">
                  Needs attention
                </StatusBadge>
              ) : null}
              {review.report_status !== "not_reported" ? (
                <StatusBadge tone="info" size="sm">
                  {REPORT_STATUS_LABEL[review.report_status]}
                </StatusBadge>
              ) : null}
              {menuItems.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy !== null}
                      className="relative -my-1 size-8 text-muted-foreground after:absolute after:-inset-0.5 after:content-[''] hover:text-foreground data-[state=open]:bg-accent"
                      aria-label={`More actions for the review by ${reviewer}`}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {menuItems.includes("analyze") ? (
                      <DropdownMenuItem disabled={aiBlocked} onSelect={analyze}>
                        <Sparkles aria-hidden className="text-ai" />
                        <span className="flex-1">{review.analysis ? "Analyze again with AI" : "Analyze with AI"}</span>
                        <span className="text-xs text-muted-foreground">{formatTokens(analysisCost)}</span>
                      </DropdownMenuItem>
                    ) : null}
                    {menuItems.includes("appeal") ? (
                      <DropdownMenuItem disabled={aiBlocked} onSelect={draftRemovalRequest}>
                        <ShieldAlert aria-hidden />
                        <span className="flex-1">Ask Google to remove it</span>
                        <span className="text-xs text-muted-foreground">{formatTokens(ai.costs.appeal)}</span>
                      </DropdownMenuItem>
                    ) : null}
                    {aiBlocked && !accountBlocked && (menuItems.includes("analyze") || menuItems.includes("appeal")) && ai.reason ? (
                      <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">{ai.reason}</p>
                    ) : null}
                    {menuItems.includes("remove") ? (
                      <>
                        {menuItems.length > 1 ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuItem disabled={accountBlocked} onSelect={() => setConfirmRemove(true)} className="text-critical focus:text-critical">
                          <Trash2 aria-hidden />
                          Remove reply from Google
                        </DropdownMenuItem>
                      </>
                    ) : null}
                    {/* Every item here is AI or a change on Google, so one line says why they're all off. */}
                    {accountBlocked ? (
                      <p className="px-2 pb-1.5 pt-1 text-xs text-muted-foreground">
                        {ai.blockedBy === "suspended" ? "This account is suspended." : "These need an active subscription."}
                      </p>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </header>

          {review.flags.length > 0 ? (
            <ul aria-label="Checks on this review" className="mt-2.5 flex flex-wrap gap-1.5">
              {review.flags.map((flag) => (
                <li
                  key={flag.code}
                  title={flag.detail ?? undefined}
                  className="inline-flex max-w-full items-start gap-1 rounded-md border border-border bg-surface-strong px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {flag.source === "ai" ? <Sparkles aria-hidden className="mt-0.5 size-3 shrink-0 text-ai" /> : null}
                  <span className="min-w-0">
                    {flag.label}
                    {flag.detail ? ` · ${flag.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className={cn("mt-3 whitespace-pre-line text-[15px] leading-relaxed", review.comment ? "text-foreground" : "italic text-muted-foreground")}>
            {review.comment ?? "No written review, rating only."}
          </p>

          {review.analysis ? <AnalysisPanel analysis={review.analysis} /> : null}

          {/* The reply: published, being written, or waiting as a draft. */}
          {published && !showEditor ? (
            <div className="mt-4 rounded-lg border-l-[3px] border-primary/60 bg-surface-strong px-3.5 py-2.5">
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-foreground">
                <CornerDownRight aria-hidden className="size-3.5 text-primary" />
                Your reply
                {review.sent_at ? (
                  <time dateTime={review.sent_at} title={formatDateTime(review.sent_at)} className="font-normal text-muted-foreground">
                    · {whenLabel(review.sent_at, now)}
                  </time>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">{published}</p>
            </div>
          ) : null}

          {review.reply_state === "failed" && review.send_error && canEdit ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2 text-sm text-critical">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-semibold">Not sent.</span> {review.send_error}
              </span>
            </p>
          ) : null}

          {!canEdit ? null : showEditor ? (
            <div className={cn("mt-4 rounded-xl border p-3 sm:p-4", aiDraft ? "border-ai/30 bg-ai-surface/60" : "border-border bg-surface-strong")}>
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {aiDraft ? (
                  <AiBadge label="AI draft" />
                ) : draft ? (
                  <StatusBadge tone="neutral" icon={PenLine} size="sm">
                    Your draft
                  </StatusBadge>
                ) : (
                  <span className="font-semibold text-foreground">{published ? "Edit your reply" : "Your reply"}</span>
                )}
                <span className="text-muted-foreground">
                  {published
                    ? "Sending replaces your reply on Google."
                    : aiDraft
                      ? "Check it and change anything you like before sending."
                      : "Nothing is published until you send it."}
                </span>
                {draft?.stale ? (
                  <StatusBadge tone="warning" size="sm">
                    The review changed since this draft
                  </StatusBadge>
                ) : null}
              </div>
              <Textarea
                aria-label={`Reply to ${reviewer}`}
                rows={4}
                maxLength={MAX_REPLY}
                value={draftText}
                placeholder="Write a reply…"
                onChange={(event) => setText(event.target.value)}
                className="bg-card"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy !== null || !draftText.trim() || accountBlocked}
                  title={accountBlocked ? accountReason : undefined}
                  aria-busy={busy === "send" || undefined}
                  onClick={() => void send()}
                >
                  {busy === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
                  Send reply
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null || text === null} onClick={() => void save().then((ok) => ok && setText(null))}>
                  {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                  Save draft
                </Button>
                {draft ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() =>
                      void run("discard", () => deleteReplyDraft(locationId, review.review_id), { fallback: "The draft couldn't be discarded." }).then((ok) => {
                        if (ok) {
                          setText(null);
                          setEditing(false);
                        }
                      })
                    }
                  >
                    Discard draft
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setText(null);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                {review.ai_reply_eligible ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("sm:ml-auto", AI_SOFT_BUTTON)}
                    disabled={busy !== null || aiBlocked}
                    title={aiBlocked ? ai.reason : undefined}
                    onClick={draftWithAi}
                  >
                    {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                    {draft ? "New AI draft" : "Draft with AI"}
                    <span className="font-medium">· {formatTokens(replyCost)}</span>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : published ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Edit reply
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {review.ai_reply_eligible ? (
                <Button
                  size="sm"
                  variant="outline"
                  className={AI_SOFT_BUTTON}
                  disabled={busy !== null || aiBlocked}
                  title={aiBlocked ? ai.reason : undefined}
                  onClick={draftWithAi}
                >
                  {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                  Reply with AI
                  <AiCostChip tokens={replyCost} {...(ai.balance === undefined ? {} : { balance: ai.balance })} className="-mr-1" />
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> Write a reply
              </Button>
              {!review.ai_reply_eligible && skipReason && !suspicious ? <span className="text-xs text-muted-foreground">{skipReason}</span> : null}
            </div>
          )}

          {/* Removal request: Google has no reporting API, so copy the text, open Google's tool, record the outcome. */}
          {review.appeal && canEdit ? (
            <div className="mt-4 rounded-xl border border-border bg-surface-strong p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldAlert aria-hidden className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Removal request</p>
                <AiBadge label="AI draft" variant="soft" />
                <StatusBadge tone="neutral" size="sm">
                  {POLICY_LABEL[review.appeal.policy_reason] ?? review.appeal.policy_reason}
                </StatusBadge>
                {review.appeal.stale ? (
                  <StatusBadge tone="warning" size="sm">
                    The review changed since
                  </StatusBadge>
                ) : null}
              </div>
              <p className="mt-2.5 whitespace-pre-line rounded-lg border border-border bg-card p-3 text-sm leading-relaxed text-foreground">{review.appeal.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* An outdated request: AI drafts it again from the review as it is now (charged, as any draft). */}
                {canRedraftAppeal ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={AI_SOFT_BUTTON}
                    disabled={busy !== null || aiBlocked}
                    title={aiBlocked ? ai.reason : undefined}
                    aria-busy={busy === "appeal" || undefined}
                    onClick={draftRemovalRequest}
                  >
                    {busy === "appeal" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                    Redraft
                    <span className="font-medium">· {formatTokens(ai.costs.appeal)}</span>
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard.writeText(review.appeal?.text ?? "").then(
                      () => toast.success("Copied. Paste it into Google's report tool."),
                      () => toast.error("Couldn't copy. Select the text and copy it instead."),
                    )
                  }
                >
                  <Copy aria-hidden /> Copy
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={reportUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden /> Open Google's report tool
                  </a>
                </Button>
                <Select
                  value={review.report_status}
                  onValueChange={(value) =>
                    void run("status", () => setReportStatus(locationId, review.review_id, value as ReviewReportStatus), { fallback: "The status couldn't be saved.", success: "Saved." })
                  }
                >
                  <SelectTrigger className="h-8 w-full text-[13px] sm:w-52" aria-label="What happened on Google">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPORT_STATUS_LABEL) as ReviewReportStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {REPORT_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {canRedraftAppeal ? "The review changed after this was drafted: redraft it before you paste it. " : null}
                Google can't take reports automatically: paste this into Google's tool, then record what happened.
              </p>
            </div>
          ) : suspicious && review.appeal_eligible && canEdit ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-critical/20 bg-critical-surface/60 p-3 sm:flex-row sm:items-center sm:p-4">
              <ShieldAlert aria-hidden className="hidden size-5 shrink-0 text-critical sm:block" />
              <p className="min-w-0 flex-1 text-sm text-foreground">
                <span className="font-semibold">This review may break Google's rules.</span> Rather than replying, ask Google to remove it. AI drafts the request for you to paste into Google's tool.
              </p>
              <Button size="sm" variant="outline" className={AI_SOFT_BUTTON} disabled={busy !== null || aiBlocked} title={aiBlocked ? ai.reason : undefined} onClick={draftRemovalRequest}>
                {busy === "appeal" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                Draft removal request
                <span className="font-medium">· {formatTokens(ai.costs.appeal)}</span>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove your reply from Google?"
        description="The reply disappears from the review on Google. You can write a new one afterwards."
        confirmLabel="Remove reply"
        onConfirm={() => {
          setConfirmRemove(false);
          void run("remove", () => deleteReply(locationId, review.review_id), { fallback: "The reply couldn't be removed.", success: "Reply removed from Google." });
        }}
      />
    </article>
  );
}

function ReviewerAvatar({ name, anonymous }: { name: string | null; anonymous: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "hidden size-10 shrink-0 select-none place-items-center rounded-full text-sm font-semibold sm:grid",
        anonymous ? "bg-muted text-muted-foreground" : AVATAR_TONES[nameHash(name) % AVATAR_TONES.length],
      )}
    >
      {anonymous ? <UserRound className="size-5" /> : reviewerInitials(name)}
    </span>
  );
}

/** Where the reply stands, as one pill. Suspicious reviews skip "Needs reply": they should be reported, not answered. */
function ReplyStateBadge({ review, aiDraft }: { review: Review; aiDraft: boolean }) {
  switch (review.reply_state) {
    case "sent":
      return (
        <StatusBadge tone="success" icon={Check} size="sm">
          Replied
        </StatusBadge>
      );
    case "failed":
      return (
        <StatusBadge tone="critical" icon={AlertTriangle} size="sm">
          Not sent
        </StatusBadge>
      );
    case "draft":
      return aiDraft ? (
        <StatusBadge tone="ai" icon={Sparkles} size="sm">
          AI draft ready
        </StatusBadge>
      ) : (
        <StatusBadge tone="info" icon={PenLine} size="sm">
          Draft saved
        </StatusBadge>
      );
    default:
      return review.flag_level === "suspicious" ? null : (
        <StatusBadge tone="warning" icon={MessageSquare} size="sm">
          Needs reply
        </StatusBadge>
      );
  }
}

function AnalysisPanel({ analysis }: { analysis: NonNullable<Review["analysis"]> }) {
  const sentiment = analysis.sentiment?.toLowerCase() ?? null;
  const severity = analysis.severity?.toLowerCase() ?? null;
  return (
    <div className="mt-3 rounded-lg border border-ai/20 bg-ai-surface/50 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <AiBadge label="AI analysis" variant="soft" />
        {sentiment ? (
          <StatusBadge tone={SENTIMENT_TONE[sentiment] ?? "neutral"} size="sm">
            <span className="capitalize">{sentiment}</span>
          </StatusBadge>
        ) : null}
        {severity ? (
          <StatusBadge tone={SEVERITY_TONE[severity] ?? "neutral"} size="sm">
            <span className="capitalize">{severity}</span> severity
          </StatusBadge>
        ) : null}
        {analysis.stale ? (
          <StatusBadge tone="warning" size="sm">
            The review changed since
          </StatusBadge>
        ) : null}
      </div>
      {analysis.summary ? <p className="mt-2 text-sm font-medium text-foreground">{analysis.summary}</p> : null}
      {analysis.suspicious_indicators.length > 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Suspicious indicators:</span> {analysis.suspicious_indicators.join("; ")}
        </p>
      ) : null}
      {analysis.recommended_action ? (
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Suggested:</span> {analysis.recommended_action}
        </p>
      ) : null}
    </div>
  );
}
