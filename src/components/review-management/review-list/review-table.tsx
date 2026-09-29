import { format } from "date-fns";
import { SortableTh, TableBody, TableHead, TableRow, TableScroll, Th, tdClass, tdMutedClass, type SortOrder } from "@/components/layout/shared/data-table";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABEL, type Review } from "@/lib/reviews/review-management";
import { CustomerAvatar, ResponseStatusBadge, SentimentBadge, StarRating, TopicChips } from "../review-ui";
import { ReviewRowMenu } from "./review-row-actions";
import { primaryAction, type ReviewRowHandlers } from "./review-row-model";

export type ReviewSortKey = "createdAt" | "rating";

export function ReviewTable({
  reviews,
  sort,
  order,
  onSort,
  handlers,
}: {
  reviews: Review[];
  sort: ReviewSortKey;
  order: SortOrder;
  onSort: (key: ReviewSortKey) => void;
  handlers: ReviewRowHandlers;
}) {
  return (
    <TableScroll minWidth={1080} label="Reviews">
      <TableHead>
        <Th>Customer</Th>
        <SortableTh label="Rating" value="rating" active={sort} order={order} onSort={onSort} />
        <Th>Review</Th>
        <Th>Sentiment</Th>
        <Th>Topics</Th>
        <SortableTh label="Date" value="createdAt" active={sort} order={order} onSort={onSort} />
        <Th>Response</Th>
        <Th align="right">Action</Th>
      </TableHead>
      <TableBody>
        {reviews.map((review) => {
          const action = primaryAction(review, handlers);
          return (
            <TableRow key={review.id}>
              <td className={tdClass}>
                <div className="flex items-center gap-2.5">
                  <CustomerAvatar name={review.customerName} />
                  <div className="min-w-0">
                    <p className="whitespace-nowrap font-medium text-foreground">{review.customerName}</p>
                    <p className="text-xs text-muted-foreground">{PLATFORM_LABEL[review.platform]}</p>
                  </div>
                </div>
              </td>
              <td className={tdClass}>
                <StarRating rating={review.rating} />
              </td>
              <td className={`${tdClass} max-w-sm`}>
                <button
                  type="button"
                  onClick={() => handlers.onView(review)}
                  className="line-clamp-2 text-left text-sm text-foreground hover:text-primary focus-visible:underline focus-visible:outline-none"
                  title={review.text}
                >
                  “{review.text}”
                </button>
              </td>
              <td className={tdClass}>
                <SentimentBadge sentiment={review.analysis?.sentiment ?? null} />
              </td>
              <td className={`${tdClass} max-w-48`}>
                <TopicChips topics={review.analysis?.topics.map((t) => t.topic) ?? []} max={2} />
              </td>
              <td className={`${tdMutedClass} whitespace-nowrap`}>{format(new Date(review.createdAt), "MMM d, yyyy")}</td>
              <td className={tdClass}>
                <ResponseStatusBadge status={review.responseStatus} />
              </td>
              <td className={`${tdClass} text-right`}>
                <div className="flex items-center justify-end gap-1">
                  <Button variant={action.emphasis ? "outline" : "ghost"} size="sm" className="h-8 whitespace-nowrap" onClick={action.run}>
                    <action.icon aria-hidden />
                    {action.label}
                  </Button>
                  <ReviewRowMenu review={review} handlers={handlers} />
                </div>
              </td>
            </TableRow>
          );
        })}
      </TableBody>
    </TableScroll>
  );
}
