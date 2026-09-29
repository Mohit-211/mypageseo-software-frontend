import { ArrowRight } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SENTIMENTS, SENTIMENT_COLOR, TOPIC_LABEL, type ReviewTopic, type TopicStat } from "@/lib/reviews/review-management";
import { SentimentBadge } from "../review-ui";

/** Positive / neutral / negative split of a topic's mentions. */
function TopicSentimentBar({ topic }: { topic: TopicStat }) {
  return (
    <span
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${topic.positive} positive, ${topic.neutral} neutral, ${topic.negative} negative mentions`}
    >
      {SENTIMENTS.map((s) => (
        <span key={s} className="h-full" style={{ width: `${(topic[s] / topic.mentions) * 100}%`, background: SENTIMENT_COLOR[s] }} />
      ))}
    </span>
  );
}

export function ReviewTopics({ topics, onViewReviews }: { topics: TopicStat[]; onViewReviews: (topic: ReviewTopic) => void }) {
  return (
    <Panel title="Most Mentioned Topics" description="What customers talk about in the selected period" className="flex flex-col">
      {topics.length === 0 ? (
        <EmptyState compact title="No topics yet" description="Topics appear once analyzed reviews mention them." />
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_4.5rem_minmax(0,1.2fr)_auto] gap-3 px-2 pb-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Topic</span>
            <span className="text-right">Mentions</span>
            <span>Sentiment</span>
            <span className="sr-only">Action</span>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {topics.map((t) => (
              <li key={t.topic}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewReviews(t.topic)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onViewReviews(t.topic);
                    }
                  }}
                  aria-label={`${TOPIC_LABEL[t.topic]}: ${t.mentions} mentions. View reviews`}
                  className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:grid-cols-[minmax(0,1.4fr)_4.5rem_minmax(0,1.2fr)_auto] sm:px-2"
                >
                  <span className="text-sm font-medium text-foreground">{TOPIC_LABEL[t.topic]}</span>
                  <span className="text-right text-sm tabular text-foreground">
                    {t.mentions}
                    <span className="text-muted-foreground sm:hidden"> mentions</span>
                  </span>
                  <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <SentimentBadge sentiment={t.sentiment} />
                    <TopicSentimentBar topic={t} />
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                    className="col-span-2 h-8 justify-self-start px-2 text-xs text-primary sm:col-span-1 sm:justify-self-end"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewReviews(t.topic);
                    }}
                  >
                    View Reviews <ArrowRight aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function ReviewTopicsSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-44" />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
