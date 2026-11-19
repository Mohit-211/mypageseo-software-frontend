import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Copy,
  ExternalLink,
  EyeOff,
  History,
  LifeBuoy,
  LoaderCircle,
  MoreHorizontal,
  PenLine,
  Pencil,
  RefreshCw,
  Repeat2,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import {
  analyzeReviews,
  deleteReply,
  deleteReplyDraft,
  draftAppeal,
  generateReplyDrafts,
  isApiError,
  reviseReplyDraft,
  saveReplyDraft,
  sendReplies,
  setReportStatus,
  swapReplyDraft,
  type DeclinedInstruction,
  type DraftCheck,
  type GoogleReply,
  type Review,
  type ReviewReportStatus,
} from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
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
import { formatTokenCount, formatTokens } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import type { AiStatus } from "@/lib/ai/ai-status";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { formatDateTime } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { canAnalyzeReview } from "@/lib/reviews/analysis-view";
import { draftSkipText } from "@/lib/reviews/draft-results";
import {
  asFailedSend,
  asSentReview,
  canReviseDraft,
  hasHardFinding,
  hasLiveReply,
  isLeftBehind,
  isReplyUpdate,
  mergeSendFindings,
  publicReplyText,
  rejectedReply,
  whenLabel,
  withGoogleReply,
  withoutDraft,
  withoutReply,
} from "@/lib/reviews/draft-view";
import { sendBlockedByAuthorization } from "@/lib/reviews/reply-authorization-copy";
import { REPLY_MAX_BYTES, declinedSummary, sendBlockFromError, sortChecks, utf8Length, type SendBlock } from "@/lib/reviews/reply-checks";
import { creditCost } from "@/lib/reviews/reply-credits";
import { putReviewInCache, refetchReview, setCachedCredits, updateReviewInCache } from "@/lib/reviews/review-cache";
import { SEND_BLOCK_COPY, reviewErrorMessage, reviseErrorNotice, useToastReplyError, type InlineNotice } from "@/lib/reviews/review-errors";
import { nameHash, reviewerInitials } from "@/lib/reviews/review-metrics";
import { scrollToReplyAuthorization } from "@/lib/reviews/review-spotlight";
import { SENT_REPLIES_NOTE, noteReplyAuthorizationRequired, sendFailureAction, sendFailureText } from "@/lib/reviews/send-results";
import { useReplyAuthorization } from "@/lib/reviews/use-reply-authorization";
import { reviewsKey, useReplyAiLimits } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { AutoReplyReviewNote } from "./auto-reply-status";
import { ChangeItBox } from "./change-it";
import { DraftFindings, DraftNote, DraftProvenance, DraftText, VerificationBadge } from "./draft-checks";
import { QualityBadge, QualityNotes } from "./draft-quality";
import { ReplyCostChip } from "./reply-cost-chip";
import { RejectedReply, ReplyOnGoogle, ReplyStateBadge } from "./reply-state";
import { AnalysisPanel, ReviewText } from "./review-analysis";
import { ReviewStars } from "./review-stars";
import { GoogleReplyDialog, SendAnywayDialog } from "./send-blocked-dialog";

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
  not_found: "This review isn't here anymore. Reload the page.",
  google_error: "Google didn't accept the reply. Try again.",
};

/** Results of a send of one that the checks or Google held back (as a send of several reports them): shown like the 422 / 409 answers. */
const HELD_BACK = new Set(["checks_failed", "needs_review", "reply_changed_on_google", "draft_predates_reply"]);

/** A send skipped because there is nothing left to send here (the card needn't stay on screen for it). */
const NOTHING_TO_SEND = new Set(["no_draft", "already_replied", "deleted_on_google", "not_found"]);

/** Where "Contact support" goes (a send that can't reach Google from this account: `not_configured`). */
const SUPPORT_PATH = "/support?new=1";

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

/** Said wherever the length counter is: Google's limit is 4,096 bytes of UTF-8, not characters. */
const BYTES_HINT = "Google counts some characters, like emoji, as more than one.";

/** Why a reply can't be saved or sent as it is (empty, or over Google's 4,096 bytes), or null. */
function lengthProblem(text: string): string | null {
  const value = text.trim();
  if (!value) return "Write a reply first.";
  if (utf8Length(value) > REPLY_MAX_BYTES) {
    return `This reply is longer than Google allows. Shorten it until the counter shows ${REPLY_MAX_BYTES.toLocaleString()} or less.`;
  }
  return null;
}

type BusyKey = "send" | "save" | "discard" | "ai" | "revise" | "swap" | "analyze" | "appeal" | "status" | "remove";

/** What a held-back send of this review found, for the text it sent (shown while the saved draft still has that text). */
type SendHold = { text: string; kind: "checks_failed" | "confirm_warnings_required"; findings: DraftCheck[] };

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
  /**
   * The card asks its list to keep it on screen while the user works on it (`review`: the review as
   * the card last knows it), and lets it go (null) once it's sent or its draft discarded. A list read
   * again may no longer have it: a reply saved in "No reply yet" is a draft now, and a send held back
   * ("Send anyway?", "Google already has a reply", the highlighted parts) must not vanish with its card.
   */
  onHold?: (review: Review | null) => void;
  className?: string;
};

/**
 * One review: the rating, the text, its checks and AI analysis, the reply (or the draft to check, with
 * what the reply checks found: Phase 25a) and, when it applies, a removal request.
 *
 * A saved draft shows as it would be sent, its findings highlighted and listed ("read"); "Edit" opens
 * the text ("edit", with Google's byte counter); "Change it" asks the AI for a change. Send runs every
 * check again: a hard finding is shown on the draft, warnings ask "Send anyway?", a reply already on
 * Google opens a choice, and an agency without its client's authorization is pointed to the banner.
 *
 * Phase 25b and 2026-11-17: the AI's score of its draft and the notes under 4, "Try the other version",
 * what the reviewer mentioned highlighted in the review, the AI replies a click uses ("4 left" / "1 token"),
 * where an automatic reply stands, drafts that replace the reply on Google ("Replaces the reply on Google")
 * or were written before it ("Written before the reply on Google": "Replace it with my draft" saves it
 * again, then sends it), and a failed send's kind (Reconnect Google, contact support, try later).
 */
export function ReviewCard({ locationId, review, ai, selectable = false, selected = false, onSelect, now, hideNeedsReply = false, onHold, className }: ReviewCardProps) {
  const queryClient = useQueryClient();
  const toastReplyError = useToastReplyError();
  const canEdit = useCanEdit();
  const authorization = useReplyAuthorization(locationId, canEdit);
  const limits = useReplyAiLimits(locationId);
  const { connect: connectGoogle } = useGbpConnect();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [changing, setChanging] = useState(false);
  const [declined, setDeclined] = useState<{ text: string; parts: DeclinedInstruction[] } | null>(null);
  const [hold, setHold] = useState<SendHold | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [onGoogle, setOnGoogle] = useState<{ open: boolean; reply: GoogleReply | null; draftText: string; variant: "changed" | "predates" }>({
    open: false,
    reply: null,
    draftText: "",
    variant: "changed",
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmSwap, setConfirmSwap] = useState(false);
  const [reportUrl, setReportUrl] = useState(GOOGLE_REPORT_URL);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // When the "Change it" box closes, focus goes back to its button (which is rendered again then).
  const refocusChangeIt = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  // Set as an action ends: once its outcome is on screen, focus goes to the card when the control
  // that had it is gone or switched off (Discard, Save, a send the checks held back…), so keyboard
  // and screen-reader users stay on this review instead of restarting at the top of the page.
  const settleFocus = useRef(false);
  useEffect(() => {
    if (!settleFocus.current) return;
    settleFocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) articleRef.current?.focus({ preventScroll: true });
  });

  const draft = review.draft;
  const deleted = Boolean(review.deleted_on_google_at);
  const publicReply = publicReplyText(review);
  const rejected = rejectedReply(review);
  const hasDraft = Boolean(draft?.text);
  // The draft area: the saved draft with its checks ("read"), or the text being written ("edit").
  const writing = canEdit && !deleted && (editing || hasDraft);
  const editMode = writing && (editing || !hasDraft);
  const draftText = text ?? draft?.text ?? (editing ? (publicReply ?? "") : "");
  const trimmed = draftText.trim();
  const bytes = utf8Length(trimmed);
  const overLimit = bytes > REPLY_MAX_BYTES;
  // The text on screen isn't the saved draft (Send saves it first, and the save runs the checks again).
  const changed = text !== null && trimmed !== (draft?.text ?? "").trim();
  const aiDraft = Boolean(draft && draft.source === "ai" && !draft.edited);
  const suspicious = review.flag_level === "suspicious";
  const reviewer = review.reviewer?.is_anonymous ? "Anonymous" : (review.reviewer?.display_name ?? "A Google user");
  const edited = review.update_time && review.create_time && review.update_time !== review.create_time;
  // 2026-11-17: each AI reply uses one of the location's replies ("4 left"); a new block of 10 costs tokens.
  const replyCost = creditCost(1, limits.credits, ai.costs.reply_drafts_per_10);
  const analysisCost = creditCost(1, limits.credits, ai.costs.analysis_per_10, "analyses");
  const balance = ai.balance;
  const canAnalyze = canAnalyzeReview(review);
  const skipReason = review.ai_reply_skip_reason ? (SKIP_REASON[review.ai_reply_skip_reason] ?? null) : null;
  // 2026-11-17 (G3): a draft that replaces the reply on Google, or one written before that reply ("left behind").
  const update = isReplyUpdate(review);
  const leftBehind = isLeftBehind(review);
  const alternative = draft?.source === "ai" ? (draft.alternative ?? null) : null;
  // The last send's error goes with the draft: a failed send, or a failed update (which keeps `sent` / `pending`).
  const sendError = review.send_error && (review.reply_state === "failed" || draft) ? review.send_error : null;
  const sendErrorAction = sendError ? sendFailureAction(review.send_error_code) : null;
  const aiBlocked = !ai.canRun;
  // A read-only or suspended account: the backend also refuses sending and removing a reply (both
  // need billing). Saving a draft still works.
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";
  // The appeal changed since it was drafted: a new draft is charged only because the review changed.
  const canRedraftAppeal = Boolean(review.appeal?.stale && review.appeal_eligible);

  // What the checks found on the saved draft, plus what a send of the same text found.
  const holdApplies = Boolean(hold && draft && hold.text === draft.text);
  const checks = mergeSendFindings(draft?.checks, holdApplies ? hold?.findings : null);
  // "We left out: …" stays until the draft changes.
  const declinedParts = declined && draft && declined.text === draft.text ? declined.parts : null;
  const revisable = canReviseDraft(review);
  const findingId = (index: number) => `${uid}-finding-${index}`;
  const counterId = `${uid}-length`;
  const lengthErrorId = `${uid}-too-long`;
  const reasonId = `${uid}-send-reason`;
  const aiReasonId = `${uid}-ai-off`;
  const appealReasonId = `${uid}-ai-off-appeal`;

  // The draft's action row (Send…) is on screen, and whether it has an AI button ("Change it", "New AI draft").
  const changeItOpen = changing && !editMode && revisable;
  const aiInRow = !changeItOpen && ((!editMode && revisable) || review.ai_reply_eligible);
  // Disabled AI buttons say why once, in words under them (a disabled button shows no tooltip and
  // isn't read out). The account's reason covers sending and AI in one line.
  const accountReason =
    ai.blockedBy === "suspended"
      ? "This account is suspended."
      : aiInRow
        ? "Sending replies and AI need an active subscription."
        : "Sending replies needs an active subscription.";
  const aiOffReason = aiBlocked && ai.reason ? ai.reason : null;

  // Why Send is off, the most lasting reason first. Shown under the buttons: a disabled button shows no tooltip.
  const sendBlockedReason = accountBlocked
    ? accountReason
    : authorization.blocked
      ? sendBlockedByAuthorization(authorization.grantMethod)
      : editMode && overLimit
        ? lengthProblem(draftText)
        : !changed && hasHardFinding(checks)
          ? editMode
            ? "Fix what the checks found first, then save."
            : "Fix the highlighted parts first."
          : null;
  // Send can be pressed for this text. While anything on the card runs, it stays focusable (aria-disabled),
  // so keyboard focus isn't dropped while a send is answered (a dialog may follow and hand focus back to it).
  const sendable = Boolean(trimmed) && sendBlockedReason === null;
  // Over Google's limit the reason is already the message under the field: point Send there, don't repeat it.
  const reasonUnderField = editMode && overLimit && !accountBlocked && !authorization.blocked;

  // A left-behind draft has its own note under the badges: no second line saying the same.
  const helperText = leftBehind && !editMode
    ? null
    : publicReply
    ? "Sending replaces your reply on Google."
    : editMode
      ? draft
        ? "Change the text, then save or send it."
        : "Nothing is published until you send it."
      : aiDraft && draft?.verification === "unavailable"
        ? "The AI double-check couldn't run: read it carefully before sending."
        : aiDraft && draft?.verification === "flagged"
          ? "The double-check raised something: see the notes below."
          : aiDraft
            ? "Check it and change anything you like before sending."
            : "Nothing is published until you send it.";

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
      // The reply routes' 402 says how many AI replies or analyses are left (2026-11-17); other AI errors as usual.
      if (options.ai) toastReplyError(err, { fallback: options.fallback, blockSize: limits.blockSize });
      else {
        // Not a useMutation, so tell the account banner about a 402/403 here (toastAiError does for AI).
        noteAccountError(err);
        toast.error(reviewErrorMessage(err, options.fallback).message);
      }
      return false;
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };

  /** Keeps this card on screen while the user works on it, showing `latest` (its list may be read again without it). */
  const keep = (latest: Review) => onHold?.(latest);
  /** Sent, or its draft discarded: the list shows the review as it really is again (or not, if it no longer matches). */
  const release = () => onHold?.(null);

  const closeEditor = () => {
    setText(null);
    setEditing(false);
  };

  /** Saves the text on screen; `PUT …/draft` runs the reply checks again, so the card re-renders them from the answer. */
  const save = async () => {
    const problem = lengthProblem(draftText);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy("save");
    try {
      const saved = await saveReplyDraft(locationId, review.review_id, trimmed);
      putReviewInCache(queryClient, locationId, saved);
      // A reply saved in "No reply yet" (or over a rejected one) is a draft now: it stays here, checks and all.
      keep(saved);
      closeEditor();
      toast.success("Draft saved.", hasHardFinding(saved.draft?.checks) ? { description: "Fix the highlighted parts before sending." } : undefined);
    } catch (err) {
      // Not a useMutation, so tell the account banner about a 402/403 here (toastAiError does for AI).
      noteAccountError(err);
      toast.error(reviewErrorMessage(err, "The reply couldn't be saved.").message);
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };

  /** A send the checks or Google held back (`latest`: the review as the send left it): the findings on the draft, or a dialog. */
  const showHold = (block: SendBlock, sentText: string, latest: Review) => {
    if (block.kind === "checks_failed" || block.kind === "confirm_warnings_required") {
      setHold({ text: sentText, kind: block.kind, findings: block.findings });
      if (block.kind === "checks_failed") closeEditor();
      else setConfirmOpen(true);
      keep(latest);
      return;
    }
    if (block.kind === "reply_changed_on_google" || block.kind === "draft_predates_reply") {
      // Google's reply is stored now and comes back on the review: show it, keep the draft (left behind:
      // "Replace it with my draft" saves it again, then sends it).
      const withGoogle = (block.kind === "reply_changed_on_google" ? block.review : null) ?? withGoogleReply(latest, block.googleReply);
      putReviewInCache(queryClient, locationId, withGoogle);
      keep(withGoogle);
      setOnGoogle({ open: true, reply: block.googleReply, draftText: sentText, variant: block.kind === "draft_predates_reply" ? "predates" : "changed" });
      return;
    }
    // `reply_authorization_required` is answered by noteReplyAuthorizationRequired before this.
    keep(latest);
  };

  /** The reply on Google a left-behind draft would replace, as a send's 409 would give it. */
  const googleReplyOnReview = (): GoogleReply | null => {
    const reply = review.reply;
    if (!reply) return null;
    return typeof reply === "string" ? { comment: reply, update_time: null } : { comment: reply.comment, update_time: reply.update_time ?? null };
  };

  /**
   * Sends the draft (saved first when the text on screen changed). Every check runs again on the text
   * sent; `confirmWarnings` is "Send anyway" after a 409 `confirm_warnings_required`. Whatever doesn't
   * go out keeps the card on screen with what to do next: a hand-written reply is never dropped.
   *
   * `resave` is "Replace it with my draft" (2026-11-17, G3): the draft is saved again first, so it becomes an
   * update of the reply on Google, then sent. A draft known to be left behind isn't sent as it is (that answers
   * 409 `draft_predates_reply`): the choice opens instead.
   */
  const send = async (options: { confirmWarnings?: boolean; resave?: boolean } = {}) => {
    if (leftBehind && draft && !changed && !options.resave) {
      setOnGoogle({ open: true, reply: googleReplyOnReview(), draftText: draft.text, variant: "predates" });
      return;
    }
    let sentText = draft?.text ?? "";
    // The review as this send leaves it (the saved text, when the text on screen was saved first).
    let latest = review;
    setBusy("send");
    try {
      if (!draft || changed || options.resave) {
        const toSave = changed || !draft ? trimmed : draft.text;
        const problem = lengthProblem(toSave);
        if (problem) {
          toast.error(problem);
          return;
        }
        let saved: Review;
        try {
          saved = await saveReplyDraft(locationId, review.review_id, toSave);
        } catch (err) {
          noteAccountError(err);
          toast.error(reviewErrorMessage(err, "The reply couldn't be saved.").message);
          return;
        }
        putReviewInCache(queryClient, locationId, saved);
        latest = saved;
        sentText = saved.draft?.text ?? toSave;
        closeEditor();
        // The save ran the checks again, and a hard finding is never sent: show it rather than sending.
        if (hasHardFinding(saved.draft?.checks)) {
          setHold({ text: sentText, kind: "checks_failed", findings: [] });
          keep(saved);
          return;
        }
      }
      const result = await sendReplies(locationId, [review.review_id], options.confirmWarnings ? { confirmWarnings: true } : {});
      const outcome = result.results.find((item) => item.review_id === review.review_id) ?? result.results[0];
      if (outcome?.status === "skipped" && outcome.reason && HELD_BACK.has(outcome.reason)) {
        showHold(
          outcome.reason === "reply_changed_on_google"
            ? { kind: "reply_changed_on_google", googleReply: outcome.google_reply ?? null, review: null }
            : outcome.reason === "draft_predates_reply"
              ? { kind: "draft_predates_reply", googleReply: outcome.google_reply ?? null }
              : { kind: outcome.reason === "checks_failed" ? "checks_failed" : "confirm_warnings_required", findings: outcome.findings ?? [] },
          sentText,
          latest,
        );
        return;
      }
      if (outcome && outcome.status !== "sent") {
        if (outcome.status === "failed") {
          // A failed send's reason is Google's error message: its code (2026-11-17) says what to offer.
          const action = sendFailureAction(outcome.code);
          toast.error("The reply wasn't sent", {
            description: sendFailureText(outcome.reason, outcome.code),
            ...(action === "reconnect" ? { action: { label: "Reconnect Google", onClick: () => connectGoogle() } } : {}),
          });
          // The draft is kept with the error ("Not sent."), here to send again.
          const failed = asFailedSend(latest, outcome.reason ?? null, outcome.code ?? null);
          putReviewInCache(queryClient, locationId, failed);
          keep(failed);
          return;
        }
        // `deadline` never cuts a send of one review; the rest have nothing left to send.
        toast.error(SEND_REASON[outcome.reason ?? ""] ?? "The reply wasn't sent. Try again.");
        if (outcome.reason && NOTHING_TO_SEND.has(outcome.reason)) release();
        else keep(latest);
        return;
      }
      // Google reviews every reply first: the review is `pending` until the list is read again.
      updateReviewInCache(queryClient, locationId, review.review_id, (current) => asSentReview(current, sentText));
      setHold(null);
      setDeclined(null);
      closeEditor();
      release();
      toast.success("Reply sent to Google", { description: SENT_REPLIES_NOTE });
    } catch (err) {
      // An agency without its client's authorization: the page's banner says who can give it (one toast for the page).
      if (noteReplyAuthorizationRequired(queryClient, locationId, err)) {
        keep(latest);
        return;
      }
      const block = sendBlockFromError(err);
      if (block) showHold(block, sentText, latest);
      else {
        noteAccountError(err);
        toast.error(reviewErrorMessage(err, "The reply couldn't be sent.").message);
        // The text was saved first: it stays here to send again.
        if (latest !== review) keep(latest);
      }
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };

  /** Deletes the saved draft (`success`: a toast to show after). Focus stays on the card. */
  const discard = async (success?: string) => {
    setBusy("discard");
    let discarded = false;
    try {
      await deleteReplyDraft(locationId, review.review_id);
      // The answer is `{ deleted, review_id }` (2026-11-17, G1): show it at once, then read the review itself again.
      updateReviewInCache(queryClient, locationId, review.review_id, withoutDraft);
      closeEditor();
      setHold(null);
      setDeclined(null);
      discarded = true;
      if (success) toast.success(success);
    } catch (err) {
      noteAccountError(err);
      toast.error(reviewErrorMessage(err, "The draft couldn't be discarded.").message);
    } finally {
      setBusy(null);
      settleFocus.current = true;
      if (discarded) {
        // Let the card go only once the review and the list (and the summary's counts) have been read
        // again: if the review still belongs in this view it simply stays in its slot (focus with it); if
        // not, it leaves then. Letting go first made a kept card vanish and come back, and focus jump to
        // the next review.
        void Promise.all([
          refetchReview(queryClient, locationId, review.review_id),
          queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) }),
          queryClient.invalidateQueries({ queryKey: ["billing"] }),
        ]).finally(release);
      } else {
        refresh();
      }
    }
  };

  /** A new AI draft (`regenerate` when one exists). It uses one of the location's AI replies (2026-11-17). */
  const draftWithAi = async () => {
    setBusy("ai");
    try {
      const result = await generateReplyDrafts(locationId, [review.review_id], Boolean(draft));
      for (const item of result.drafts ?? []) putReviewInCache(queryClient, locationId, item);
      setCachedCredits(queryClient, locationId, result);
      noteAiSuccess();
      const drafted = (result.drafts ?? []).find((item) => item.review_id === review.review_id);
      const skipped = result.skipped?.find((item) => item.review_id === review.review_id);
      if (skipped && !drafted) {
        // Phase 25b: `deadline` (not written in time), the AI's reasons, `draft_changed`; nothing was used.
        const why = draftSkipText(skipped.reason);
        toast.info("No new draft", {
          description: why.text,
          ...(why.retry ? { action: { label: "Draft it again", onClick: () => void draftWithAi() } } : {}),
        });
        return;
      }
      // The new draft stays here to check, even in a list of reviews without one.
      if (drafted) keep(drafted);
      closeEditor();
      setHold(null);
      setDeclined(null);
      toast.success(draft ? "New AI draft ready to check." : "AI draft ready to check.");
    } catch (err) {
      toastReplyError(err, { fallback: "The AI draft couldn't be made", blockSize: limits.blockSize, onRetry: () => void draftWithAi() });
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };

  /**
   * "Try the other version" (Phase 25b, free): the AI's other candidate becomes the draft and this one the other
   * version, so the same button switches back. 409 `draft_edited`: the user edited it, so ask first ("Your edits
   * will be lost") and send `discard_edits`; 409 `draft_changed` / 400 `no_alternative`: read the review again.
   */
  const swap = async (discardEdits = false) => {
    setBusy("swap");
    try {
      const answer = await swapReplyDraft(locationId, review.review_id, discardEdits ? { discardEdits: true } : {});
      const swapped = answer.review?.review_id ? answer.review : { ...review, draft: answer.draft };
      putReviewInCache(queryClient, locationId, swapped);
      keep(swapped);
      setHold(null);
      setDeclined(null);
      closeEditor();
      toast.success("Switched to the other version", { description: "Press the button again to switch back." });
    } catch (err) {
      if (isApiError(err) && err.reason === "draft_edited") {
        setConfirmSwap(true);
        return;
      }
      noteAccountError(err);
      toast.error(reviewErrorMessage(err, "The other version couldn't be shown.").message);
      if (isApiError(err) && (err.reason === "draft_changed" || err.reason === "no_alternative")) void refetchReview(queryClient, locationId, review.review_id);
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };

  const closeChangeIt = () => {
    refocusChangeIt.current = true;
    setChanging(false);
  };

  /**
   * "Change it": the AI rewrites the draft as asked (one of the location's AI replies, 2026-11-17). Resolves
   * with a notice for the box (it stays open), or null: done (the box closes), or an AI error shown as a toast.
   */
  const revise = async (instructions: string): Promise<InlineNotice | null> => {
    setBusy("revise");
    try {
      const answer = await reviseReplyDraft(locationId, review.review_id, instructions);
      const rewritten = answer.review?.review_id ? answer.review : answer.draft ? { ...review, draft: answer.draft } : null;
      if (rewritten) {
        putReviewInCache(queryClient, locationId, rewritten);
        // A failed send rewritten is a draft again: it stays here.
        keep(rewritten);
      }
      setCachedCredits(queryClient, locationId, answer);
      noteAiSuccess();
      const parts = answer.declined_instructions ?? [];
      const nextText = answer.review?.draft?.text ?? answer.draft?.text ?? "";
      setDeclined(parts.length > 0 ? { text: nextText, parts } : null);
      setHold(null);
      closeChangeIt();
      toast.success("Draft rewritten", answer.tokens_spent ? { description: `${formatTokenCount(answer.tokens_spent)} used.` } : undefined);
      return null;
    } catch (err) {
      // All of it left out, a change already running, the draft changed meanwhile (reloaded below)…
      const notice = reviseErrorNotice(err);
      if (notice) return notice;
      // The 402 comes before anything is locked or spent: "0 replies left, 1 needed: 1 token buys 10 more".
      toastReplyError(err, { fallback: "The draft couldn't be rewritten", blockSize: limits.blockSize });
      return null;
    } finally {
      setBusy(null);
      refresh();
    }
  };

  // Each answer goes into the cache as well: a review opened above the list (`?review=`) isn't looked up again.
  // A current analysis v2 is reused free; a stale or v1 one is made again (one of the location's AI analyses).
  const analyzeNow = async () => {
    setBusy("analyze");
    try {
      const result = await analyzeReviews(locationId, [review.review_id]);
      for (const item of result.reviews ?? []) putReviewInCache(queryClient, locationId, item);
      setCachedCredits(queryClient, locationId, result);
      noteAiSuccess();
      const analyzed = (result.reviews ?? []).some((item) => item.review_id === review.review_id && item.analysis);
      const skipped = result.skipped?.find((item) => item.review_id === review.review_id);
      if (skipped && !analyzed) {
        const why = draftSkipText(skipped.reason, "analyze");
        toast.info("No new analysis", {
          description: why.text,
          ...(why.retry ? { action: { label: "Try again", onClick: () => void analyzeNow() } } : {}),
        });
        return;
      }
      toast.success("Analysis added to the review.");
    } catch (err) {
      // Analyze's 402 says how many analyses are left (2026-11-17): "0 analyses left, 1 needed: …".
      toastReplyError(err, { fallback: "The review couldn't be analyzed", blockSize: limits.blockSize });
    } finally {
      setBusy(null);
      settleFocus.current = true;
      refresh();
    }
  };
  const analyze = () => void analyzeNow();

  const draftRemovalRequest = () =>
    void run(
      "appeal",
      async () => {
        const result = await draftAppeal(locationId, review.review_id);
        putReviewInCache(queryClient, locationId, result.review);
        if (result.report_url) setReportUrl(result.report_url);
      },
      { fallback: "The removal request couldn't be drafted.", success: "Removal request drafted. Copy it into Google's tool.", ai: true },
    );

  const recordReportStatus = (status: ReviewReportStatus) =>
    void run("status", async () => putReviewInCache(queryClient, locationId, await setReportStatus(locationId, review.review_id, status)), {
      fallback: "The status couldn't be saved.",
      success: "Saved.",
    });

  const removeReply = () =>
    void run(
      "remove",
      async () => {
        await deleteReply(locationId, review.review_id);
        // `{ deleted, review_id }` (2026-11-17, G1): shown at once, then the review is read again (the summary with the list).
        updateReviewInCache(queryClient, locationId, review.review_id, withoutReply);
        await refetchReview(queryClient, locationId, review.review_id);
      },
      { fallback: "The reply couldn't be removed.", success: "Reply removed from Google." },
    );

  // A review deleted on Google gets no reply actions (analysis, removal requests and replies all need it on Google).
  const menuItems =
    canEdit && !deleted
      ? [
          canAnalyze ? "analyze" : null,
          review.appeal_eligible && !review.appeal && !suspicious ? "appeal" : null,
          publicReply || review.reply_state === "rejected" ? "remove" : null,
        ].filter((item): item is "analyze" | "appeal" | "remove" => item !== null)
      : [];

  /**
   * As "Send anyway?" or "Google already has a reply" closes, whichever way: back on Send when it can
   * be pressed, else on the card. False when the card has gone (sent, and no longer in the view): the
   * list then puts focus on the card in its place.
   */
  const returnFocus = (): boolean => {
    const button = sendRef.current;
    if (button?.isConnected && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
      button.focus({ preventScroll: true });
      return true;
    }
    const card = articleRef.current;
    if (!card?.isConnected) return false;
    card.focus({ preventScroll: true });
    return true;
  };

  const sendButton = (
    <Button
      ref={sendRef}
      size="sm"
      disabled={!sendable}
      aria-disabled={(sendable && busy !== null) || undefined}
      aria-describedby={sendBlockedReason ? (reasonUnderField ? lengthErrorId : reasonId) : undefined}
      aria-busy={busy === "send" || undefined}
      className="aria-disabled:opacity-50"
      onClick={() => {
        if (busy === null) void send();
      }}
    >
      {busy === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
      Send reply
    </Button>
  );

  return (
    <article
      ref={articleRef}
      // Focus comes here when the control that had it goes (a sent reply, a discarded draft, a dialog closing).
      tabIndex={-1}
      aria-label={`Review by ${reviewer}`}
      className={cn(
        "relative min-w-0 rounded-xl border bg-card p-4 shadow-card outline-hidden transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring sm:p-5",
        suspicious ? "border-critical/30" : review.flag_level === "attention" ? "border-warning/45" : "border-border",
        selected && "border-primary/50 ring-2 ring-primary/20",
        className,
      )}
    >
      <div className="flex gap-3 sm:gap-4">
        {selectable && canEdit && onSelect && !deleted ? (
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
              {hideNeedsReply && review.reply_state === "none" && !deleted ? null : <ReplyStateBadge review={review} aiDraft={aiDraft} />}
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
                        <span className="text-xs text-muted-foreground" title={analysisCost.detail}>
                          {analysisCost.chip}
                          <span className="sr-only">. {analysisCost.detail}</span>
                        </span>
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

          {/* Phase 25b: the reviewer's words for what they mentioned are underlined (listed in the analysis too). */}
          <ReviewText review={review} />

          {review.analysis ? <AnalysisPanel analysis={review.analysis} /> : null}

          {/* Phase 25b: where an automatic reply stands (being written, goes out at …, held for a person, cancelled). */}
          {!deleted ? <AutoReplyReviewNote review={review} now={now} canEdit={canEdit} className="mt-3" /> : null}

          {/* The reply on Google: published, or waiting for Google's review (Phase 25a). */}
          {publicReply && !(editMode && !hasDraft) ? (
            <ReplyOnGoogle review={review} text={publicReply} now={now}>
              {canEdit && !deleted && !writing ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setEditing(true)}>
                    <Pencil aria-hidden /> Edit reply
                  </Button>
                </div>
              ) : null}
            </ReplyOnGoogle>
          ) : null}

          {/* Google rejected the last reply: it isn't public, and a new one can be written and sent. */}
          {rejected && review.reply_state === "rejected" ? (
            <RejectedReply rejected={rejected} canReply={canEdit && !deleted}>
              {canEdit && !deleted && !writing ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {review.ai_reply_eligible ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={AI_SOFT_BUTTON}
                        disabled={busy !== null || aiBlocked}
                        title={aiBlocked ? ai.reason : undefined}
                        aria-describedby={aiOffReason ? aiReasonId : undefined}
                        aria-busy={busy === "ai" || undefined}
                        onClick={() => void draftWithAi()}
                      >
                        {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                        New reply with AI
                        <ReplyCostChip cost={replyCost} balance={balance} className="-mr-1" />
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setEditing(true)}>
                      <Pencil aria-hidden /> Write a new reply
                    </Button>
                  </div>
                  {review.ai_reply_eligible && aiOffReason ? <AiOffNote id={aiReasonId} reason={aiOffReason} className="mt-2" /> : null}
                </>
              ) : null}
            </RejectedReply>
          ) : null}

          {deleted ? (
            <DraftNote tone="neutral" icon={EyeOff} className="mt-4">
              This review is no longer on Google, so it can't get a reply.
            </DraftNote>
          ) : null}

          {sendError && canEdit && !deleted ? (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2 text-sm text-critical">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>
                  {/* The backend stores Google's error message; its code (2026-11-17) decides the words and the action. */}
                  <span className="font-semibold">{update || hasLiveReply(review) ? "Update not sent." : "Not sent."}</span>{" "}
                  {sendFailureText(sendError, review.send_error_code)}
                </p>
                {sendErrorAction === "reconnect" ? (
                  <Button size="sm" variant="outline" className="mt-2 bg-card" onClick={() => connectGoogle()}>
                    <RefreshCw aria-hidden /> Reconnect Google
                  </Button>
                ) : sendErrorAction === "support" ? (
                  <Button asChild size="sm" variant="outline" className="mt-2 bg-card">
                    <Link to={SUPPORT_PATH}>
                      <LifeBuoy aria-hidden /> Contact support
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {writing ? (
            <div className={cn("mt-4 rounded-xl border p-3 sm:p-4", aiDraft && !editMode ? "border-ai/30 bg-ai-surface/60" : "border-border bg-surface-strong")}>
              <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                {draft ? (
                  draft.source === "ai" ? (
                    <AiBadge label="AI draft" variant={draft.edited ? "soft" : "solid"} />
                  ) : (
                    <StatusBadge tone="neutral" icon={PenLine} size="sm">
                      Your draft
                    </StatusBadge>
                  )
                ) : (
                  <span className="font-semibold text-foreground">{publicReply ? "Edit your reply" : rejected ? "Your new reply" : "Your reply"}</span>
                )}
                {draft?.source === "ai" && draft.edited ? (
                  <StatusBadge tone="neutral" icon={PenLine} size="sm">
                    Edited by you
                  </StatusBadge>
                ) : null}
                {/* The double-check was made on the AI's text; an edited text is checked when it's sent. */}
                {aiDraft && draft?.verification ? <VerificationBadge verification={draft.verification} /> : null}
                {/* Phase 25b: the judge's score of the AI's text (none when no judge ran). */}
                {draft ? <QualityBadge draft={draft} /> : null}
                {/* 2026-11-17 (G3): an update of the reply on Google, or a draft written before it. */}
                {update ? (
                  <StatusBadge tone="info" icon={Repeat2} size="sm">
                    Replaces the reply on Google
                  </StatusBadge>
                ) : leftBehind ? (
                  <StatusBadge tone="warning" icon={History} size="sm">
                    Written before the reply on Google
                  </StatusBadge>
                ) : null}
                {draft?.stale ? (
                  <StatusBadge tone="warning" size="sm">
                    The review changed since this draft
                  </StatusBadge>
                ) : null}
                {helperText ? <span className="text-muted-foreground">{helperText}</span> : null}
              </div>

              {leftBehind && !editMode ? (
                <DraftNote tone="warning" icon={History} className="mb-2.5">
                  This draft was written before the reply now on Google. Send it to replace that reply, or discard it to keep the reply on Google.
                </DraftNote>
              ) : null}
              {rejected && review.reply_state !== "rejected" ? (
                <DraftNote tone="critical" icon={Ban} className="mb-2.5">
                  Your last reply was rejected by Google: {rejected.reason ?? "Google didn't say why."}
                </DraftNote>
              ) : null}
              {draft?.recommendation === "no_public_reply" ? (
                <DraftNote tone="info" className="mb-2.5">
                  For this review you may prefer not to reply publicly. The draft is one short line that confirms nothing.
                </DraftNote>
              ) : null}

              {editMode ? (
                <>
                  <Textarea
                    ref={textareaRef}
                    aria-label={`Reply to ${reviewer}`}
                    aria-describedby={overLimit ? `${counterId} ${lengthErrorId}` : counterId}
                    aria-invalid={overLimit || undefined}
                    rows={4}
                    // Opened by a click ("Write a reply", "Edit"…), so the field takes the focus.
                    autoFocus={editing}
                    value={draftText}
                    placeholder="Write a reply…"
                    onChange={(event) => setText(event.target.value)}
                    className="bg-card"
                  />
                  <div className="mt-1.5 flex flex-wrap items-start gap-x-3 gap-y-1">
                    {overLimit ? (
                      <p id={lengthErrorId} role="alert" className="min-w-0 flex-1 text-xs font-medium text-critical">
                        {lengthProblem(draftText)}
                      </p>
                    ) : null}
                    <p
                      id={counterId}
                      title={`Bytes. ${BYTES_HINT}`}
                      className={cn(
                        "ml-auto text-xs tabular-nums",
                        overLimit ? "font-semibold text-critical" : bytes > REPLY_MAX_BYTES * 0.9 ? "text-warning-foreground" : "text-muted-foreground",
                      )}
                    >
                      {bytes.toLocaleString()} / {REPLY_MAX_BYTES.toLocaleString()}
                      <span className="sr-only"> bytes. {BYTES_HINT}</span>
                    </p>
                  </div>
                </>
              ) : draft ? (
                <>
                  <div className="rounded-lg border border-border bg-card px-3 py-2.5">
                    <DraftText text={draft.text} checks={checks} findingId={findingId} />
                  </div>
                  <DraftProvenance draft={draft} className="mt-2" />
                  <QualityNotes draft={draft} className="mt-2" />
                </>
              ) : null}

              {holdApplies && hold?.kind === "checks_failed" ? (
                <DraftNote tone="critical" role="alert" className="mt-3">
                  {SEND_BLOCK_COPY.checks_failed}
                </DraftNote>
              ) : holdApplies && hold?.kind === "confirm_warnings_required" && !confirmOpen ? (
                <DraftNote tone="warning" className="mt-3">
                  {SEND_BLOCK_COPY.confirm_warnings_required}
                </DraftNote>
              ) : null}

              {draft ? (
                <DraftFindings
                  checks={checks}
                  findingId={editMode ? undefined : findingId}
                  caption={editMode ? "On the saved draft. The checks run again when you save." : undefined}
                  className="mt-3"
                />
              ) : null}

              {declinedParts && !editMode ? (
                <DraftNote tone="info" className="mt-3">
                  We left out: {declinedSummary(declinedParts)}.
                </DraftNote>
              ) : null}

              {changeItOpen ? (
                <ChangeItBox
                  reviewer={reviewer}
                  cost={replyCost}
                  {...(balance === undefined ? {} : { balance })}
                  canRun={ai.canRun}
                  reason={ai.reason}
                  pending={busy === "revise"}
                  onSubmit={revise}
                  onCancel={closeChangeIt}
                  className="mt-3"
                />
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {sendButton}
                  {editMode ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy !== null || !changed || lengthProblem(draftText) !== null} onClick={() => void save()}>
                        {busy === "save" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                        Save draft
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => {
                          // The editor and this button go: focus stays on the card.
                          settleFocus.current = true;
                          closeEditor();
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setEditing(true)}>
                        <Pencil aria-hidden /> Edit
                      </Button>
                      {revisable ? (
                        <Button
                          ref={(node) => {
                            if (node && refocusChangeIt.current) {
                              refocusChangeIt.current = false;
                              node.focus();
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className={AI_SOFT_BUTTON}
                          disabled={busy !== null || aiBlocked}
                          title={aiBlocked ? ai.reason : "Tell the AI what to change in this draft"}
                          aria-describedby={aiOffReason ? (accountBlocked ? reasonId : aiReasonId) : undefined}
                          aria-expanded={false}
                          onClick={() => setChanging(true)}
                        >
                          <WandSparkles aria-hidden /> Change it
                          <ReplyCostChip cost={replyCost} balance={balance} className="-mr-1" />
                        </Button>
                      ) : null}
                      {/* Phase 25b: the writer's other candidate (free, no AI); the same button switches back. */}
                      {alternative ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          aria-busy={busy === "swap" || undefined}
                          title={`The AI wrote two versions. Switch to the other one${typeof alternative.score === "number" ? ` (AI score ${alternative.score.toFixed(1)}/5)` : ""}. Free.`}
                          onClick={() => void swap()}
                        >
                          {busy === "swap" ? <LoaderCircle aria-hidden className="animate-spin" /> : <ArrowLeftRight aria-hidden />}
                          Try the other version
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void discard()}>
                        {busy === "discard" ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
                        Discard draft
                      </Button>
                    </>
                  )}
                  {review.ai_reply_eligible ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn("sm:ml-auto", AI_SOFT_BUTTON)}
                      disabled={busy !== null || aiBlocked}
                      title={aiBlocked ? ai.reason : undefined}
                      aria-describedby={aiOffReason ? (accountBlocked ? reasonId : aiReasonId) : undefined}
                      aria-busy={busy === "ai" || undefined}
                      onClick={() => void draftWithAi()}
                    >
                      {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                      {draft ? "New AI draft" : "Draft with AI"}
                      <ReplyCostChip cost={replyCost} balance={balance} className="-mr-1" />
                    </Button>
                  ) : null}
                </div>
              )}

              {sendBlockedReason && !reasonUnderField && !changeItOpen ? (
                <p id={reasonId} className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>{sendBlockedReason}</span>
                  {authorization.blocked && !accountBlocked ? (
                    // An inline link in small print: the invisible hit area makes it about 40px tall (as "Withdraw").
                    <Button
                      variant="link"
                      size="sm"
                      className="relative h-auto p-0 text-xs after:absolute after:-inset-x-1.5 after:-inset-y-1 after:content-[''] pointer-coarse:after:-inset-y-3"
                      onClick={() => scrollToReplyAuthorization()}
                    >
                      Show me
                    </Button>
                  ) : null}
                </p>
              ) : null}
              {/* The account's reason above covers AI too. */}
              {aiInRow && aiOffReason && !accountBlocked ? <AiOffNote id={aiReasonId} reason={aiOffReason} className="mt-2" /> : null}
            </div>
          ) : canEdit && !deleted && !publicReply && review.reply_state !== "rejected" ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {review.ai_reply_eligible ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={AI_SOFT_BUTTON}
                    disabled={busy !== null || aiBlocked}
                    title={aiBlocked ? ai.reason : undefined}
                    aria-describedby={aiOffReason ? aiReasonId : undefined}
                    aria-busy={busy === "ai" || undefined}
                    onClick={() => void draftWithAi()}
                  >
                    {busy === "ai" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                    Reply with AI
                    <ReplyCostChip cost={replyCost} balance={balance} className="-mr-1" />
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> Write a reply
                </Button>
                {!review.ai_reply_eligible && skipReason && !suspicious ? <span className="text-xs text-muted-foreground">{skipReason}</span> : null}
              </div>
              {review.ai_reply_eligible && aiOffReason ? <AiOffNote id={aiReasonId} reason={aiOffReason} className="mt-2" /> : null}
            </div>
          ) : null}

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
              {/* Gone from Google (removed after the report, or deleted): the request stays as a record, with nothing left to do. */}
              {deleted ? null : (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* An outdated request: AI drafts it again from the review as it is now (charged, as any draft). */}
                    {canRedraftAppeal ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className={AI_SOFT_BUTTON}
                        disabled={busy !== null || aiBlocked}
                        title={aiBlocked ? ai.reason : undefined}
                        aria-describedby={aiOffReason ? appealReasonId : undefined}
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
                    <Select value={review.report_status} onValueChange={(value) => recordReportStatus(value as ReviewReportStatus)}>
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
                  {canRedraftAppeal && aiOffReason ? <AiOffNote id={appealReasonId} reason={aiOffReason} className="mt-1.5" /> : null}
                </>
              )}
            </div>
          ) : suspicious && review.appeal_eligible && canEdit && !deleted ? (
            <div className="mt-4 rounded-xl border border-critical/20 bg-critical-surface/60 p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ShieldAlert aria-hidden className="hidden size-5 shrink-0 text-critical sm:block" />
                <p className="min-w-0 flex-1 text-sm text-foreground">
                  <span className="font-semibold">This review may break Google's rules.</span> Rather than replying, ask Google to remove it. AI drafts the request for you to paste into Google's tool.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className={AI_SOFT_BUTTON}
                  disabled={busy !== null || aiBlocked}
                  title={aiBlocked ? ai.reason : undefined}
                  aria-describedby={aiOffReason ? appealReasonId : undefined}
                  onClick={draftRemovalRequest}
                >
                  {busy === "appeal" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
                  Draft removal request
                  <span className="font-medium">· {formatTokens(ai.costs.appeal)}</span>
                </Button>
              </div>
              {aiOffReason ? <AiOffNote id={appealReasonId} reason={aiOffReason} className="mt-2 sm:justify-end" /> : null}
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
          removeReply();
        }}
      />
      <SendAnywayDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        findings={hold?.kind === "confirm_warnings_required" ? sortChecks(hold.findings) : []}
        onSendAnyway={() => void send({ confirmWarnings: true })}
        onEdit={() => setEditing(true)}
        focusEditor={() => textareaRef.current?.focus()}
        returnFocus={returnFocus}
      />
      <GoogleReplyDialog
        open={onGoogle.open}
        onOpenChange={(open) => setOnGoogle((current) => ({ ...current, open }))}
        googleReply={onGoogle.reply}
        draftText={onGoogle.draftText}
        variant={onGoogle.variant}
        // 2026-11-17 (G3): the draft is left behind now, so it is saved again first (an update), then sent.
        onReplace={() => void send({ resave: true })}
        onDelete={() => void discard("Draft deleted. The reply on Google stays as it is.")}
        returnFocus={returnFocus}
      />
      <ConfirmDialog
        open={confirmSwap}
        onOpenChange={setConfirmSwap}
        title="Switch to the other version?"
        description="Your edits will be lost: the AI's other version replaces this draft."
        confirmLabel="Switch anyway"
        cancelLabel="Keep my edits"
        onConfirm={() => {
          setConfirmSwap(false);
          void swap(true);
        }}
      />
    </article>
  );
}

/** Why the AI buttons above are off, in words: a disabled button shows no tooltip and isn't read out. */
function AiOffNote({ id, reason, className }: { id: string; reason: string; className?: string }) {
  return (
    <p id={id} className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-ai" />
      <span>{reason}</span>
    </p>
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
