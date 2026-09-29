import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCheck, PenLine, Sparkles } from "lucide-react";
import { SampleDataBadge } from "@/components/ai-visibility/visibility-ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PLATFORM_LABEL,
  REPLY_TONE_LABEL,
  SENTIMENT_LABEL,
  TOPIC_LABEL,
  awaitingReply,
  isNegativeReview,
  type Review,
  type ReviewReply,
} from "@/lib/reviews/review-management";
import { ApprovalRequiredBadge, CustomerAvatar, ResponseStatusBadge, SentimentBadge, SentimentDot, StarRating, TopicChips } from "./review-ui";

const REPLY_SOURCE_LABEL: Record<ReviewReply["source"], string> = {
  manual: "Written by your team",
  ai: "AI reply, approved by your team",
  automation: "Published by automation",
  external: "Marked as responded",
};

/** Simulated Review Detail API latency, so the loading state is exercised. */
const DETAIL_LOAD_MS = 350;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 id={id} className="text-sm font-semibold text-foreground">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function ReplySection({ review }: { review: Review }) {
  if (review.reply) {
    return (
      <div className="rounded-lg border border-success/25 bg-success-surface/50 p-4">
        <p className="text-xs text-muted-foreground">
          {REPLY_SOURCE_LABEL[review.reply.source]} · {format(new Date(review.reply.publishedAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {review.reply.text ?? "The reply was posted outside MyPageSEO, so its text isn't available here."}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {review.responseStatus === "failed" && review.failureReason ? (
        <div role="alert" className="flex gap-2 rounded-lg border border-critical/25 bg-critical-surface p-3 text-sm text-critical">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{review.failureReason}</p>
        </div>
      ) : null}
      {review.draft ? (
        <div className="rounded-lg border border-dashed border-primary/35 bg-brand-tint p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {review.draft.source === "automation" ? "Drafted by automation" : "AI draft"} · {REPLY_TONE_LABEL[review.draft.tone]} tone · Not published
            </p>
            {isNegativeReview(review) ? <ApprovalRequiredBadge /> : null}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{review.draft.text}</p>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface-strong p-4 text-sm text-muted-foreground">No reply yet. Generate an AI reply or write your own.</p>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading review" className="space-y-5 px-5 py-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function ReviewDetails({
  review,
  onClose,
  onGenerateReply,
  onWriteReply,
  onMarkResponded,
}: {
  review: Review | null;
  onClose: () => void;
  onGenerateReply: (review: Review) => void;
  onWriteReply: (review: Review) => void;
  onMarkResponded: (review: Review) => void;
}) {
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const reviewId = review?.id ?? null;
  useEffect(() => {
    if (!reviewId) return;
    const timer = window.setTimeout(() => setLoadedId(reviewId), DETAIL_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, [reviewId]);

  const loading = review !== null && loadedId !== review.id;
  const open = review ? awaitingReply(review.responseStatus) : false;

  return (
    <Sheet open={review !== null} onOpenChange={(next) => !next && onClose()}>
      {/* Full screen on mobile, a side drawer from `sm` up. */}
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {review ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
              <div className="flex items-center gap-3">
                <CustomerAvatar name={review.customerName} className="size-10 text-sm" />
                <div className="min-w-0">
                  <SheetTitle className="text-base">{review.customerName}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-x-2">
                    <StarRating rating={review.rating} />
                    <span>
                      {PLATFORM_LABEL[review.platform]} review · {format(new Date(review.createdAt), "MMMM d, yyyy")}
                    </span>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {loading ? (
              <DetailSkeleton />
            ) : (
              <div className="flex-1 space-y-6 px-5 py-4">
                <section aria-labelledby="review-text-heading">
                  <SectionTitle id="review-text-heading">Review</SectionTitle>
                  <blockquote className="rounded-lg border border-border bg-surface-strong p-4 text-sm leading-relaxed text-foreground">“{review.text}”</blockquote>
                </section>

                <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
                  <Fact label="Date">{format(new Date(review.createdAt), "MMMM d, yyyy")}</Fact>
                  <Fact label="Rating">{review.rating} out of 5</Fact>
                  <Fact label="Sentiment">
                    <SentimentBadge sentiment={review.analysis?.sentiment ?? null} />
                  </Fact>
                  <Fact label="Response Status">
                    <ResponseStatusBadge status={review.responseStatus} />
                  </Fact>
                  <div className="col-span-2">
                    <Fact label="Topics">
                      <TopicChips topics={review.analysis?.topics.map((t) => t.topic) ?? []} max={6} className="mt-0.5" />
                    </Fact>
                  </div>
                </dl>

                <section aria-labelledby="review-ai-heading">
                  <SectionTitle id="review-ai-heading" aside={review.analysis ? <SampleDataBadge /> : null}>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="size-4 text-primary" aria-hidden /> AI Analysis
                    </span>
                  </SectionTitle>
                  {review.analysis ? (
                    <div className="space-y-3 rounded-lg border border-primary/20 bg-brand-tint p-4">
                      <dl className="grid grid-cols-2 gap-4">
                        <Fact label="Sentiment">{SENTIMENT_LABEL[review.analysis.sentiment]}</Fact>
                        <Fact label="Key Topics">{review.analysis.topics.length ? review.analysis.topics.map((t) => TOPIC_LABEL[t.topic]).join(", ") : "None detected"}</Fact>
                      </dl>
                      {review.analysis.topics.length ? (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Sentiment by topic">
                          {review.analysis.topics.map((t) => (
                            <li key={t.topic} className="inline-flex items-center gap-1.5">
                              <SentimentDot sentiment={t.sentiment} />
                              {TOPIC_LABEL[t.topic]}: {SENTIMENT_LABEL[t.sentiment].toLowerCase()}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div>
                        <p className="text-[11px] text-muted-foreground">Summary</p>
                        <p className="mt-0.5 text-sm text-foreground">“{review.analysis.summary}”</p>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-border bg-surface-strong p-4 text-sm text-muted-foreground">
                      This review hasn't been analyzed yet. Run AI analysis from the dashboard to see its sentiment, topics and summary.
                    </p>
                  )}
                </section>

                <section aria-labelledby="review-reply-heading">
                  <SectionTitle id="review-reply-heading">Response</SectionTitle>
                  <ReplySection review={review} />
                </section>
              </div>
            )}

            <div className="sticky bottom-0 mt-auto grid gap-2 border-t border-border bg-surface px-5 py-3 sm:flex sm:justify-end">
              {open ? (
                <>
                  <Button variant="ghost" className="h-10 sm:h-9" disabled={loading} onClick={() => onMarkResponded(review)}>
                    <CheckCheck aria-hidden /> Mark as Responded
                  </Button>
                  <Button variant="outline" className="h-10 sm:h-9" disabled={loading} onClick={() => onWriteReply(review)}>
                    <PenLine aria-hidden /> Write Reply
                  </Button>
                  <Button className="h-10 sm:h-9" disabled={loading} onClick={() => onGenerateReply(review)}>
                    <Sparkles aria-hidden /> {review.draft ? "Review AI Draft" : "Generate AI Reply"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="h-10 sm:h-9" onClick={onClose}>
                    Close
                  </Button>
                  <Button variant="outline" className="h-10 sm:h-9" disabled={loading} onClick={() => onWriteReply(review)}>
                    <PenLine aria-hidden /> Edit Reply
                  </Button>
                </>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
