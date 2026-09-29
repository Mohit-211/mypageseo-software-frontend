import type { ReactNode } from "react";
import { Gauge, MessageSquareQuote, Scale, ListChecks, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { VisibilitySummary } from "@/lib/ai-visibility/ai-visibility";
import { cn } from "@/lib/utils";
import { formatSigned } from "@/lib/ai-visibility/ai-visibility";
import { ChangeIndicator, InfoTooltip } from "./visibility-ui";

type SummaryCard = {
  label: string;
  value: ReactNode;
  trend: ReactNode;
  caption: string;
  tooltip: string;
  icon: LucideIcon;
  iconClassName: string;
};

export function VisibilitySummaryCards({ summary, rangeLabel }: { summary: VisibilitySummary; rangeLabel: string }) {
  const cards: SummaryCard[] = [
    {
      label: "AI Visibility Score",
      value: (
        <>
          {summary.score}
          <span className="text-sm font-normal text-muted-foreground"> / 100</span>
        </>
      ),
      trend: <ChangeIndicator value={summary.scoreChange} />,
      caption: summary.scoreChange === null ? "No previous period to compare" : "vs previous period",
      tooltip:
        "A measurement from your tracked prompts: how often and how early your business appears in AI answers, averaged across platforms. It reflects tracked results only, not the quality of your business.",
      icon: Gauge,
      iconClassName: "bg-brand-tint text-primary",
    },
    {
      label: "AI Mentions",
      value: summary.mentions.toLocaleString(),
      trend: summary.mentionsDelta === null ? null : <ChangeIndicator value={summary.mentionsDelta} suffix="" />,
      caption: summary.mentionsDelta === null ? rangeLabel : `${formatSigned(summary.mentionsDelta)} vs previous period`,
      tooltip: "The number of tracked AI responses in this period that named your business.",
      icon: MessageSquareQuote,
      iconClassName: "bg-info-surface text-info",
    },
    {
      label: "Prompts Tracked",
      value: summary.promptsTracked.toLocaleString(),
      trend: null,
      caption: `Across ${summary.platformsTracked} AI platform${summary.platformsTracked === 1 ? "" : "s"}`,
      tooltip: "Questions you monitor. Each prompt is checked on every platform selected for it.",
      icon: ListChecks,
      iconClassName: "bg-success-surface text-success",
    },
    {
      label: "Competitor Gap",
      value: summary.competitorGap === null ? "—" : formatSigned(summary.competitorGap, " pts"),
      trend: null,
      caption: summary.competitorGap === null ? "Select competitors to compare" : "Compared with tracked competitors",
      tooltip:
        "Difference in percentage points between your visibility score and the average visibility of the competitors selected for comparison.",
      icon: Scale,
      iconClassName: "bg-warning-surface text-warning-foreground",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <p className="mt-1 truncate text-xs text-muted-foreground">{card.caption}</p>
        </div>
      ))}
    </div>
  );
}

export function VisibilitySummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="mt-1 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}
