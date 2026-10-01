import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { generateReviewInsights, isApiError } from "@/api";
import { PageHeader, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { reviewsKey, useReviewInsights, useReviewsSummary } from "@/lib/reviews/use-reviews";
import { formatRunDate } from "@/lib/rankings/format";

const SENTIMENT_TONE: Record<string, "success" | "critical" | "warning" | "neutral"> = {
  positive: "success",
  negative: "critical",
  mixed: "warning",
};

/** AI insights over the location's reviews: themes, praise, complaints. Generated on request only. */
function InsightsPage() {
  const { location } = useGbpContext();
  const locationId = location.location_id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const summary = useReviewsSummary(locationId);
  const insights = useReviewInsights(locationId);
  const [generating, setGenerating] = useState(false);
  const ai = summary.data?.ai;
  const cost = ai?.token_costs.insights;

  const generate = async () => {
    setGenerating(true);
    try {
      await generateReviewInsights(locationId);
      toast.success("Insights updated.");
    } catch (err) {
      const { message, buyTokens } = reviewErrorMessage(err, "Insights couldn't be generated.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setGenerating(false);
      void queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ["billing", "tokens"] });
    }
  };

  const noInsights = isApiError(insights.error) && (insights.error.reason === "no_insights" || insights.error.status === 404);
  const generateButton =
    ai?.configured ? (
      <Button size="sm" disabled={generating || ai.paused_today} onClick={() => void generate()}>
        {generating ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {insights.data ? "Update insights" : "Generate insights"}{cost != null ? ` (${cost} token${cost === 1 ? "" : "s"})` : ""}
      </Button>
    ) : null;

  return (
    <>
      <PageHeader
        title="Review insights"
        description="What customers talk about most, what they praise and what they complain about, summarised by AI from recent reviews."
        meta={insights.data ? <p className="text-xs text-muted-foreground">Made {formatRunDate(insights.data.generated_at, true)} from {insights.data.basis.reviews_sent} of {insights.data.basis.reviews_total} reviews</p> : undefined}
        actions={generateButton}
      />
      {insights.isPending ? (
        <PageSkeleton />
      ) : noInsights ? (
        <EmptyState
          icon={Sparkles}
          title="No insights yet"
          description={ai?.configured ? "Generate them to see the themes in this location's reviews." : "AI isn't set up on the server yet."}
          action={generateButton ?? undefined}
        />
      ) : insights.isError ? (
        <ErrorState description={reviewErrorMessage(insights.error, "Insights couldn't be loaded.").message} onRetry={() => void insights.refetch()} />
      ) : (
        <div className="space-y-6">
          <Panel title="Themes" description="Topics customers mention, with how often and how they feel about them.">
            {insights.data.insight.themes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clear themes yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {[...insights.data.insight.themes].sort((a, b) => b.mentions - a.mentions).map((theme) => (
                  <li key={theme.theme} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
                    <span className="font-medium capitalize text-foreground">{theme.theme}</span>
                    <span className="tabular text-muted-foreground">{theme.mentions}×</span>
                    <StatusBadge tone={SENTIMENT_TONE[theme.sentiment] ?? "neutral"}>{theme.sentiment}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="grid gap-6 lg:grid-cols-2">
            <ListPanel title="What customers praise" icon={<ThumbsUp aria-hidden className="size-4 text-success" />} items={insights.data.insight.praise} />
            <ListPanel title="What customers complain about" icon={<ThumbsDown aria-hidden className="size-4 text-critical" />} items={insights.data.insight.complaints} />
          </div>
          <ListPanel title="Observations" icon={<Sparkles aria-hidden className="size-4 text-brand-soft" />} items={insights.data.insight.observations} />
        </div>
      )}
    </>
  );
}

function ListPanel({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing stands out.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">{icon}<span>{item}</span></li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default InsightsPage;
