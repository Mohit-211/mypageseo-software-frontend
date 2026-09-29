import type { ReactNode } from "react";
import { MessageSquareText, MessageSquareWarning, Star, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { ChangeIndicator, InfoTooltip } from "@/components/ai-visibility/visibility-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSigned, type ReviewSummary } from "@/lib/reviews/review-management";
import { cn } from "@/lib/utils";

type SummaryCard = {
  label: string;
  value: ReactNode;
  trend: ReactNode;
  caption: string;
  tooltip: string;
  icon: LucideIcon;
  iconClassName: string;
};

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

export function ReviewSummaryCards({ summary, rangeLabel }: { summary: ReviewSummary; rangeLabel: string }) {
  const { sentiment } = summary;
  const period = rangeLabel.toLowerCase();
  const cards: SummaryCard[] = [
    {
      label: "Total Reviews",
      value: summary.total.toLocaleString(),
      trend: null,
      caption: `${formatSigned(summary.newInRange)} in the ${period}`,
      tooltip: "All Google reviews synced for this profile. The caption counts reviews received in the selected period.",
      icon: MessageSquareText,
      iconClassName: "bg-brand-tint text-primary",
    },
    {
      label: "Average Rating",
      value: summary.averageRating === null ? "—" : (
        <span className="inline-flex items-center gap-1">
          {summary.averageRating.toFixed(1)}
          <Star className="size-4 fill-warning text-warning" aria-label="stars" />
        </span>
      ),
      trend: summary.ratingChange === null ? null : <ChangeIndicator value={summary.ratingChange} suffix="" />,
      caption: summary.ratingChange === null ? "Across all reviews" : "Change since the start of the period",
      tooltip: "The average star rating across every synced review.",
      icon: Star,
      iconClassName: "bg-warning-surface text-warning-foreground",
    },
    {
      label: "Positive Reviews",
      value: sentiment ? `${sentiment.positive}%` : "—",
      trend: summary.positiveChange === null ? null : <ChangeIndicator value={summary.positiveChange} suffix=" pts" />,
      caption: sentiment ? `Of ${sentiment.analyzed} analyzed reviews` : "Run AI analysis to measure",
      tooltip: "Share of analyzed reviews in the selected period that AI analysis classified as positive, compared with the previous period.",
      icon: ThumbsUp,
      iconClassName: "bg-success-surface text-success",
    },
    {
      label: "Negative Reviews",
      value: sentiment ? `${sentiment.negative}%` : "—",
      // Shown as a neutral measurement: no good/bad colouring on the change.
      trend: summary.negativeChange === null ? null : <span className="text-xs font-medium tabular text-muted-foreground">{formatSigned(summary.negativeChange, " pts")}</span>,
      caption: sentiment ? "vs previous period" : "Run AI analysis to measure",
      tooltip: "Share of analyzed reviews in the selected period that AI analysis classified as negative.",
      icon: ThumbsDown,
      iconClassName: "bg-critical-surface text-critical",
    },
    {
      label: "Needs Response",
      value: summary.awaitingReply.toLocaleString(),
      trend: null,
      caption:
        summary.awaitingReply === 0
          ? "All reviews have a reply"
          : `${summary.negativeAwaitingReply} negative · ${summary.draftsReady} draft${summary.draftsReady === 1 ? "" : "s"} ready`,
      tooltip: "Reviews without a published reply, including drafts awaiting approval and failed replies.",
      icon: MessageSquareWarning,
      iconClassName: "bg-info-surface text-info",
    },
  ];

  return (
    <div className={GRID}>
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <InfoTooltip label={card.label}>{card.tooltip}</InfoTooltip>
            </div>
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", card.iconClassName)}>
              <card.icon className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular text-foreground">{card.value}</p>
            {card.trend}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={card.caption}>
            {card.caption}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ReviewSummaryCardsSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="mt-1 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
