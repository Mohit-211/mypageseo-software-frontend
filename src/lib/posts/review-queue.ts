/**
 * "Posts to review" (`/gbp/posts/review`, Phase 25c; the AI review digest links here with `?organization=<id>`):
 * the AI posts waiting for a person (`source: ai`, `pending_approval`) across the locations the signed-in user may
 * see (a client user: its clients'), soonest first, each with `can_approve`, `approval { reason, expires_at, held }`,
 * `ai.findings` (the flagged spans) and its picture. Bulk approve (`POST /posts/approve`, 1–50 ids) answers one
 * result per post, in order; a post already due comes back `scheduled` (the publishing queue sends it within
 * moments), and a post that can't be approved comes back with its `reason` while the others still are.
 *
 * Query keys start with `ORGANIZATION_POSTS_KEY` (`["posts", "review", …]`), so a run's end and any post change
 * (`useInvalidatePosts`) refresh the queue and the calendar's "Posts to review · N".
 *
 * The findings, the picture's label and who approves use the same helpers as the post card (`post-findings.ts`,
 * `approval-labels.ts`), so the queue and the Posts page read the same and block Approve by the same rule.
 *
 * Backend: docs/API.md "The review queue (Phase 25c)"; CUSTOMER_APP.md 2026-11-16 "The review queue, approvals
 * with reasons, series publish modes" item 2 and 2026-11-17 sections 6 and 7 ("Bulk approve").
 */
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { approvePosts, getReviewQueue, type BulkApproveResponse, type BulkApproveResult, type Post, type ReviewQueuePost } from "@/api";
import { ORGANIZATION_POSTS_KEY } from "./ai-runs";
import { postStandingContext, standingHardFindings } from "./post-findings";
import { formatPostMoment } from "./post-format";
import { postsKey } from "./use-posts";

/** Posts per page of the queue (the backend takes up to 100). */
export const REVIEW_QUEUE_PAGE_SIZE = 20;

/** The most posts one bulk approval takes. */
export const BULK_APPROVE_MAX = 50;

/** Where the queue lives; `locationId` opens it filtered to that location. */
export function reviewQueuePath(locationId?: string | null): string {
  return locationId ? `/gbp/posts/review?location=${encodeURIComponent(locationId)}` : "/gbp/posts/review";
}

export const reviewQueueKey = (query: { locationId: string | null; page: number; limit: number }) =>
  [...ORGANIZATION_POSTS_KEY, "review", "page", query] as const;

export const reviewQueueCountKey = [...ORGANIZATION_POSTS_KEY, "review", "count"] as const;

/** One page of the queue, all locations or one (`locationId`). The previous page stays on screen while the next loads. */
export function useReviewQueue({
  locationId,
  page,
  limit = REVIEW_QUEUE_PAGE_SIZE,
  enabled = true,
}: {
  locationId: string | null;
  page: number;
  limit?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: reviewQueueKey({ locationId, page, limit }),
    queryFn: ({ signal }) => getReviewQueue({ ...(locationId ? { location_ids: [locationId] } : {}), page, limit }, signal),
    placeholderData: keepPreviousData,
    // A work list: always read it again when the page opens.
    staleTime: 0,
    enabled,
    retry: false,
  });
}

/** How many AI posts wait for review across the user's locations ("Posts to review · N"); one post per call. */
export function useReviewQueueCount(enabled = true) {
  return useQuery({
    queryKey: reviewQueueCountKey,
    queryFn: async ({ signal }) => (await getReviewQueue({ page: 1, limit: 1 }, signal)).total,
    staleTime: 0,
    enabled,
    retry: false,
  });
}

/**
 * Approves posts of the queue in one request (at most `BULK_APPROVE_MAX`) and reads again what they change: the
 * queue and the organization calendar, each location's posts, and the dashboard's counts. Throws on a whole-request
 * failure (402 `subscription_required`, 403 `organization_suspended`, …); per-post refusals are in the answer.
 */
export function useApproveQueuedPosts(): (posts: readonly Pick<Post, "post_id" | "location_id">[]) => Promise<BulkApproveResponse> {
  const queryClient = useQueryClient();
  return async (posts) => {
    try {
      return await approvePosts(posts.slice(0, BULK_APPROVE_MAX).map((post) => post.post_id));
    } finally {
      for (const locationId of new Set(posts.map((post) => post.location_id))) void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATION_POSTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };
}

/**
 * The viewer may approve it now: `can_approve`, and no hard finding still stands in its text (the backend's rule,
 * `standingHardFindings`: approving would answer 422 `checks_failed`). The post card's Approve uses the same rule.
 */
export function approvableNow(post: ReviewQueuePost): boolean {
  return Boolean(post.can_approve) && standingHardFindings(post.ai, postStandingContext(post)).length === 0;
}

/* -------------------------------------------------------------------------- */
/* Words                                                                        */
/* -------------------------------------------------------------------------- */

const NOT_APPROVED: Readonly<Record<string, string>> = {
  post_not_found: "It was deleted, or you can't see it any more.",
  not_an_approver: "Someone else approves this post.",
  review_expired: "Its review time passed, so it went back to drafts.",
  invalid_status: "It changed meanwhile and no longer waits for review.",
  post_incomplete: "It isn't complete yet. Open it to fill in what's missing.",
  checks_failed: "Some words the AI wrote must change first. Open it to fix them.",
  subscription_required: "Your subscription needs attention before posts can go out.",
  organization_suspended: "The account is suspended, so posts can't go out.",
  feature_not_included: "Your plan doesn't include posts.",
};

/** Why one post of a bulk approval wasn't approved, in plain words. */
export function notApprovedText(reason: string | null | undefined): string {
  return (reason && NOT_APPROVED[reason]) || "It couldn't be approved. Open it to check it.";
}

/** What happens to an approved post: "It goes out Fri, Nov 20 · 11:00 AM." or "It goes out in a moment." */
export function approvedText(result: Pick<BulkApproveResult, "status">, post: Pick<Post, "scheduled_at"> | undefined, now: number): string {
  const at = post?.scheduled_at ? Date.parse(post.scheduled_at) : Number.NaN;
  if (result.status === "scheduled" && Number.isFinite(at) && at > now + 60_000) return `It goes out ${formatPostMoment(post?.scheduled_at, { weekday: true })}.`;
  if (result.status === "scheduled" || result.status === "publishing") return "It goes out in a moment.";
  if (result.status === "published") return "It's on Google now.";
  if (result.status === "pending_approval") return "It now waits for the next approver.";
  return "It's approved.";
}
