import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";
import { skipToken, useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Pin, Send, Sparkles, X } from "lucide-react";
import { analyzeReviews, generateReplyDrafts, sendReplies, type Review, type ReviewsQuery, type SendRepliesResponse } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { TablePagination } from "@/components/layout/shared/data-table";
import { ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { estimateAnalysisCost, estimateReplyDraftCost, formatTokenCount } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import type { AiStatus } from "@/lib/ai/ai-status";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { replySettled } from "@/lib/reviews/draft-view";
import { sendBlockedByAuthorization } from "@/lib/reviews/reply-authorization-copy";
import { putReviewInCache, putSendResultsInCache } from "@/lib/reviews/review-cache";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { focusReviewCard, reviewLookupKey, useSpotlightReview } from "@/lib/reviews/review-spotlight";
import { SENT_REPLIES_NOTE, noteReplyAuthorizationRequired, singleSendResult, summarizeSend, type SendSummary } from "@/lib/reviews/send-results";
import { useReplyAuthorization } from "@/lib/reviews/use-reply-authorization";
import { reviewsKey, useReviewsList } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { BulkSendResults } from "./bulk-send-results";
import { ReviewCard } from "./review-card";

export const REVIEWS_PAGE_SIZE = 20;

/** Reviews per AI request (`POST reviews/drafts` and `/analyze` take 1–20 ids). */
const MAX_AI_BATCH = 20;

type BulkKind = "drafts" | "analyze" | "send";

type BulkOutcome = { kind: "drafts" | "analyze"; title: string; description?: string } | { kind: "send"; summary: SendSummary };

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

/** Cards kept on screen, by review id: where each stood in the list when it was kept. */
const NONE_HELD: ReadonlyMap<string, number> = new Map();

const NO_REVIEWS: readonly Review[] = [];

/** A reply already on Google (published, or waiting for Google's review): a bulk send never replaces it. */
const LIVE_REPLY = new Set<Review["reply_state"]>(["sent", "pending"]);

/**
 * The element around each card: `data-review-id` lets "Open it" find it (`focusReviewCard`), which
 * focuses it and rings it for a moment (`data-spotlight`).
 */
const CARD_SLOT =
  "rounded-xl outline-hidden transition-shadow duration-300 data-[spotlight]:ring-2 data-[spotlight]:ring-primary data-[spotlight]:ring-offset-2 data-[spotlight]:ring-offset-background";

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

export type ReviewsFeedProps = {
  locationId: string;
  /** `useAiStatus(locationId)` from the page. */
  ai: AiStatus;
  /** The `GET reviews` filter and sort (page and limit are added here). */
  query: Omit<ReviewsQuery, "page" | "limit">;
  page: number;
  onPageChange: (page: number) => void;
  /** Shown when nothing matches (an `EmptyState`). */
  empty: ReactNode;
  /** A short line before the count, e.g. "Newest first". */
  caption?: ReactNode;
  /** Every review listed is unanswered, so cards leave out the "Needs reply" pill. */
  unansweredOnly?: boolean;
  /** A list to read only (reviews deleted on Google): no selection and no bulk actions. */
  readOnly?: boolean;
  /** `?review=<id>`: scrolled to when it's on this page, else shown pinned above the list. */
  spotlight?: string | null;
  /** Opens a review (`?review=<id>`) or, with null, closes the pinned one. */
  onSpotlightChange?: (reviewId: string | null) => void;
  className?: string;
};

/**
 * A page of review cards with bulk actions: tick reviews to draft replies with AI, analyze them or
 * send their drafts (each AI button shows its real price), and page through the rest. The order and
 * the filters come from the page (server-side, newest first by default).
 *
 * Sending several (Phase 25a) checks every text again: what wasn't sent, and why, stays in a results
 * panel above the list, each with "Open it". An agency without its client's reply authorization can't
 * send (the page's banner says how to get it). A review opened from the results or a link
 * (`spotlight`) is scrolled to, or pinned above the list when it's on another page or view.
 *
 * A card the user works on stays where it is until it's sent or its draft discarded, even when the
 * list, read again, no longer has it: a reply saved in "No reply yet" is a draft now, and a send the
 * checks held back ("Send anyway?", "Google already has a reply", the highlighted parts) must not
 * vanish with its card. Changing the view or the page lets it go.
 */
export function ReviewsFeed({
  locationId,
  ai,
  query,
  page,
  onPageChange,
  empty,
  caption,
  unansweredOnly = false,
  readOnly = false,
  spotlight = null,
  onSpotlightChange,
  className,
}: ReviewsFeedProps) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  const canEdit = useCanEdit();
  const now = useNow(60_000);
  const topRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectAllRef = useRef<HTMLButtonElement>(null);
  const list = useReviewsList(locationId, { ...query, page, limit: REVIEWS_PAGE_SIZE });
  const authorization = useReplyAuthorization(locationId);
  const selectable = canEdit && !readOnly;

  // The selection belongs to one page of one filter: a new filter or page starts empty (no effect needed).
  const scope = JSON.stringify([query, page]);
  const [selection, setSelection] = useState<{ scope: string; ids: ReadonlySet<string> }>({ scope, ids: EMPTY_SELECTION });
  const selected = selection.scope === scope ? selection.ids : EMPTY_SELECTION;
  const setSelected = (ids: ReadonlySet<string>) => setSelection({ scope, ids });
  // The last "Send selected" that held something back, until dismissed (one location's).
  const [results, setResults] = useState<{ locationId: string; summary: SendSummary } | null>(null);
  const ownResults = results?.locationId === locationId ? results.summary : null;

  // The card that had focus, and where it stood: when the list leaves it out (sent, its draft
  // discarded…), focus goes to the card now in its place rather than falling to the page. A card
  // let go from a dialog ("Send anyway") counts too: focus was in the dialog, which goes with it.
  const focusedCard = useRef<{ id: string; index: number } | null>(null);
  const releasedCard = useRef<{ id: string; index: number } | null>(null);

  // Cards kept on screen while the user works on them (one page of one view, like the selection).
  // Each shows its review from its own cache entry (`reviewLookupKey`), which every answer the card
  // gets keeps current, so the list can be read again (counts, other cards) without losing it.
  const [held, setHeld] = useState<{ scope: string; at: ReadonlyMap<string, number> }>({ scope, at: NONE_HELD });
  // Leaving the view or page lets its kept cards go for good, so coming back shows the list as read
  // (adjusting state while rendering: no effect, and it settles in one pass).
  if (held.scope !== scope && held.at.size > 0) setHeld({ scope, at: NONE_HELD });
  const heldAt = held.scope === scope ? held.at : NONE_HELD;
  // The view a card's answer arrives in: one from a view left meanwhile keeps nothing.
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  });
  const pageReviews = list.data?.reviews ?? NO_REVIEWS;
  const holdCard = (viewScope: string, reviewId: string, index: number, review: Review | null) => {
    if (viewScope !== scopeRef.current) return;
    if (review) queryClient.setQueryData(reviewLookupKey(locationId, reviewId), review);
    // Let go (sent, discarded) while the list no longer has it: its card leaves now.
    else if (!pageReviews.some((item) => item.review_id === reviewId)) releasedCard.current = { id: reviewId, index };
    setHeld((current) => {
      const at = new Map(current.scope === viewScope ? current.at : NONE_HELD);
      if (review) {
        if (at.has(reviewId)) return current;
        at.set(reviewId, index);
      } else if (!at.delete(reviewId)) return current;
      return { scope: viewScope, at };
    });
  };

  // The page as read, plus the kept cards it no longer has, each back where it stood (same keyed
  // list, so its card, its dialog and its editor stay as they are).
  const missing = [...heldAt].filter(([id]) => !pageReviews.some((review) => review.review_id === id)).sort((a, b) => a[1] - b[1]);
  const kept = useQueries({
    queries: missing.map(([id]) => ({ queryKey: reviewLookupKey(locationId, id), queryFn: skipToken, staleTime: Infinity })),
    combine: (answers) => answers.map((answer) => (answer.data ?? null) as Review | null),
  });
  const reviews = [...pageReviews];
  missing.forEach(([id, index], i) => {
    const review = kept[i];
    // Sent meanwhile (e.g. "Send all"), or gone from Google: nothing left to do on it here.
    if (!review || review.review_id !== id || replySettled(review)) return;
    reviews.splice(Math.min(index, reviews.length), 0, review);
  });

  const trackFocus = (event: FocusEvent<HTMLUListElement>) => {
    const items = listRef.current;
    const slot = event.target instanceof Element ? event.target.closest<HTMLElement>("li[data-review-id]") : null;
    if (!items || !slot || slot.parentElement !== items) return;
    focusedCard.current = { id: slot.dataset.reviewId ?? "", index: Array.prototype.indexOf.call(items.children, slot) };
  };
  const forgetFocus = (event: FocusEvent<HTMLUListElement>) => {
    // Moved on purpose (a dialog, the toolbar, another part of the page): nothing to put back.
    const next = event.relatedTarget;
    if (next instanceof Node && !listRef.current?.contains(next)) focusedCard.current = null;
  };
  const shownIds = reviews.map((review) => review.review_id).join(" ");
  useEffect(() => {
    const last = focusedCard.current ?? releasedCard.current;
    releasedCard.current = null;
    if (!last) return;
    const active = document.activeElement;
    if ((active && active !== document.body) || shownIds.split(" ").includes(last.id)) return;
    focusedCard.current = null;
    const slots = listRef.current?.children;
    const target = slots && slots.length > 0 ? slots[Math.min(last.index, slots.length - 1)] : topRef.current;
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }, [shownIds]);

  const chosen = selectable ? reviews.filter((review) => selected.has(review.review_id)) : [];
  const eligible = chosen.filter((review) => review.ai_reply_eligible).slice(0, MAX_AI_BATCH);
  const analysable = chosen.filter((review) => review.comment?.trim()).slice(0, MAX_AI_BATCH);
  const withDrafts = chosen.filter((review) => review.draft && !LIVE_REPLY.has(review.reply_state) && !review.deleted_on_google_at);
  const draftCost = estimateReplyDraftCost(eligible, ai.costs.reply_drafts_per_10);
  const analysisCost = estimateAnalysisCost(analysable, ai.costs.analysis_per_10);
  const balance = ai.balance === undefined ? {} : { balance: ai.balance };
  // A read-only or suspended account: sending is refused too (`POST reviews/send` needs billing).
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";
  const sendBlockedReason = accountBlocked
    ? ai.blockedBy === "suspended"
      ? "This account is suspended."
      : "Sending replies needs an active subscription."
    : authorization.blocked
      ? sendBlockedByAuthorization(authorization.grantMethod)
      : null;

  // The opened review: on this page, or looked up and pinned above the list.
  const listed = list.isSuccess && !list.isPlaceholderData;
  const inList = spotlight !== null && reviews.some((review) => review.review_id === spotlight);
  const pinned = useSpotlightReview(locationId, spotlight, listed && !inList);
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    // Once per opened review, as soon as its card is on the page (in the list, or pinned).
    if (!spotlight) {
      scrolledTo.current = null;
      return;
    }
    if (scrolledTo.current !== spotlight && focusReviewCard(spotlight)) scrolledTo.current = spotlight;
  }, [spotlight, list.data, pinned.data]);

  const openReview = (reviewId: string) => {
    if (!focusReviewCard(reviewId)) onSpotlightChange?.(reviewId);
  };

  const bulk = useMutation({
    mutationFn: async ({ kind, ids, sent }: { kind: BulkKind; ids: string[]; sent?: Review[] }): Promise<BulkOutcome> => {
      // Each answer goes into the cache at once: a card kept on screen, or opened above the list, shows it without a lookup.
      if (kind === "drafts") {
        const result = await generateReplyDrafts(locationId, ids);
        for (const item of result.drafts ?? []) putReviewInCache(queryClient, locationId, item);
        const parts = [result.reused ? `${result.reused} reused` : "", result.skipped.length ? `${result.skipped.length} skipped` : ""].filter(Boolean);
        return {
          kind,
          title: `${result.generated} ${result.generated === 1 ? "reply" : "replies"} drafted${parts.length ? ` (${parts.join(", ")})` : ""}`,
          description: `Check them before sending. ${formatTokenCount(result.tokens_spent)} used.`,
        };
      }
      if (kind === "analyze") {
        const result = await analyzeReviews(locationId, ids);
        for (const item of result.reviews ?? []) putReviewInCache(queryClient, locationId, item);
        return {
          kind,
          title: `${result.analyzed} ${result.analyzed === 1 ? "review" : "reviews"} analyzed`,
          description: `${result.reused ? `${result.reused} already had a current analysis. ` : ""}${formatTokenCount(result.tokens_spent)} used.`,
        };
      }
      let result: SendRepliesResponse;
      try {
        result = await sendReplies(locationId, ids);
      } catch (err) {
        // One review: the checks' answer is an error, shown like a result of several.
        const single = ids.length === 1 && ids[0] ? singleSendResult(err, ids[0]) : null;
        if (!single) throw err;
        result = { results: [single], sent: 0, failed: 0 };
      }
      putSendResultsInCache(queryClient, locationId, result.results);
      return { kind, summary: summarizeSend(result, sent ?? []) };
    },
    onMutate: ({ kind }) => {
      if (kind === "send") setResults(null);
    },
    onSuccess: (outcome) => {
      setSelected(EMPTY_SELECTION);
      if (outcome.kind !== "send") {
        noteAiSuccess();
        toast.success(outcome.title, outcome.description ? { description: outcome.description } : undefined);
        return;
      }
      const summary = outcome.summary;
      if (summary.attempted > 0 && summary.sent === summary.attempted) {
        toast.success(`${plural(summary.sent, "reply", "replies")} sent to Google`, { description: SENT_REPLIES_NOTE });
        return;
      }
      // Something was held back: the panel says what and why (it takes focus).
      setResults({ locationId, summary });
    },
    onError: (err, { kind }) => {
      if (kind === "send") {
        // An agency without its client's authorization: the page's banner says what to do.
        if (noteReplyAuthorizationRequired(queryClient, locationId, err)) return;
        toast.error(reviewErrorMessage(err, "The replies couldn't be sent.").message);
      } else toastAiError(err, { fallback: kind === "drafts" ? "The replies couldn't be drafted" : "The reviews couldn't be analyzed" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const goToPage = (next: number) => {
    onPageChange(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  if (list.isPending) return <ListSkeleton rows={5} className={className} />;
  if (list.isError) {
    return (
      <ErrorState
        className={className}
        title="Reviews couldn't be loaded"
        description={reviewErrorMessage(list.error, "Something went wrong while loading the reviews.").message}
        onRetry={() => void list.refetch()}
      />
    );
  }

  /** The results panel goes: focus stays at the top of the list ("Select all", else the first card), not on the page. */
  const closeResults = () => {
    const root = topRef.current;
    const target = selectAllRef.current ?? root?.querySelector<HTMLElement>("[data-review-id]") ?? (root?.hasAttribute("tabindex") ? root : null);
    target?.focus({ preventScroll: true });
    setResults(null);
  };

  // What a send held back, and the review opened from it: shown whatever this view holds.
  const resultsPanel = ownResults ? <BulkSendResults summary={ownResults} onOpenReview={openReview} onDismiss={closeResults} /> : null;
  const pinnedCard =
    spotlight !== null && listed && !inList ? (
      <section aria-label="The review you opened" className="space-y-2 rounded-xl border border-primary/25 bg-brand-tint/50 p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2 pl-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Pin aria-hidden className="size-4 shrink-0 text-primary" /> The review you opened
          </p>
          {onSpotlightChange ? (
            <Button variant="ghost" size="sm" onClick={() => onSpotlightChange(null)}>
              <X aria-hidden /> Close
            </Button>
          ) : null}
        </div>
        {pinned.isPending ? (
          <ListSkeleton rows={1} />
        ) : pinned.data ? (
          // Keyed by review: opening another review gives it a card of its own (no editor text or dialog carried over).
          <div key={pinned.data.review_id} data-review-id={pinned.data.review_id} tabIndex={-1} className={CARD_SLOT}>
            <ReviewCard locationId={locationId} review={pinned.data} ai={ai} now={now} />
          </div>
        ) : (
          <p className="px-1 pb-1 text-sm text-muted-foreground">
            {pinned.isError ? "The review couldn't be loaded. Try again in a moment." : "That review isn't in your reviews any more."}
          </p>
        )}
      </section>
    ) : null;

  // Nothing matches and no card is kept on screen.
  if (list.data.total === 0 && reviews.length === 0) {
    return (
      <div ref={topRef} tabIndex={-1} className={cn("min-w-0 space-y-3 outline-hidden", className)}>
        {resultsPanel}
        {pinnedCard}
        {empty}
      </div>
    );
  }

  const total = list.data.total;
  const pageCount = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE));
  const allOnPage = reviews.length > 0 && chosen.length === reviews.length;
  const busy = bulk.isPending;
  const busyKind = bulk.isPending ? bulk.variables?.kind : null;

  return (
    <div ref={topRef} className={cn("min-w-0 scroll-mt-20 space-y-3", className)} aria-busy={list.isPlaceholderData || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-sm text-muted-foreground">
        {selectable ? (
          <label className="-my-1.5 flex min-h-9 cursor-pointer items-center gap-2.5">
            <Checkbox
              ref={selectAllRef}
              checked={allOnPage ? true : chosen.length > 0 ? "indeterminate" : false}
              onCheckedChange={(value) => setSelected(value === true ? new Set(reviews.map((review) => review.review_id)) : EMPTY_SELECTION)}
              aria-label="Select every review on this page"
            />
            <span>Select all on this page</span>
          </label>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1.5">
          {list.isPlaceholderData ? <LoaderCircle aria-label="Updating" className="size-3.5 animate-spin text-primary motion-reduce:animate-none" /> : null}
          {caption ? <span>{caption} ·</span> : null}
          <span className="tabular-nums">
            {total.toLocaleString()} {total === 1 ? "review" : "reviews"}
          </span>
          <InfoTip label="About review checks">
            Each review is checked for links, contact details, repeated text and sudden runs of low ratings. "Suspicious indicators" means a review may break Google's rules; it isn't proof that it's fake.
          </InfoTip>
        </span>
      </div>

      {chosen.length > 0 && selectable ? (
        <div
          role="region"
          aria-label="Selected reviews"
          className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-card/95 px-3 py-2.5 shadow-raised backdrop-blur supports-[backdrop-filter]:bg-card/85"
        >
          <span className="mr-1 text-sm font-semibold text-foreground">{chosen.length} selected</span>
          <Button
            size="sm"
            variant="ai"
            disabled={busy || !ai.canRun || eligible.length === 0}
            title={!ai.canRun ? ai.reason : eligible.length === 0 ? "AI drafts replies to reviews without a reply that have no suspicious indicators." : undefined}
            onClick={() => bulk.mutate({ kind: "drafts", ids: eligible.map((review) => review.review_id) })}
          >
            {busyKind === "drafts" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            Draft {eligible.length} {eligible.length === 1 ? "reply" : "replies"}
            {eligible.length > 0 ? <AiCostChip tokens={draftCost} variant="inverse" /> : null}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-ai/30 text-ai hover:border-ai/50 hover:bg-ai-surface hover:text-ai-hover"
            disabled={busy || !ai.canRun || analysable.length === 0}
            title={!ai.canRun ? ai.reason : analysable.length === 0 ? "Only reviews with text can be analyzed." : undefined}
            onClick={() => bulk.mutate({ kind: "analyze", ids: analysable.map((review) => review.review_id) })}
          >
            {busyKind === "analyze" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            Analyze
            {analysable.length > 0 ? <AiCostChip tokens={analysisCost} {...balance} /> : null}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || withDrafts.length === 0 || sendBlockedReason !== null}
            title={sendBlockedReason ?? (withDrafts.length === 0 ? "None of the selected reviews has a draft waiting to be sent." : undefined)}
            onClick={() => bulk.mutate({ kind: "send", ids: withDrafts.map((review) => review.review_id), sent: withDrafts })}
          >
            {busyKind === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            Send {withDrafts.length} {withDrafts.length === 1 ? "draft" : "drafts"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(EMPTY_SELECTION)}>
            <X aria-hidden /> Clear
          </Button>
          {chosen.length > MAX_AI_BATCH ? <span className="text-xs text-muted-foreground">AI works on {MAX_AI_BATCH} reviews at a time.</span> : null}
          {!ai.canRun && ai.reason ? <span className="text-xs text-muted-foreground">{ai.reason}</span> : null}
          {/* The account's reason is AI's too (shown above); the authorization is about sending only. */}
          {!accountBlocked && sendBlockedReason && withDrafts.length > 0 ? <span className="text-xs text-muted-foreground">{sendBlockedReason}</span> : null}
        </div>
      ) : null}

      {resultsPanel}
      {pinnedCard}

      <ul ref={listRef} className="space-y-3" onFocus={trackFocus} onBlur={forgetFocus}>
        {reviews.map((review, index) => (
          <li key={review.review_id} data-review-id={review.review_id} tabIndex={-1} className={CARD_SLOT}>
            <ReviewCard
              locationId={locationId}
              review={review}
              ai={ai}
              now={now}
              hideNeedsReply={unansweredOnly}
              selectable={selectable}
              selected={selected.has(review.review_id)}
              onSelect={(checked) => toggle(review.review_id, checked)}
              onHold={(latest) => holdCard(scope, review.review_id, index, latest)}
            />
          </li>
        ))}
      </ul>

      {total > REVIEWS_PAGE_SIZE ? (
        <TablePagination
          className="rounded-xl border border-border shadow-card"
          page={page}
          pageCount={pageCount}
          totalItems={total}
          pageSize={REVIEWS_PAGE_SIZE}
          onPageChange={goToPage}
          itemLabel="reviews"
        />
      ) : null}
      {list.data.attribution?.text ? <p className="px-1 text-xs text-muted-foreground">Reviews from {list.data.attribution.text}</p> : null}
    </div>
  );
}
