/**
 * Which locations have AI posts waiting for a person, for the dashboard's "N posts wait for approval" steps
 * (`posts:approval`): those open "Posts to review" (`/gbp/posts/review`, Phase 25c) when AI posts are among the
 * waiting ones, and the location's waiting posts otherwise (a person's post waiting for the owner or the client
 * isn't in the review queue).
 *
 * One small read per location of such a step: `GET /posts/review?location_ids=<id>&limit=1` → `total` (the AI
 * posts waiting there, in the caller's scope). While it loads, or when it fails, the step keeps the location's
 * waiting posts, which always lists them.
 */
import { useQueries } from "@tanstack/react-query";
import { getReviewQueue, type ReviewQueue } from "@/api";

/**
 * Under the organization's posts key (`ORGANIZATION_POSTS_KEY`, `["posts"]`, in src/lib/posts/ai-runs.ts), so an
 * approval, a post change or a run's end refreshes it with the review queue and the calendar.
 */
const aiPostsWaitingKey = (locationId: string) => ["posts", "review", "waiting", locationId] as const;

const hasWaiting = (queue: ReviewQueue) => queue.total > 0;

/** The locations among `locationIds` with AI posts waiting for review (unknown counts as none). */
export function useAiPostsWaiting(locationIds: readonly string[]): ReadonlySet<string> {
  const results = useQueries({
    queries: locationIds.map((locationId) => ({
      queryKey: aiPostsWaitingKey(locationId),
      queryFn: ({ signal }: { signal: AbortSignal }) => getReviewQueue({ location_ids: [locationId], page: 1, limit: 1 }, signal),
      select: hasWaiting,
      staleTime: 60_000,
      retry: false,
    })),
  });
  return new Set(locationIds.filter((_, index) => results[index]?.data === true));
}
