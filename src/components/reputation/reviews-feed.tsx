import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { analyzeReviews, generateReplyDrafts, sendReplies, type ReviewsQuery } from "@/api";
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
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { reviewsKey, useReviewsList } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { ReviewCard } from "./review-card";

export const REVIEWS_PAGE_SIZE = 20;

/** Reviews per AI request (`POST reviews/drafts` and `/analyze` take 1–20 ids). */
const MAX_AI_BATCH = 20;

type BulkKind = "drafts" | "analyze" | "send";

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

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
  className?: string;
};

/**
 * A page of review cards with bulk actions: tick reviews to draft replies with AI, analyze them or
 * send their drafts (each AI button shows its real price), and page through the rest. The order and
 * the filters come from the page (server-side, newest first by default).
 */
export function ReviewsFeed({ locationId, ai, query, page, onPageChange, empty, caption, unansweredOnly = false, className }: ReviewsFeedProps) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  const canEdit = useCanEdit();
  const now = useNow(60_000);
  const topRef = useRef<HTMLDivElement>(null);
  const list = useReviewsList(locationId, { ...query, page, limit: REVIEWS_PAGE_SIZE });

  // The selection belongs to one page of one filter: a new filter or page starts empty (no effect needed).
  const scope = JSON.stringify([query, page]);
  const [selection, setSelection] = useState<{ scope: string; ids: ReadonlySet<string> }>({ scope, ids: EMPTY_SELECTION });
  const selected = selection.scope === scope ? selection.ids : EMPTY_SELECTION;
  const setSelected = (ids: ReadonlySet<string>) => setSelection({ scope, ids });

  const reviews = list.data?.reviews ?? [];
  const chosen = reviews.filter((review) => selected.has(review.review_id));
  const eligible = chosen.filter((review) => review.ai_reply_eligible).slice(0, MAX_AI_BATCH);
  const analysable = chosen.filter((review) => review.comment?.trim()).slice(0, MAX_AI_BATCH);
  const withDrafts = chosen.filter((review) => review.draft && review.reply_state !== "sent");
  const draftCost = estimateReplyDraftCost(eligible, ai.costs.reply_drafts_per_10);
  const analysisCost = estimateAnalysisCost(analysable, ai.costs.analysis_per_10);
  const balance = ai.balance === undefined ? {} : { balance: ai.balance };
  // A read-only or suspended account: sending is refused too (`POST reviews/send` needs billing).
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";

  const bulk = useMutation({
    mutationFn: async ({ kind, ids }: { kind: BulkKind; ids: string[] }): Promise<{ title: string; description?: string }> => {
      if (kind === "drafts") {
        const result = await generateReplyDrafts(locationId, ids);
        const parts = [result.reused ? `${result.reused} reused` : "", result.skipped.length ? `${result.skipped.length} skipped` : ""].filter(Boolean);
        return {
          title: `${result.generated} ${result.generated === 1 ? "reply" : "replies"} drafted${parts.length ? ` (${parts.join(", ")})` : ""}`,
          description: `Check them before sending. ${formatTokenCount(result.tokens_spent)} used.`,
        };
      }
      if (kind === "analyze") {
        const result = await analyzeReviews(locationId, ids);
        return {
          title: `${result.analyzed} ${result.analyzed === 1 ? "review" : "reviews"} analyzed`,
          description: `${result.reused ? `${result.reused} already had a current analysis. ` : ""}${formatTokenCount(result.tokens_spent)} used.`,
        };
      }
      const result = await sendReplies(locationId, ids);
      return {
        title: `${result.sent} ${result.sent === 1 ? "reply" : "replies"} published on Google`,
        ...(result.failed ? { description: `${result.failed} couldn't be sent. They're marked "Not sent".` } : {}),
      };
    },
    onSuccess: (message, { kind }) => {
      if (kind !== "send") noteAiSuccess();
      toast.success(message.title, message.description ? { description: message.description } : undefined);
      setSelected(EMPTY_SELECTION);
    },
    onError: (err, { kind }) => {
      if (kind === "send") toast.error(reviewErrorMessage(err, "The replies couldn't be sent.").message);
      else toastAiError(err, { fallback: kind === "drafts" ? "The replies couldn't be drafted" : "The reviews couldn't be analyzed" });
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
  if (list.data.total === 0) return <div className={className}>{empty}</div>;

  const total = list.data.total;
  const pageCount = Math.max(1, Math.ceil(total / REVIEWS_PAGE_SIZE));
  const allOnPage = reviews.length > 0 && chosen.length === reviews.length;
  const busy = bulk.isPending;
  const busyKind = bulk.isPending ? bulk.variables?.kind : null;

  return (
    <div ref={topRef} className={cn("min-w-0 scroll-mt-20 space-y-3", className)} aria-busy={list.isPlaceholderData || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-sm text-muted-foreground">
        {canEdit ? (
          <label className="-my-1.5 flex min-h-9 cursor-pointer items-center gap-2.5">
            <Checkbox
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

      {chosen.length > 0 && canEdit ? (
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
            disabled={busy || withDrafts.length === 0 || accountBlocked}
            title={accountBlocked ? (ai.blockedBy === "suspended" ? "This account is suspended." : "Sending replies needs an active subscription.") : undefined}
            onClick={() => bulk.mutate({ kind: "send", ids: withDrafts.map((review) => review.review_id) })}
          >
            {busyKind === "send" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            Send {withDrafts.length} {withDrafts.length === 1 ? "draft" : "drafts"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(EMPTY_SELECTION)}>
            <X aria-hidden /> Clear
          </Button>
          {chosen.length > MAX_AI_BATCH ? <span className="text-xs text-muted-foreground">AI works on {MAX_AI_BATCH} reviews at a time.</span> : null}
          {!ai.canRun && ai.reason ? <span className="text-xs text-muted-foreground">{ai.reason}</span> : null}
        </div>
      ) : null}

      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.review_id}>
            <ReviewCard
              locationId={locationId}
              review={review}
              ai={ai}
              now={now}
              hideNeedsReply={unansweredOnly}
              selectable
              selected={selected.has(review.review_id)}
              onSelect={(checked) => toggle(review.review_id, checked)}
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
