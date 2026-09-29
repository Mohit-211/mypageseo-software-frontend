import { useState } from "react";
import { format } from "date-fns";
import { Eye, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { awaitingReply, type Review } from "@/lib/reviews/review-management";
import { CustomerAvatar, ResponseStatusBadge, SentimentBadge, StarRating, TopicChips } from "../review-ui";
import { ReviewRowMenu } from "./review-row-actions";
import { primaryAction, type ReviewRowHandlers } from "./review-row-model";

const COLLAPSED_LENGTH = 140;

/** Mobile replacement for a review table row. */
export function ReviewCard({ review, handlers }: { review: Review; handlers: ReviewRowHandlers }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.text.length > COLLAPSED_LENGTH;
  const open = awaitingReply(review.responseStatus);
  const generate = primaryAction(review, handlers);

  return (
    <article className="px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <CustomerAvatar name={review.customerName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{review.customerName}</p>
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-xs text-muted-foreground">{format(new Date(review.createdAt), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>
        <ReviewRowMenu review={review} handlers={handlers} />
      </div>

      <p id={`review-text-${review.id}`} className={`mt-3 text-sm leading-relaxed text-foreground ${expanded || !long ? "" : "line-clamp-3"}`}>
        “{review.text}”
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls={`review-text-${review.id}`}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <SentimentBadge sentiment={review.analysis?.sentiment ?? null} />
        <ResponseStatusBadge status={review.responseStatus} />
        <TopicChips topics={review.analysis?.topics.map((t) => t.topic) ?? []} />
      </div>

      <div className={`mt-3 grid gap-2 ${open ? "grid-cols-3" : "grid-cols-2"}`}>
        <Button variant="outline" className="h-10" onClick={() => handlers.onView(review)}>
          <Eye aria-hidden /> View
        </Button>
        {open ? (
          <Button variant="outline" className="h-10 px-2" onClick={generate.run}>
            {review.draft ? <generate.icon aria-hidden /> : <Sparkles aria-hidden />}
            <span className="truncate">{review.draft ? "Draft" : "Generate"}</span>
          </Button>
        ) : null}
        <Button variant={open ? "default" : "outline"} className="h-10" onClick={() => handlers.onWriteReply(review)}>
          <PenLine aria-hidden /> {open ? "Reply" : "Edit Reply"}
        </Button>
      </div>
    </article>
  );
}
