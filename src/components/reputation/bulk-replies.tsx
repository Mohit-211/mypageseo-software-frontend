import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Eye, LoaderCircle, Lock, Send, ShieldCheck, Sparkles, Star } from "lucide-react";
import { draftAllReviews, getReviews, isApiError, sendReplies, type Review, type ReviewsSummary, type SendRepliesResponse } from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { InfoTip } from "@/components/layout/shared/info-tip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCanEdit } from "@/hooks/use-access";
import { formatTokenCount, perStartedTen } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import type { AiStatus } from "@/lib/ai/ai-status";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { keywordsPath } from "@/lib/keywords/paths";
import { sendBlockedByAuthorization } from "@/lib/reviews/reply-authorization-copy";
import { putReviewInCache, putSendResultsInCache } from "@/lib/reviews/review-cache";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { draftableCount } from "@/lib/reviews/review-metrics";
import { SENT_REPLIES_NOTE, noteReplyAuthorizationRequired, singleSendResult, summarizeSend, type SendSummary } from "@/lib/reviews/send-results";
import { useReplyAuthorization } from "@/lib/reviews/use-reply-authorization";
import { reviewsKey, reviewsSummaryQuery } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { BulkSendResults } from "./bulk-send-results";

/** Reviews per `POST reviews/send` call (the API's limit). */
const SEND_BATCH = 100;

/** Reviews per "Draft all" call when the summary doesn't say (`ai.draft_all_max`: 20 since Phase 25a). */
const DEFAULT_DRAFT_ALL_MAX = 20;

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** A "Draft all" that left reviews for another call ("Continue (N left)"). */
type Continuation = {
  locationId: string;
  /** The answer's `next_cursor`, sent back as `cursor` so the next call goes on after these reviews. */
  cursor: string;
  /** Reviews the answer said were left. */
  remaining: number;
  /** The answer is newer than the summary (until the summary has been read again). */
  fresh: boolean;
  /**
   * The summary's draftable count once read again after the call. When it changes (new reviews, or
   * drafts and sends made elsewhere), the next "Draft all" starts over from the oldest.
   */
  basis: number | null;
};

export type BulkRepliesProps = {
  locationId: string;
  summary: ReviewsSummary;
  /** `useAiStatus(locationId)`: whether "Draft all" can run, and why not. */
  ai: AiStatus;
  /**
   * "hero": the large card that leads AI Review Replies (the three steps, celebrates when all is done).
   * "bar": a slim strip above a list (the Reviews page); nothing when there's nothing to do.
   */
  variant?: "hero" | "bar";
  /** Shows the drafts in the list below ("Check the drafts"). */
  onShowDrafts?: () => void;
  /** "Open it" on a review a send held back: scrolls to its card, or pins it above the list (`?review=`). */
  onOpenReview?: (reviewId: string) => void;
  className?: string;
};

/**
 * "Draft all": AI drafts a reply for every review without one (except those with suspicious
 * indicators), up to `ai.draft_all_max` per call (20), then "Continue (N left)", which sends the
 * previous answer's `next_cursor` back so each call goes on where the last one stopped. Stars-only
 * 4–5★ reviews (no text) are drafted only when asked ("Include stars-only reviews", at most 3 per
 * location a week). "Send all drafts" publishes every waiting draft in batches after a confirmation,
 * then shows what wasn't sent and why (BulkSendResults). Sending is always the user's click.
 *
 * Never hidden because AI is off or paused: the button stays, disabled, with the reason, so people
 * can find the feature. Hidden only for a read-only client_user, who can't write replies. A read-only
 * or suspended account can't send either (`POST reviews/send` needs billing), and neither can an
 * agency without its client's reply authorization (Phase 25a): "Send all" is disabled with the reason.
 *
 * Counts always come from the summary (refetched after every draft, send or reply), never from an
 * older answer. Render it with `key={locationId}`: what it holds (a "Continue", send results, the
 * confirmation) belongs to one location.
 */
export function BulkReplies({ locationId, summary, ai, variant = "bar", onShowDrafts, onOpenReview, className }: BulkRepliesProps) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  const canEdit = useCanEdit();
  const authorization = useReplyAuthorization(locationId);
  const [continued, setContinued] = useState<Continuation | null>(null);
  const [includeStarsOnly, setIncludeStarsOnly] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [results, setResults] = useState<SendSummary | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const summaryDraftable = draftableCount(summary);
  // A "Continue" holds while the summary still shows what it showed after that call.
  const ownContinue =
    continued && continued.locationId === locationId && (continued.fresh || continued.basis === null || continued.basis === summaryDraftable) ? continued : null;
  // The live count, except between a "Draft all" answer and the refetch it starts: the answer's own
  // count saves a flash of the old number, and the summary takes over as soon as it's read again.
  const draftable = ownContinue?.fresh ? ownContinue.remaining : summaryDraftable;
  const drafts = summary.stats?.drafts_pending ?? 0;
  const perCall = summary.ai?.draft_all_max ?? DEFAULT_DRAFT_ALL_MAX;
  const per10 = summary.ai?.token_costs?.reply_drafts_per_10 ?? ai.costs.reply_drafts_per_10;
  // Phase 25a: stars-only 4–5★ reviews (no text) wait outside `draftable`, at most `stars_only_left` a week.
  const starsWaiting = Math.max(0, summary.ai?.stars_only_draftable ?? 0);
  const starsLeft = Math.max(0, summary.ai?.stars_only_left ?? 0);
  const starsNow = Math.min(starsWaiting, starsLeft);
  const continuing = ownContinue !== null && draftable > 0;
  // Only stars-only reviews are left to draft: the button drafts those (the option would be the only way).
  const starsOnlyMode = draftable === 0 && starsWaiting > 0;
  const withStars = starsOnlyMode || (includeStarsOnly && starsNow > 0);
  // The button counts the reviews with text; the stars-only option shows its own numbers next to it,
  // so "Continue (N left)" doesn't change when the summary is read again.
  const toDraft = starsOnlyMode ? starsNow : draftable;
  const cost = summary.ai?.draft_all_cost === undefined ? undefined : summary.ai.draft_all_cost + (withStars ? perStartedTen(starsNow, per10) : 0);

  /** Reads the reviews (summary, lists, counts) and the balance again; resolves once the reviews are back. */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
    return queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
  };

  const draftAll = useMutation({
    mutationFn: (request: { cursor: string | null; includeStarsOnly: boolean }) =>
      draftAllReviews(locationId, { cursor: request.cursor, include_stars_only: request.includeStarsOnly }),
    onSuccess: (result) => {
      noteAiSuccess();
      // The new drafts at once, wherever a card shows them (a review opened above the list included).
      for (const item of result.drafts ?? []) putReviewInCache(queryClient, locationId, item);
      // Stop when nothing is left, or when the answer gives no cursor to go on from.
      const more = result.remaining > 0 && result.next_cursor !== null;
      setContinued(more && result.next_cursor ? { locationId, cursor: result.next_cursor, remaining: result.remaining, fresh: true, basis: null } : null);
      toast.success(result.drafted > 0 ? `${plural(result.drafted, "reply", "replies")} drafted` : "No new drafts", {
        description: more
          ? `${result.remaining.toLocaleString()} still to draft: press Continue when you're ready.`
          : `Check the drafts, then send them. ${formatTokenCount(result.tokens_spent)} used.`,
      });
    },
    onError: (err, request) => {
      // The cursor is opaque and can expire: start again from the oldest review next time.
      if (request.cursor && isApiError(err) && err.reason === "invalid_input") {
        setContinued(null);
        toast.error("The list of reviews changed", { description: "Press the button again to draft from the oldest review without a reply." });
        return;
      }
      toastAiError(err, { fallback: "The replies couldn't be drafted" });
    },
    // Once the summary has been read again, its own count takes over from the answer's, and the
    // "Continue" remembers that count. Not returned: the mutation would wait for the refetch before
    // it stops "Drafting…".
    onSettled: () => {
      void refresh().then(() => {
        const fresh = queryClient.getQueryData<ReviewsSummary>(reviewsSummaryQuery(locationId).queryKey);
        setContinued((current) => (current?.fresh ? { ...current, fresh: false, basis: fresh ? draftableCount(fresh) : null } : current));
      });
    },
  });

  const sendAll = useMutation({
    mutationFn: async (): Promise<SendSummary> => {
      // Every unreplied review with a draft, 100 per page (live replies and reviews deleted on Google aren't listed).
      const pending: Review[] = [];
      for (let page = 1; ; page += 1) {
        const list = await getReviews(locationId, { has_draft: true, replied: false, page, limit: SEND_BATCH });
        pending.push(...list.reviews);
        if (pending.length >= list.total || list.reviews.length === 0) break;
      }
      const totals: SendRepliesResponse = { results: [], sent: 0, failed: 0 };
      let interrupted: string | null = null;
      for (let index = 0; index < pending.length; index += SEND_BATCH) {
        if (pending.length > SEND_BATCH) setProgress(`Sending ${Math.min(index + SEND_BATCH, pending.length)} of ${pending.length}…`);
        const batch = pending.slice(index, index + SEND_BATCH);
        try {
          const part = await sendReplies(
            locationId,
            batch.map((review) => review.review_id),
          );
          totals.results.push(...part.results);
          totals.sent += part.sent;
          totals.failed += part.failed;
        } catch (err) {
          // A batch of one review: the checks' answer is an error, counted like a result of several.
          const only = batch.length === 1 ? batch[0] : undefined;
          const single = only ? singleSendResult(err, only.review_id) : null;
          if (single) {
            totals.results.push(single);
            continue;
          }
          // Nothing sent yet: the error is the answer. A later batch keeps what was sent before it.
          if (totals.results.length === 0) throw err;
          const left = pending.length - index;
          interrupted = `The last ${plural(left, "reply", "replies")} couldn't be sent. ${reviewErrorMessage(err, "Try again in a few minutes.").message}`;
          break;
        }
      }
      // What happened to each review, at once, wherever a card shows it (until the lists are read again).
      putSendResultsInCache(queryClient, locationId, totals.results);
      return summarizeSend(totals, pending, interrupted);
    },
    onMutate: () => setResults(null),
    onSuccess: (outcome) => {
      if (outcome.attempted === 0) {
        toast.info("No drafts to send", { description: "They may have been sent or removed meanwhile." });
        return;
      }
      if (outcome.sent === outcome.attempted && !outcome.interrupted) {
        toast.success(`${plural(outcome.sent, "reply", "replies")} sent to Google`, {
          description:
            outcome.unchecked > 0
              ? `${SENT_REPLIES_NOTE} The automatic content check couldn't run on ${outcome.unchecked.toLocaleString()} of them; nothing else held them back.`
              : SENT_REPLIES_NOTE,
        });
        return;
      }
      setResults(outcome);
    },
    onError: (err) => {
      // An agency without its client's authorization: the banner says what to do.
      if (noteReplyAuthorizationRequired(queryClient, locationId, err)) return;
      toast.error(reviewErrorMessage(err, "The replies couldn't be sent.").message);
    },
    onSettled: () => {
      setProgress(null);
      void refresh();
    },
  });

  if (!canEdit) return null;
  if (variant === "bar" && draftable === 0 && drafts === 0 && results === null) return null;

  const busy = draftAll.isPending || sendAll.isPending;
  const allDone = draftable === 0 && drafts === 0 && starsWaiting === 0;
  const blocked = !ai.canRun;
  // A read-only or suspended account: AI is off and the backend refuses sending too.
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";
  // Why "Send all" can't be used right now: the account, or (agency) the client's authorization.
  const sendBlockedReason = accountBlocked
    ? ai.blockedBy === "suspended"
      ? "This account is suspended."
      : "Sending replies needs an active subscription."
    : authorization.blocked
      ? sendBlockedByAuthorization(authorization.grantMethod)
      : null;
  // One line about the account (not AI's own reason twice), only when there's something it stops.
  const accountNote = !accountBlocked
    ? null
    : ai.blockedBy === "suspended"
      ? "This account is suspended, so replies can't be drafted or sent."
      : drafts > 0
        ? draftable > 0
          ? "Drafting and sending replies need an active subscription."
          : "Sending replies needs an active subscription."
        : "Drafting replies with AI needs an active subscription.";

  const starsLimitReached = starsWaiting > 0 && starsLeft === 0;
  const draftLabel = draftAll.isPending
    ? "Drafting…"
    : continuing
      ? `Continue (${toDraft.toLocaleString()} left)`
      : starsOnlyMode
        ? toDraft > 0
          ? `Draft ${plural(toDraft, "short reply", "short replies")}`
          : "Draft short replies"
        : `Draft ${plural(toDraft, "reply", "replies")}`;
  const draftButton =
    draftable > 0 || starsOnlyMode ? (
      <Button
        variant="ai"
        size={variant === "hero" ? "lg" : "sm"}
        aria-busy={draftAll.isPending || undefined}
        disabled={busy || blocked || toDraft === 0}
        title={blocked ? ai.reason : toDraft === 0 && starsLimitReached ? "This week's 3 stars-only drafts are used. More next week." : undefined}
        onClick={() => draftAll.mutate({ cursor: continuing && ownContinue ? ownContinue.cursor : null, includeStarsOnly: withStars })}
        className={variant === "hero" ? "w-full sm:w-auto" : undefined}
      >
        {draftAll.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {draftLabel}
        {cost !== undefined && toDraft > 0 && !draftAll.isPending ? <AiCostChip tokens={cost} variant="inverse" /> : null}
      </Button>
    ) : null;

  const sendButton =
    drafts > 0 ? (
      <Button
        variant={draftable === 0 && !starsOnlyMode && variant === "hero" ? "default" : "outline"}
        size={variant === "hero" ? "lg" : "sm"}
        aria-busy={sendAll.isPending || undefined}
        disabled={busy || sendBlockedReason !== null}
        title={sendBlockedReason ?? undefined}
        onClick={() => setConfirmSend(true)}
        className={variant === "hero" ? "w-full sm:w-auto" : undefined}
      >
        {sendAll.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
        Send all {plural(drafts, "draft", "drafts")}
      </Button>
    ) : null;

  // "Include stars-only reviews": only next to a "Draft all" that has other reviews to draft.
  const starsOption =
    starsWaiting > 0 && !starsOnlyMode ? (
      <div className="flex items-center gap-x-1 text-sm text-foreground">
        <label className="-my-1 flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5 has-[:disabled]:cursor-not-allowed">
          <Checkbox
            checked={includeStarsOnly && starsLeft > 0}
            disabled={busy || blocked || starsLeft === 0}
            onCheckedChange={(value) => setIncludeStarsOnly(value === true)}
          />
          <span>
            Include stars-only reviews{" "}
            <span className="text-muted-foreground">
              ({starsWaiting.toLocaleString()} waiting · {starsLeft.toLocaleString()} left this week)
            </span>
          </span>
        </label>
        <InfoTip label="About stars-only reviews" className="shrink-0">
          Reviews with a star rating and no text get a reply of one or two sentences. AI drafts at most 3 of them per location every 7 days, so most of your
          drafts go to reviews people wrote.
        </InfoTip>
      </div>
    ) : null;

  /**
   * The results panel goes: focus stays on this section. The slim bar on Reviews goes too when
   * nothing is left to draft or send, so focus then goes to the page's heading, as after a dialog.
   */
  const closeResults = () => {
    const stays = variant === "hero" || draftable > 0 || drafts > 0;
    const target = stays ? sectionRef.current : document.querySelector<HTMLElement>("#main-content [data-page-header] h1");
    target?.focus({ preventScroll: stays });
    setResults(null);
  };

  const notes = (
    <>
      {accountNote && (draftable > 0 || drafts > 0) ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{accountNote}</span>
        </p>
      ) : blocked && (draftable > 0 || starsOnlyMode) && ai.reason ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-ai" />
          <span>
            {ai.reason} {ai.blockedBy === "off" || ai.blockedBy === "paused" ? "You can still reply to each review yourself below." : null}
          </span>
        </p>
      ) : null}
      {!accountBlocked && authorization.blocked && drafts > 0 && sendBlockedReason ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
          <span>{sendBlockedReason}</span>
        </p>
      ) : null}
      {starsOption}
      {starsOnlyMode && starsLimitReached ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Star aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>This week's 3 stars-only drafts for this location are used. More next week, or reply to them yourself below.</span>
        </p>
      ) : null}
      {toDraft > perCall && !draftAll.isPending && !blocked ? (
        <p className="text-xs text-muted-foreground">
          AI drafts up to {perCall} replies at a time{continuing ? "" : ": press Continue for the rest"}.
        </p>
      ) : null}
      {draftAll.isPending ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin text-ai motion-reduce:animate-none" />
          Drafting up to {Math.min(perCall, Math.max(toDraft, 1))} {Math.min(perCall, Math.max(toDraft, 1)) === 1 ? "reply" : "replies"}. It can take up to a minute;
          you can keep reading meanwhile.
        </p>
      ) : null}
      {progress ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
          {progress}
        </p>
      ) : null}
      {results ? <BulkSendResults summary={results} onOpenReview={onOpenReview} onDismiss={closeResults} /> : null}
    </>
  );

  const confirm = (
    <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send {plural(drafts, "reply", "replies")} to Google?</AlertDialogTitle>
          <AlertDialogDescription>
            Every review with a waiting draft gets that draft as its reply, exactly as written. Each one is checked again first: a draft a check holds back stays a
            draft, and you'll see why. If you haven't read them yet, check the drafts first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmSend(false);
              sendAll.mutate();
            }}
          >
            Send replies
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (variant === "bar") {
    return (
      <section
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Reply in bulk"
        className={cn(
          "space-y-2.5 rounded-xl border border-ai/20 bg-ai-surface/70 p-3 shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:px-4",
          className,
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-linear-to-br from-ai to-ai-hover text-ai-foreground shadow-xs">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {draftable > 0
                  ? continuing
                    ? `${draftable.toLocaleString()} more ${draftable === 1 ? "reply" : "replies"} to draft with AI`
                    : blocked
                      ? `${plural(draftable, "review is", "reviews are")} waiting for an AI reply`
                      : `AI can draft replies to ${plural(draftable, "review", "reviews")} in one go`
                  : drafts > 0
                    ? `${plural(drafts, "draft is", "drafts are")} ready to check`
                    : "Your last send"}
              </p>
              <p className="text-muted-foreground">
                {draftable > 0
                  ? "Each in the reviewer's language. Nothing is sent until you send it."
                  : drafts > 0
                    ? "Read them below, then send them to Google."
                    : "What was sent, and what wasn't, is below."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
            {draftButton}
            {sendButton}
          </div>
        </div>
        {notes}
        {confirm}
      </section>
    );
  }

  // Only stars-only reviews wait (nothing else to draft or send).
  const onlyStars = starsOnlyMode && drafts === 0;
  const step = allDone ? 4 : draftable > 0 || onlyStars ? 1 : 2;
  const headline = allDone
    ? "All caught up"
    : draftable > 0
      ? continuing
        ? `${draftable.toLocaleString()} more ${draftable === 1 ? "reply" : "replies"} to draft`
        : blocked
          ? `${plural(draftable, "review is", "reviews are")} waiting for an AI reply`
          : `AI can draft replies to ${plural(draftable, "review", "reviews")}`
      : drafts > 0
        ? `${plural(drafts, "draft is", "drafts are")} ready to check`
        : `${plural(starsWaiting, "stars-only review is", "stars-only reviews are")} waiting`;
  const description: ReactNode = allDone ? (
    "Every review has a reply. New reviews show up here after the next check with Google."
  ) : draftable > 0 ? (
    <>
      AI writes a reply to each one in the reviewer's language and uses one of your{" "}
      <Link
        to={keywordsPath(locationId)}
        className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        keywords
      </Link>{" "}
      only where the review is about it. Every draft is checked before you see it, and reviews with suspicious indicators are skipped. Nothing is sent until you
      send it.
    </>
  ) : onlyStars ? (
    "These reviews have a star rating but no text. AI can write a thank-you of one or two sentences to each, up to 3 per location a week. Nothing is sent until you send it."
  ) : (
    "Read each draft below and change anything you like, then send them to Google. Sending is free."
  );

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label="Draft replies with AI"
      className={cn(
        "relative isolate overflow-hidden rounded-xl border border-ai/25 bg-card shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        allDone && "border-success/30",
        className,
      )}
    >
      {/* AI's colour as a soft wash, never as a block. */}
      <span aria-hidden className={cn("absolute inset-0 -z-10 bg-linear-to-br to-transparent to-60%", allDone ? "from-success-surface" : "from-ai-surface")} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", allDone ? "bg-success" : "bg-linear-to-r from-ai via-ai/70 to-primary")} />
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {allDone ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 aria-hidden className="size-4" /> Nothing waiting
              </span>
            ) : (
              <>
                <AiBadge />
                <span className="text-xs font-semibold text-ai">Draft all</span>
              </>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{headline}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
          <ol aria-label="How it works" className="mt-4 flex flex-wrap gap-2">
            {["AI drafts", "You check and edit", "You send"].map((label, index) => {
              const number = index + 1;
              const done = number < step;
              const current = number === step;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium",
                    current ? "border-ai/35 bg-card text-foreground shadow-xs" : done ? "border-success/25 bg-success-surface text-success" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-xs font-semibold",
                      current ? "bg-ai text-ai-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-3.5" /> : number}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
        </div>
        {draftButton || sendButton || onShowDrafts ? (
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
            {draftButton}
            {sendButton}
            {draftable === 0 && !starsOnlyMode && drafts > 0 && onShowDrafts ? (
              <Button variant="ghost" size="sm" onClick={onShowDrafts}>
                <Eye aria-hidden /> Show the drafts
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {notes ? <div className="space-y-2 px-5 pb-5 empty:hidden sm:px-6">{notes}</div> : null}
      {confirm}
    </section>
  );
}
