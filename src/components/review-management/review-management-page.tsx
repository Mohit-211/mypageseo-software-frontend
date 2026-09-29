import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PartialDataNotice } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  describeRange,
  rangeBounds,
  reviewActions,
  reviewInsights,
  reviewsInBounds,
  summarizeReviews,
  topicStats,
  trendBuckets,
  useReviewManagement,
  type DateRangeValue,
  type Review,
  type ReviewTopic,
} from "@/lib/reviews/review-management";
import { AIReplySuggestion, type ReplyMode } from "./ai-reply-suggestion";
import { AIReviewAnalysis, AIReviewAnalysisSkeleton } from "./ai-analysis/ai-review-analysis";
import { ReviewTopics, ReviewTopicsSkeleton } from "./ai-analysis/review-topics";
import { SentimentBreakdown, SentimentBreakdownSkeleton } from "./ai-analysis/sentiment-breakdown";
import { NoReviewsEmpty } from "./empty-states";
import { REVIEW_AUTOMATION_PATH } from "./paths";
import { RatingOverview, RatingOverviewSkeleton } from "./rating-overview";
import { ProfileSelect, ReviewHeader, SyncButton, SyncStatus } from "./review-header";
import { ReviewDetails } from "./review-details";
import { DEFAULT_REVIEW_FILTERS, type ReviewFilterState } from "./review-list/review-filter-model";
import { REVIEW_LIST_ID, ReviewList, ReviewListSkeleton } from "./review-list/review-list";
import type { ReviewRowHandlers } from "./review-list/review-row-model";
import { ReviewSummaryCards, ReviewSummaryCardsSkeleton } from "./review-summary-cards";
import { ReviewTrends, ReviewTrendsSkeleton } from "./review-trends";
import { useReviewProfiles } from "./use-review-profiles";

function scrollToReviews() {
  // Wait a frame so the filtered rows render before scrolling.
  requestAnimationFrame(() => document.getElementById(REVIEW_LIST_ID)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

const rangeKey = (range: DateRangeValue) => `${range.preset}:${range.from ?? ""}:${range.to ?? ""}`;

type Composer = { reviewId: string; mode: ReplyMode; key: number };

/** Review Management: sync → summary → AI analysis → sentiment/topics/trends → review list → reply. */
export function ReviewManagementPage() {
  const { ready, locations, locationId, setLocationId } = useReviewProfiles();
  const { dataset, syncing, analyzing } = useReviewManagement(locationId);
  const [range, setRange] = useState<DateRangeValue>({ preset: "30d" });
  const [filters, setFilters] = useState<ReviewFilterState>(DEFAULT_REVIEW_FILTERS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  // Short-lived confirmations shown after a sync or analysis finishes.
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [analyzedCount, setAnalyzedCount] = useState<number | null>(null);

  const bounds = useMemo(() => rangeBounds(range), [range]);
  const reviews = useMemo(() => dataset?.reviews ?? [], [dataset]);
  const inRange = useMemo(() => reviewsInBounds(reviews, bounds), [reviews, bounds]);
  const summary = useMemo(() => (dataset ? summarizeReviews(dataset, bounds) : null), [dataset, bounds]);
  const topics = useMemo(() => topicStats(inRange), [inRange]);
  const buckets = useMemo(() => trendBuckets(reviews, bounds), [reviews, bounds]);
  const insights = useMemo(() => (summary ? reviewInsights(inRange, summary, topics) : []), [inRange, summary, topics]);

  const detailReview = detailId ? (reviews.find((r) => r.id === detailId) ?? null) : null;
  const composerReview = composer ? (reviews.find((r) => r.id === composer.reviewId) ?? null) : null;
  const analyzed = Boolean(dataset?.analyzedAt);

  const changeProfile = (id: string) => {
    setLocationId(id);
    setFilters(DEFAULT_REVIEW_FILTERS);
    setDetailId(null);
    setSyncedCount(null);
    setAnalyzedCount(null);
  };

  const sync = async () => {
    if (!locationId || syncing) return;
    setSyncedCount(null);
    const { total, added } = await reviewActions.syncReviews(locationId);
    setSyncedCount(total);
    toast.success("Reviews synced successfully.", {
      description: added ? `${added} new review${added === 1 ? "" : "s"} added.` : "No new reviews since the last sync.",
    });
  };

  const analyze = async () => {
    if (!locationId || analyzing) return;
    setAnalyzedCount(null);
    const count = await reviewActions.analyzeReviews(locationId);
    setAnalyzedCount(count);
    toast.success("Analysis complete", { description: `Sentiment and topics were updated for ${count.toLocaleString()} reviews.` });
  };

  const showReviews = (next: Partial<ReviewFilterState>) => {
    setFilters({ ...DEFAULT_REVIEW_FILTERS, ...next });
    scrollToReviews();
  };

  const openComposer = (review: Review, mode: ReplyMode) => setComposer((c) => ({ reviewId: review.id, mode, key: (c?.key ?? 0) + 1 }));

  const handlers: ReviewRowHandlers = {
    onView: (review) => setDetailId(review.id),
    onGenerateReply: (review) => openComposer(review, "ai"),
    onWriteReply: (review) => openComposer(review, "manual"),
    onMarkResponded: (review) => {
      reviewActions.markResponded(review.id);
      toast.success("Marked as responded", { description: `The review from ${review.customerName} no longer needs a response.` });
    },
  };

  const header = (
    <ReviewHeader
      profileSelect={locationId ? <ProfileSelect locations={locations} locationId={locationId} onChange={changeProfile} /> : null}
      range={range}
      onRangeChange={setRange}
      syncStatus={dataset ? <SyncStatus lastSyncedAt={dataset.lastSyncedAt} syncing={syncing} syncedCount={syncedCount} onSync={() => void sync()} /> : null}
      actions={
        <>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link to={REVIEW_AUTOMATION_PATH}>
              <Settings2 aria-hidden /> Automation
            </Link>
          </Button>
          <SyncButton syncing={syncing} onSync={() => void sync()} disabled={!dataset} />
        </>
      }
    />
  );

  if (ready && !locationId) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState title="No Google Business Profiles yet" description="Add a location with a connected Google Business Profile to manage its reviews." />
      </div>
    );
  }

  if (!dataset || !summary) {
    return (
      <div className="space-y-6">
        {header}
        <div role="status" aria-live="polite" aria-label="Loading reviews" className="space-y-6">
          <ReviewSummaryCardsSkeleton />
          <RatingOverviewSkeleton />
          <AIReviewAnalysisSkeleton />
          <div className="grid gap-6 lg:grid-cols-2">
            <SentimentBreakdownSkeleton />
            <ReviewTopicsSkeleton />
          </div>
          <ReviewTrendsSkeleton />
          <ReviewListSkeleton />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {header}

        <PartialDataNotice description="Google Business Profile reviews aren't connected yet. Reviews, AI analysis and replies on this page are sample data for preview." />

        {reviews.length === 0 ? (
          <NoReviewsEmpty onSync={() => void sync()} syncing={syncing} />
        ) : (
          <>
            <ReviewSummaryCards summary={summary} rangeLabel={describeRange(range)} />

            <RatingOverview reviews={reviews} averageRating={summary.averageRating} onSelectRating={(rating) => showReviews({ rating: String(rating) as ReviewFilterState["rating"] })} />

            <AIReviewAnalysis
              analyzedAt={dataset.analyzedAt}
              analyzing={analyzing}
              lastAnalyzedCount={analyzedCount}
              summary={summary}
              topics={topics}
              buckets={buckets}
              insights={insights}
              onAnalyze={() => void analyze()}
              onSelectTopic={(topic: ReviewTopic) => showReviews({ topic })}
            />

            {analyzed && !analyzing ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <SentimentBreakdown key={rangeKey(range)} reviews={reviews} initialRange={range} />
                <ReviewTopics topics={topics} onViewReviews={(topic) => showReviews({ topic })} />
              </div>
            ) : null}

            <ReviewTrends key={rangeKey(range)} reviews={reviews} initialRange={range} analyzed={analyzed} />

            <ReviewList reviews={reviews} analyzed={analyzed} filters={filters} onFiltersChange={setFilters} handlers={handlers} />
          </>
        )}

        <ReviewDetails
          review={detailReview}
          onClose={() => setDetailId(null)}
          onGenerateReply={handlers.onGenerateReply}
          onWriteReply={handlers.onWriteReply}
          onMarkResponded={handlers.onMarkResponded}
        />

        {composer && composerReview ? (
          <AIReplySuggestion
            key={composer.key}
            review={composerReview}
            mode={composer.mode}
            settings={dataset.automation.settings}
            onClose={() => setComposer(null)}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
