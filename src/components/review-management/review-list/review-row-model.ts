import { Eye, PenLine, RotateCw, Sparkles, type LucideIcon } from "lucide-react";
import { awaitingReply, type Review } from "@/lib/reviews/review-management";

export type ReviewRowHandlers = {
  onView: (review: Review) => void;
  /** Opens the AI reply suggestion (or the saved draft). */
  onGenerateReply: (review: Review) => void;
  onWriteReply: (review: Review) => void;
  onMarkResponded: (review: Review) => void;
};

/** The one action a row most likely needs next. */
export function primaryAction(review: Review, handlers: ReviewRowHandlers): { label: string; icon: LucideIcon; run: () => void; emphasis: boolean } {
  if (!awaitingReply(review.responseStatus)) return { label: "View", icon: Eye, run: () => handlers.onView(review), emphasis: false };
  if (review.responseStatus === "failed") return { label: "Retry", icon: RotateCw, run: () => handlers.onGenerateReply(review), emphasis: true };
  if (review.draft) return { label: "Review Draft", icon: PenLine, run: () => handlers.onGenerateReply(review), emphasis: true };
  return { label: "Generate Reply", icon: Sparkles, run: () => handlers.onGenerateReply(review), emphasis: true };
}
