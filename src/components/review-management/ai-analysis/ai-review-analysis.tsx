import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, YAxis } from "recharts";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { ChangeIndicator } from "@/components/ai-visibility/visibility-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SENTIMENTS,
  SENTIMENT_COLOR,
  SENTIMENT_LABEL,
  TOPIC_LABEL,
  formatSigned,
  type ReviewSummary,
  type ReviewTopic,
  type SentimentShares,
  type TopicStat,
  type TrendBucket,
} from "@/lib/reviews/review-management";
import { cn } from "@/lib/utils";
import { NoAnalysisEmpty } from "../empty-states";
import { SentimentDot } from "../review-ui";
import { ReviewInsights } from "./review-insights";

function AnalysisCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4 shadow-card", className)}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function SentimentCard({ shares }: { shares: SentimentShares | null }) {
  if (!shares) return <p className="text-sm text-muted-foreground">No analyzed reviews in this period.</p>;
  const data = SENTIMENTS.map((s) => ({ sentiment: s, value: shares[s] }));
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-28 shrink-0" role="img" aria-label={`Positive ${shares.positive}%, neutral ${shares.neutral}%, negative ${shares.negative}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="sentiment" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.sentiment} fill={SENTIMENT_COLOR[d.sentiment]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular text-foreground">{shares.positive}%</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Positive</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {SENTIMENTS.map((s) => (
          <li key={s} className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-2 text-foreground">
              <SentimentDot sentiment={s} />
              {SENTIMENT_LABEL[s]}
            </span>
            <span className="font-medium tabular text-foreground">{shares[s]}%</span>
          </li>
        ))}
        <li className="pt-1 text-xs text-muted-foreground">{shares.analyzed} reviews analyzed</li>
      </ul>
    </div>
  );
}

function TopTopicsCard({ topics, onSelectTopic }: { topics: TopicStat[]; onSelectTopic: (topic: ReviewTopic) => void }) {
  if (topics.length === 0) return <p className="text-sm text-muted-foreground">No topics found in this period.</p>;
  const max = topics[0]!.mentions;
  return (
    <ul className="space-y-1">
      {topics.slice(0, 6).map((t) => (
        <li key={t.topic}>
          <button
            type="button"
            onClick={() => onSelectTopic(t.topic)}
            className="grid w-full grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={`${TOPIC_LABEL[t.topic]}: ${t.mentions} mentions, mostly ${t.sentiment}. Show reviews`}
          >
            <span className="inline-flex min-w-0 items-center gap-2 text-foreground">
              <SentimentDot sentiment={t.sentiment} />
              <span className="truncate">{TOPIC_LABEL[t.topic]}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(t.mentions / max) * 100}%` }} />
            </span>
            <span className="text-right tabular text-muted-foreground">{t.mentions}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Sparkline({ data, dataKey, color }: { data: TrendBucket[]; dataKey: keyof TrendBucket; color: string }) {
  return (
    <div className="h-8 w-20 shrink-0" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendCard({ buckets, summary }: { buckets: TrendBucket[]; summary: ReviewSummary }) {
  const rows = [
    {
      label: "Positive sentiment",
      value: summary.sentiment ? `${summary.sentiment.positive}%` : "—",
      change: <ChangeIndicator value={summary.positiveChange} suffix=" pts" />,
      key: "positive" as const,
      color: SENTIMENT_COLOR.positive,
    },
    {
      label: "Negative sentiment",
      value: summary.sentiment ? `${summary.sentiment.negative}%` : "—",
      change:
        summary.negativeChange === null ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="text-xs font-medium tabular text-muted-foreground">{formatSigned(summary.negativeChange, " pts")}</span>
        ),
      key: "negative" as const,
      color: SENTIMENT_COLOR.negative,
    },
    {
      label: "Review volume",
      value: summary.newInRange.toLocaleString(),
      change: <ChangeIndicator value={summary.newChange} suffix="" />,
      key: "reviews" as const,
      color: "var(--primary)",
    },
  ];
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular text-foreground">{row.value}</span>
              {row.change}
            </p>
          </div>
          <Sparkline data={buckets} dataKey={row.key} color={row.color} />
        </li>
      ))}
      <li className="pt-2 text-xs text-muted-foreground">Compared with the previous period</li>
    </ul>
  );
}

export function AIReviewAnalysis({
  analyzedAt,
  analyzing,
  lastAnalyzedCount,
  summary,
  topics,
  buckets,
  insights,
  onAnalyze,
  onSelectTopic,
}: {
  analyzedAt: string | null;
  analyzing: boolean;
  /** Set right after an analysis run completes. */
  lastAnalyzedCount: number | null;
  summary: ReviewSummary;
  topics: TopicStat[];
  buckets: TrendBucket[];
  insights: string[];
  onAnalyze: () => void;
  onSelectTopic: (topic: ReviewTopic) => void;
}) {
  return (
    <section aria-labelledby="ai-review-analysis-heading" className="rounded-xl border border-primary/25 bg-brand-tint/60 p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="ai-review-analysis-heading" className="text-base font-semibold text-foreground">
              AI Review Analysis
            </h2>
            <p className="text-sm text-muted-foreground">
              {analyzedAt ? `Sentiment, topics and trends · Last analyzed ${formatDistanceToNow(new Date(analyzedAt), { addSuffix: true })}` : "Sentiment, topics and trends from your reviews"}
            </p>
          </div>
        </div>
        {analyzedAt ? (
          <Button variant="outline" onClick={onAnalyze} disabled={analyzing} className="w-full bg-surface sm:w-auto">
            {analyzing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {analyzing ? "Analyzing reviews…" : "Analyze Reviews"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4" aria-live="polite">
        {analyzing ? (
          <AnalysisRunning />
        ) : !analyzedAt ? (
          <NoAnalysisEmpty onAnalyze={onAnalyze} analyzing={analyzing} className="bg-surface" />
        ) : (
          <div className="space-y-4">
            {lastAnalyzedCount !== null ? (
              <p role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" aria-hidden />
                Analysis complete · {lastAnalyzedCount.toLocaleString()} reviews analyzed
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AnalysisCard title="Sentiment">
                <SentimentCard shares={summary.sentiment} />
              </AnalysisCard>
              <AnalysisCard title="Top Topics">
                <TopTopicsCard topics={topics} onSelectTopic={onSelectTopic} />
              </AnalysisCard>
              <AnalysisCard title="Trend" className="md:col-span-2 xl:col-span-1">
                <TrendCard buckets={buckets} summary={summary} />
              </AnalysisCard>
            </div>
            <ReviewInsights insights={insights} />
          </div>
        )}
      </div>
    </section>
  );
}

function AnalysisCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn("rounded-lg border border-border bg-surface p-4", i === 2 && "md:col-span-2 xl:col-span-1")}>
          <Skeleton className="h-3 w-24" />
          <div className="mt-4 flex items-center gap-4">
            <Skeleton className="size-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysisRunning() {
  return (
    <div role="status" className="space-y-3">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Analyzing reviews…
      </p>
      <AnalysisCardsSkeleton />
    </div>
  );
}

export function AIReviewAnalysisSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="mt-4">
        <AnalysisCardsSkeleton />
      </div>
    </div>
  );
}
