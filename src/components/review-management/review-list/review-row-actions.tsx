import { CheckCheck, Eye, PenLine, Sparkles } from "lucide-react";
import { RowActions } from "@/components/layout/shared/data-table";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { awaitingReply, type Review } from "@/lib/reviews/review-management";
import type { ReviewRowHandlers } from "./review-row-model";

export function ReviewRowMenu({ review, handlers }: { review: Review; handlers: ReviewRowHandlers }) {
  const open = awaitingReply(review.responseStatus);
  return (
    <RowActions label={`Actions for review by ${review.customerName}`}>
      <DropdownMenuItem onSelect={() => handlers.onView(review)}>
        <Eye aria-hidden /> View Details
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => handlers.onGenerateReply(review)}>
        <Sparkles aria-hidden /> {review.draft ? "Open AI Draft" : "Generate AI Reply"}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => handlers.onWriteReply(review)}>
        <PenLine aria-hidden /> {open ? "Write Reply" : "Edit Reply"}
      </DropdownMenuItem>
      {open ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onMarkResponded(review)}>
            <CheckCheck aria-hidden /> Mark as Responded
          </DropdownMenuItem>
        </>
      ) : null}
    </RowActions>
  );
}
