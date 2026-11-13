import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, LoaderCircle, RefreshCw } from "lucide-react";
import { refreshReviews, type ReviewsSummary } from "@/api";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { useWriteBlock } from "@/lib/billing/write-block";
import { formatDateTime, formatRelative, formatTime } from "@/lib/datetime";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { invalidateReviewLookups } from "@/lib/reviews/review-spotlight";
import { reviewsKey } from "@/lib/reviews/use-reviews";

/** "Checked with Google 3 hours ago" under a reviews page title. */
export function ReviewsSyncMeta({ summary }: { summary: ReviewsSummary }) {
  const now = useNow(60_000);
  const at = summary.last_refreshed_at ?? summary.last_synced_at;
  const verb = summary.last_refreshed_at ? "Checked with Google" : "Synced with Google";
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <History aria-hidden className="size-3.5 shrink-0" />
      {at ? (
        <span>
          {verb} <time dateTime={at} title={formatDateTime(at)}>{formatRelative(at, now)}</time>
        </span>
      ) : (
        <span>Not checked with Google yet</span>
      )}
    </p>
  );
}

/**
 * "Check for new reviews": reads new and changed reviews from Google (free, once per 15 minutes).
 * Hidden for a read-only client_user; disabled with the reason for a read-only or suspended account,
 * which the backend refuses (`POST reviews/refresh` needs billing).
 */
export function RefreshReviewsButton(props: { locationId: string; summary: ReviewsSummary }) {
  return useCanEdit() ? <RefreshReviewsButtonEditor {...props} /> : null;
}

function RefreshReviewsButtonEditor({ locationId, summary }: { locationId: string; summary: ReviewsSummary }) {
  const queryClient = useQueryClient();
  const now = useNow(30_000);
  const writeBlock = useWriteBlock();
  const nextAllowed = summary.next_refresh_allowed_at ? Date.parse(summary.next_refresh_allowed_at) : 0;
  const waiting = Number.isFinite(nextAllowed) && nextAllowed > now;

  const refresh = useMutation({
    mutationFn: () => refreshReviews(locationId),
    onSuccess: (result) => {
      const found = result.new_reviews + result.updated_reviews;
      if (found === 0) toast.success("You're up to date", { description: "No new reviews since the last check." });
      else
        toast.success(
          result.new_reviews > 0 ? `${result.new_reviews} new review${result.new_reviews === 1 ? "" : "s"}` : "Reviews updated",
          result.updated_reviews > 0 ? { description: `${result.updated_reviews} changed since the last check.` } : undefined,
        );
    },
    onError: (err) => toast.error(reviewErrorMessage(err, "Reviews couldn't be checked.").message),
    // Google may have changed any review, the one opened above the list (`?review=`) included.
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) }), invalidateReviewLookups(queryClient, locationId)]),
  });

  return (
    <Button
      variant="outline"
      aria-busy={refresh.isPending || undefined}
      disabled={refresh.isPending || waiting || writeBlock.blocked}
      onClick={() => refresh.mutate()}
      title={
        writeBlock.reason ??
        (waiting && summary.next_refresh_allowed_at ? `You can check again at ${formatTime(summary.next_refresh_allowed_at)}.` : undefined)
      }
    >
      {refresh.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
      {refresh.isPending ? "Checking…" : waiting ? "Checked recently" : "Check for new reviews"}
    </Button>
  );
}
