import { useRef } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Hourglass, MessageSquareHeart, MessageSquareText, PenLine, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { BackgroundActivity } from "@/components/location/background-activity";
import { BulkReplies } from "@/components/reputation/bulk-replies";
import { ReplyAuthorizationBanner, ReplyAuthorizationStatus } from "@/components/reputation/reply-authorization";
import { ReviewInsightsCard } from "@/components/reputation/review-insights";
import { ReviewKpis } from "@/components/reputation/review-kpis";
import { ReviewsGateState } from "@/components/reputation/review-gates";
import { RefreshReviewsButton, ReviewsSyncMeta } from "@/components/reputation/review-sync";
import { REVIEWS_PAGE_SIZE, ReviewsFeed } from "@/components/reputation/reviews-feed";
import { ReviewsToolbar } from "@/components/reputation/reviews-toolbar";
import { ReportButton } from "@/components/report/rank-report-button";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus } from "@/lib/ai/ai-status";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import {
  SORT_LABEL,
  hasReviewFilters,
  noReviewFilters,
  reviewFiltersQuery,
  useReviewFilters,
  useReviewSpotlight,
  type ReviewFilters,
} from "@/lib/reviews/review-filters";
import { reviewsGate } from "@/lib/reviews/review-metrics";
import { focusReviewCard } from "@/lib/reviews/review-spotlight";
import { useDebounced } from "@/lib/reviews/use-debounced";
import { useReviewCount, useReviewsList, useReviewsSummary } from "@/lib/reviews/use-reviews";

/** `GET reviews` for the reviews deleted on Google (Phase 25a), to count them for their view. */
const DELETED_QUERY = { deleted_on_google: true } as const;

/**
 * Reviews (`/locations/:locationId/reputation`): read and answer Google reviews. Key numbers on top,
 * "Draft all" with AI, then the reviews (newest first) with quick views and filters kept in the
 * address, and what customers say on the side. Answering with AI has its own page (AI Review
 * Replies), one click away in the header. Agency accounts without the client's reply authorization
 * see how to get it first (Phase 25a).
 */
function ReviewsPage() {
  const { location } = useLocationRoute();
  const locationId = location.location_id;
  const canEdit = useCanEdit();
  const summary = useReviewsSummary(locationId);
  const ai = useAiStatus(locationId);
  const [filters, setFilters] = useReviewFilters();
  const [spotlight, setSpotlight] = useReviewSpotlight();
  const search = useDebounced(filters.q.trim());
  const listRef = useRef<HTMLDivElement>(null);

  const data = summary.data;
  const gate = data ? reviewsGate(data) : null;
  const stats = data?.stats ?? null;
  const ready = Boolean(data && !gate);
  const listQuery = reviewFiltersQuery(filters, search);
  // The list the feed shows (one request, shared through the cache), so the open quick view's count matches it.
  const openList = useReviewsList(locationId, { ...listQuery, page: filters.page, limit: REVIEWS_PAGE_SIZE }, Boolean(ready && stats && stats.total > 0));
  const deleted = useReviewCount(locationId, DELETED_QUERY, Boolean(ready && stats && stats.total > 0));

  const showList = (patch: Partial<ReviewFilters>) => {
    setFilters(patch);
    listRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  /** "Open it" on a review a send held back: its card when it's on the page, else pinned above the list. */
  const openReview = (reviewId: string) => {
    if (!focusReviewCard(reviewId)) setSpotlight(reviewId);
  };

  const authorizationNames = { locationId, locationName: location.name, clientName: location.client?.name ?? null };

  const header = (
    <PageHeader
      icon={MessageSquareHeart}
      tone="reputation"
      title="Reviews"
      description="Read and answer your Google reviews, and spot the ones that need attention."
      meta={
        data && ready ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ReviewsSyncMeta summary={data} />
            <ReplyAuthorizationStatus {...authorizationNames} />
          </div>
        ) : undefined
      }
      actions={
        data && ready ? (
          <>
            <RefreshReviewsButton locationId={locationId} summary={data} />
            {stats && stats.total > 0 ? (
              // Outline: "Reply with AI" is this page's one filled action.
              <ReportButton
                locationId={locationId}
                type="reputation"
                variant="outline"
                subtitle="Review summary, star distribution, reviews needing attention, replies sent and insights, as a PDF."
              />
            ) : null}
            {canEdit ? (
              // Phones: the primary action comes first, not on a row of its own below the others (as on Posts).
              <Button asChild variant="ai" className="max-sm:order-first">
                <Link to={locationPath(locationId, "ai/replies")}>
                  <Sparkles aria-hidden /> Reply with AI
                </Link>
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    />
  );

  if (summary.isPending) {
    return (
      <>
        {header}
        <PageSkeleton header={false} metrics={4} rows={4} />
      </>
    );
  }
  if (summary.isError) {
    return (
      <>
        {header}
        <ErrorState
          title="Reviews couldn't be loaded"
          description={reviewErrorMessage(summary.error, "Something went wrong while loading the reviews.").message}
          onRetry={() => void summary.refetch()}
        />
      </>
    );
  }
  if (gate) {
    return (
      <>
        {header}
        <ReviewsGateState gate={gate} />
      </>
    );
  }
  if (!stats || stats.total === 0) {
    return (
      <>
        {header}
        <ReplyAuthorizationBanner {...authorizationNames} />
        <BackgroundActivity locationId={locationId} />
        <EmptyState
          icon={MessageSquareText}
          tone="reputation"
          title="No reviews yet"
          description="Your Google reviews appear here after the next check with Google. When customers leave one, you can answer it here, or let AI draft the reply."
          action={<RefreshReviewsButton locationId={locationId} summary={summary.data} />}
        />
      </>
    );
  }

  const filtered = hasReviewFilters(filters);
  const clear = () => setFilters(noReviewFilters());

  return (
    <>
      {header}
      <ReplyAuthorizationBanner {...authorizationNames} />
      <BackgroundActivity locationId={locationId} />
      <ReviewKpis locationId={locationId} stats={stats} onShowNeedsReply={() => showList({ reply: "needs", flag: null, deleted: false })} />
      {/* Keyed: a "Continue (N left)", send results or an open dialog belong to one location. */}
      <BulkReplies
        key={locationId}
        locationId={locationId}
        summary={summary.data}
        ai={ai}
        variant="bar"
        onShowDrafts={() => showList({ reply: "draft", flag: null, deleted: false })}
        onOpenReview={openReview}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section ref={listRef} aria-label="Reviews" className="min-w-0 scroll-mt-20 space-y-4">
          <ReviewsToolbar
            stats={stats}
            filters={filters}
            onChange={setFilters}
            deletedCount={deleted.data}
            {...(openList.data && !openList.isPlaceholderData ? { openTotal: openList.data.total } : {})}
          />
          <ReviewsFeed
            locationId={locationId}
            ai={ai}
            query={listQuery}
            page={filters.page}
            onPageChange={(page) => setFilters({ page })}
            caption={SORT_LABEL[filters.sort]}
            unansweredOnly={filters.reply === "needs" || filters.reply === "none"}
            readOnly={filters.deleted}
            spotlight={spotlight}
            onSpotlightChange={setSpotlight}
            empty={<FilteredEmpty filters={filters} filtered={filtered} onClear={clear} locationId={locationId} canEdit={canEdit} />}
          />
        </section>
        <aside aria-label="What customers say" className="min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start">
          <ReviewInsightsCard locationId={locationId} ai={ai} summary={summary.data} />
        </aside>
      </div>
    </>
  );
}

/** What to say when a view or filter matches nothing: celebrate the empty to-do views, offer a way out of the rest. */
function FilteredEmpty({
  filters,
  filtered,
  onClear,
  locationId,
  canEdit,
}: {
  filters: ReviewFilters;
  filtered: boolean;
  onClear: () => void;
  locationId: string;
  canEdit: boolean;
}) {
  const onlyView = filters.ratings.length === 0 && !filters.q.trim();
  const clearButton = (
    <Button variant="outline" size="sm" onClick={onClear}>
      <X aria-hidden /> Show all reviews
    </Button>
  );
  if (onlyView && filters.deleted && !filters.reply && !filters.flag) {
    return (
      <EmptyState
        icon={Trash2}
        tone="reputation"
        title="No reviews deleted on Google"
        description="When a reviewer or Google removes a review, it shows up here to read. It's left out of your numbers and lists."
        action={clearButton}
      />
    );
  }
  if (onlyView && !filters.deleted && filters.reply === "pending" && !filters.flag) {
    return (
      <EmptyState
        variant="all-done"
        icon={Hourglass}
        title="Nothing waiting for Google"
        description="Google has finished reviewing every reply you sent. New replies wait here for a few minutes, sometimes a day, before they show."
        action={clearButton}
      />
    );
  }
  if (onlyView && !filters.deleted && filters.reply === "rejected" && !filters.flag) {
    return (
      <EmptyState
        variant="all-done"
        title="No rejected replies"
        description="Google published every reply you sent, or a new draft is waiting for the ones it rejected."
        action={clearButton}
      />
    );
  }
  if (filters.deleted) {
    return (
      <EmptyState
        variant="no-results"
        title="No deleted reviews match"
        description={filtered ? "Try fewer filters or other words." : "There are no reviews to show here."}
        action={clearButton}
      />
    );
  }
  if (onlyView && filters.reply === "needs" && !filters.flag) {
    return <EmptyState variant="all-done" title="All caught up" description="Every review has a reply on Google. New reviews show up here after the next check." action={clearButton} />;
  }
  if (onlyView && filters.reply === "draft" && !filters.flag) {
    return (
      <EmptyState
        icon={PenLine}
        tone="reputation"
        title="No drafts waiting"
        description="Drafts appear here when you save a reply without sending it, or when AI drafts replies for you."
        action={
          canEdit ? (
            <Button asChild size="sm" variant="ai">
              <Link to={locationPath(locationId, "ai/replies")}>
                <Sparkles aria-hidden /> Draft replies with AI
              </Link>
            </Button>
          ) : undefined
        }
        secondaryAction={clearButton}
      />
    );
  }
  if (onlyView && !filters.reply && (filters.flag === "attention" || filters.flag === "suspicious")) {
    return (
      <EmptyState
        variant="all-done"
        icon={filters.flag === "suspicious" ? ShieldCheck : CheckCircle2}
        title={filters.flag === "suspicious" ? "No suspicious reviews" : "Nothing needs attention"}
        description={filters.flag === "suspicious" ? "None of your reviews show signs of breaking Google's rules." : "None of your reviews were marked for a closer look."}
        action={clearButton}
      />
    );
  }
  return (
    <EmptyState
      variant="no-results"
      title="No reviews match"
      description={filtered ? "Try fewer filters or other words." : "There are no reviews to show here."}
      action={filtered ? clearButton : undefined}
    />
  );
}

export default ReviewsPage;
