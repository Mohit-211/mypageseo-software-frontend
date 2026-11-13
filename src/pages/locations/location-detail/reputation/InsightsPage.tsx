import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb, LoaderCircle, MessageSquareText, Sparkles } from "lucide-react";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { ReviewInsightsView } from "@/components/reputation/review-insights";
import { ReviewsGateState } from "@/components/reputation/review-gates";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useAiStatus } from "@/lib/ai/ai-status";
import { formatDate } from "@/lib/datetime";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useGenerateInsights } from "@/lib/reviews/review-actions";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { reviewsGate } from "@/lib/reviews/review-metrics";
import { isNoInsights, useReviewInsights, useReviewsSummary } from "@/lib/reviews/use-reviews";

/** Below this many reviews there is too little for a useful summary. */
const MIN_REVIEWS = 3;

/**
 * Review insights (`/locations/:locationId/reputation/insights`): what customers talk about, praise
 * and complain about, summarised by AI from recent reviews. Generated only when someone asks (it
 * costs tokens) and kept until it's updated.
 */
function InsightsPage() {
  const { location } = useLocationRoute();
  const locationId = location.location_id;
  const canEdit = useCanEdit();
  const summary = useReviewsSummary(locationId);
  const gate = summary.data ? reviewsGate(summary.data) : null;
  // Insights exist only for reviews we can read; a location without Google would only answer 404.
  const insights = useReviewInsights(locationId, summary.isSuccess && !gate);
  const ai = useAiStatus(locationId);
  const generate = useGenerateInsights(locationId);

  const stats = summary.data?.stats ?? null;
  const data = insights.data;
  const none = insights.isError && isNoInsights(insights.error);
  const tooFew = stats !== null && stats.total < MIN_REVIEWS;

  const generateButton =
    canEdit && !gate && !tooFew ? (
      <Button
        variant="ai"
        aria-busy={generate.isPending || undefined}
        disabled={generate.isPending || !ai.canRun}
        title={!ai.canRun ? ai.reason : undefined}
        onClick={() => generate.mutate()}
      >
        {generate.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {generate.isPending ? "Reading your reviews…" : data ? "Update insights" : "Generate insights"}
        {generate.isPending ? null : <AiCostChip tokens={ai.costs.insights} variant="inverse" />}
      </Button>
    ) : null;

  const header = (
    <PageHeader
      icon={Lightbulb}
      tone="reputation"
      title="Review insights"
      description="What customers praise and complain about, summarised by AI from your recent reviews."
      meta={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <AiBadge label="Summarised by AI" variant="soft" />
          {data ? <span>Updated {formatDate(data.generated_at)}</span> : null}
        </div>
      }
      actions={
        <>
          <Button asChild variant="outline">
            <Link to={locationPath(locationId, "reputation")}>
              <MessageSquareText aria-hidden /> All reviews
            </Link>
          </Button>
          {generateButton}
        </>
      }
    />
  );

  let body;
  if (summary.isPending || (summary.isSuccess && !gate && insights.isPending)) {
    body = (
      <div className="space-y-6">
        <SectionSkeleton lines={2} />
        <SectionSkeleton lines={5} />
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionSkeleton lines={3} />
          <SectionSkeleton lines={3} />
        </div>
      </div>
    );
  } else if (summary.isError) {
    body = (
      <ErrorState
        title="Reviews couldn't be loaded"
        description={reviewErrorMessage(summary.error, "Something went wrong while loading the reviews.").message}
        onRetry={() => void summary.refetch()}
      />
    );
  } else if (gate) {
    body = <ReviewsGateState gate={gate} />;
  } else if (data) {
    body = <ReviewInsightsView insights={data} stats={stats} />;
  } else if (none || (insights.isError && tooFew)) {
    body = tooFew ? (
      <EmptyState
        icon={MessageSquareText}
        tone="reputation"
        title="A few more reviews first"
        description={`Insights need at least ${MIN_REVIEWS} reviews to find patterns. Once more customers have left one, AI can sum up what they say.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={locationPath(locationId, "reputation")}>
              See your reviews <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Sparkles}
        tone="ai"
        title="See what customers say"
        description={
          <>
            AI reads your most recent reviews (up to 60) and sums up the themes, what customers praise and what they complain about. The summary is
            saved here until you update it{canEdit ? `, and costs ${ai.costs.insights === 1 ? "1 token" : `${ai.costs.insights} tokens`}` : ""}.
            {canEdit && !ai.canRun && ai.reason ? <span className="mt-2 block">{ai.reason}</span> : null}
          </>
        }
        action={generateButton ?? undefined}
      />
    );
  } else {
    body = (
      <ErrorState
        title="Insights couldn't be loaded"
        description={reviewErrorMessage(insights.error, "Something went wrong while loading the insights.").message}
        onRetry={() => void insights.refetch()}
      />
    );
  }

  return (
    <>
      {header}
      {!gate ? <AiStatusBanner status={ai} /> : null}
      {body}
    </>
  );
}

export default InsightsPage;
