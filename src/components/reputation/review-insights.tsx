import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Eye, Lightbulb, LoaderCircle, MessageSquareQuote, RotateCw, Sparkles, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import type { ReviewsInsights, ReviewsSummary } from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import type { AiStatus } from "@/lib/ai/ai-status";
import { formatDateTime, formatMonth, formatRelative } from "@/lib/datetime";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useGenerateInsights } from "@/lib/reviews/review-actions";
import { isNoInsights, useReviewInsights } from "@/lib/reviews/use-reviews";
import { byNumber, byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

type Stats = NonNullable<ReviewsSummary["stats"]>;
type Theme = ReviewsInsights["insight"]["themes"][number];

// Red is kept for real trouble: a negative theme is something to look at (amber), not an error.
const SENTIMENT: Record<string, { label: string; tone: StatusTone; bar: string }> = {
  positive: { label: "Positive", tone: "success", bar: "bg-success" },
  negative: { label: "Negative", tone: "warning", bar: "bg-warning" },
  mixed: { label: "Mixed", tone: "neutral", bar: "bg-muted-foreground" },
  neutral: { label: "Neutral", tone: "neutral", bar: "bg-muted-foreground" },
};

const sentimentOf = (value: string) => SENTIMENT[value.toLowerCase()] ?? { label: value, tone: "neutral" as const, bar: "bg-muted-foreground" };

/** Most mentioned first; ties A–Z. */
function sortThemes(themes: readonly Theme[]): Theme[] {
  return sortRows(
    themes,
    byNumber((theme) => theme.mentions, "desc"),
    byText((theme) => theme.theme),
  );
}

/** Reviews at 4–5 stars against 1–3 stars, as one split bar with the two counts. */
export function RatingMix({ stats, className }: { stats: Pick<Stats, "positive" | "negative">; className?: string }) {
  const rated = stats.positive + stats.negative;
  if (rated === 0) return null;
  const share = stats.positive / rated;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${stats.positive} reviews at 4 to 5 stars, ${stats.negative} at 1 to 3 stars`}>
        <span className="h-full bg-success" style={{ width: `${share * 100}%` }} />
        <span className="h-full bg-warning" style={{ width: `${(1 - share) * 100}%` }} />
      </div>
      <div aria-hidden className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          <span className="font-semibold tabular-nums text-foreground">{stats.positive.toLocaleString()}</span> at 4–5 stars
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warning" />
          <span className="font-semibold tabular-nums text-foreground">{stats.negative.toLocaleString()}</span> at 1–3 stars
        </span>
      </div>
    </div>
  );
}

function ThemeRow({ theme, max }: { theme: Theme; max: number }) {
  const look = sentimentOf(theme.sentiment);
  return (
    <li className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-medium capitalize text-foreground">{theme.theme}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {theme.mentions} {theme.mentions === 1 ? "mention" : "mentions"}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", look.bar)} style={{ width: `${max > 0 ? Math.max(4, (theme.mentions / max) * 100) : 0}%` }} />
        </div>
        <StatusBadge tone={look.tone} size="sm" className="shrink-0">
          {look.label}
        </StatusBadge>
      </div>
    </li>
  );
}

function ThemeList({ themes, limit, wide = false }: { themes: readonly Theme[]; limit?: number; wide?: boolean }) {
  const sorted = sortThemes(themes);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const max = sorted[0]?.mentions ?? 0;
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">No clear themes yet.</p>;
  return (
    // Wide: two columns on large screens, still read left to right, most mentioned first.
    <ul className={cn("grid gap-y-3.5", wide && "gap-x-10 lg:grid-cols-2")}>
      {shown.map((theme) => (
        <ThemeRow key={theme.theme} theme={theme} max={max} />
      ))}
    </ul>
  );
}

function PointList({ items, icon: Icon, iconClass, empty }: { items: readonly string[]; icon: LucideIcon; iconClass: string; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
          <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InsightPanel({ title, description, icon, tone, children }: { title: string; description?: string; icon: LucideIcon; tone: "reputation" | "ai" | "citations" | "posts"; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card shadow-card">
      {/* The chip sits on the title line (as in Panel), not beside the wrapped description. */}
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <IconChip icon={icon} tone={tone} size="sm" className="-mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h2>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** The whole insights summary: what it's based on, themes, praise, complaints and observations. */
export function ReviewInsightsView({ insights, stats }: { insights: ReviewsInsights; stats: Stats | null }) {
  const { basis, insight } = insights;
  const period = basis.from && basis.to ? `${formatMonth(basis.from)} to ${formatMonth(basis.to)}` : null;
  return (
    <div className="space-y-6">
      <section className="grid gap-5 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconChip icon={MessageSquareQuote} tone="ai" size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Read from {basis.reviews_sent.toLocaleString()} of your {basis.reviews_total.toLocaleString()} reviews
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {period ? `Reviews from ${period}. ` : ""}AI reads the most recent reviews, up to 300 characters of each, and keeps the summary until you update it.
            </p>
          </div>
        </div>
        {stats ? <RatingMix stats={stats} /> : null}
      </section>

      <InsightPanel title="Themes" description="What customers mention most, and how they feel about it." icon={Lightbulb} tone="reputation">
        <ThemeList themes={insight.themes} wide />
      </InsightPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightPanel title="What customers praise" icon={ThumbsUp} tone="citations">
          <PointList items={insight.praise} icon={ThumbsUp} iconClass="text-success" empty="Nothing stands out yet." />
        </InsightPanel>
        <InsightPanel title="What customers complain about" icon={ThumbsDown} tone="posts">
          <PointList items={insight.complaints} icon={ThumbsDown} iconClass="text-warning" empty="No common complaints. Nice." />
        </InsightPanel>
      </div>

      <InsightPanel title="Worth knowing" description="Patterns AI noticed over time." icon={Sparkles} tone="ai">
        <PointList items={insight.observations} icon={Sparkles} iconClass="text-ai" empty="Nothing unusual." />
      </InsightPanel>
    </div>
  );
}

/**
 * A compact "What customers say" card for side columns (AI Review Replies, Reviews): the rating mix,
 * the top themes, the most praised and most criticised points, and a way to generate or update the
 * summary (AI) or open the full Insights page.
 */
export function ReviewInsightsCard({ locationId, ai, summary, className }: { locationId: string; ai: AiStatus; summary: ReviewsSummary; className?: string }) {
  const canEdit = useCanEdit();
  const now = useNow(60_000);
  const titleId = useId();
  const insights = useReviewInsights(locationId);
  const generate = useGenerateInsights(locationId);
  const none = insights.isError && isNoInsights(insights.error);
  const data = insights.data;
  const cost = ai.costs.insights;
  const balance = ai.balance === undefined ? {} : { balance: ai.balance };

  return (
    <section aria-labelledby={titleId} className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={MessageSquareQuote} tone="reputation" size="sm" className="-mt-0.5" />
          <h2 id={titleId} className="truncate text-[15px] font-semibold leading-6 text-foreground">
            What customers say
          </h2>
        </div>
        <AiBadge variant="soft" title="Summarised by AI" />
      </div>

      <div className="space-y-4 p-4">
        {summary.stats ? <RatingMix stats={summary.stats} /> : null}

        {insights.isPending ? (
          <div role="status" aria-label="Loading insights" className="space-y-3">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : data ? (
          <>
            <ThemeList themes={data.insight.themes} limit={3} />
            {data.insight.praise[0] || data.insight.complaints[0] ? (
              <div className="space-y-2 border-t border-border pt-3.5">
                {data.insight.praise[0] ? (
                  <p className="flex gap-2 text-sm text-foreground">
                    <ThumbsUp aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{data.insight.praise[0]}</span>
                  </p>
                ) : null}
                {data.insight.complaints[0] ? (
                  <p className="flex gap-2 text-sm text-foreground">
                    <ThumbsDown aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>{data.insight.complaints[0]}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Updated <time dateTime={data.generated_at} title={formatDateTime(data.generated_at)}>{formatRelative(data.generated_at, now)}</time> from {data.basis.reviews_sent} reviews
            </p>
          </>
        ) : none ? (
          <p className="text-sm text-muted-foreground">
            No summary yet. AI reads your recent reviews and sums up what customers praise and complain about.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>The summary couldn't be loaded.</span>
            <Button size="sm" variant="ghost" onClick={() => void insights.refetch()}>
              <RotateCw aria-hidden /> Try again
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-strong px-4 py-3">
        {canEdit && (data || none) ? (
          <Button
            size="sm"
            variant={data ? "outline" : "ai"}
            className={data ? "border-ai/30 text-ai hover:border-ai/50 hover:bg-ai-surface hover:text-ai-hover" : undefined}
            disabled={generate.isPending || !ai.canRun}
            title={!ai.canRun ? ai.reason : undefined}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
            {data ? "Update" : "Generate"}
            <AiCostChip tokens={cost} {...(data ? balance : { variant: "inverse" as const })} />
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link to={locationPath(locationId, "reputation/insights")}>
            {data ? <Eye aria-hidden /> : null}
            {data ? "All insights" : "About insights"}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      {canEdit && !ai.canRun && ai.reason && (data || none) ? <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">{ai.reason}</p> : null}
    </section>
  );
}
