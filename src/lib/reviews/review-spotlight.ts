/**
 * Opening one review in a list: "Open it" in a send's results, or a link with `?review=<id>`.
 *
 * Every card in a review list sits in an element with `data-review-id` (ReviewsFeed). A review on
 * the page is scrolled to, focused and highlighted for a moment; one that isn't is looked up and
 * shown pinned above the list. The API has no single-review read, so it is found in the lists: the
 * reviews with a draft first (where held-back sends are), then the newest, then the ones deleted on
 * Google.
 *
 * A review looked up once lives under its own key root (`reviewLookupKey`), outside `reviewsKey`:
 * reading the location's reviews again after a draft, a send or a reply doesn't scan the lists again.
 * It stays current because every answer about it is written there too (`updateReviewInCache`); a
 * check for new reviews on Google reads it again (`invalidateReviewLookups`).
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { getReviews, isApiError, type Review, type ReviewsQuery } from "@/api";

/** The id of the reply-authorization banner (Reviews and AI Review Replies), for "Show me" links. */
export const REPLY_AUTHORIZATION_ANCHOR = "reply-authorization";

/** The id of the "Replies authorized by …" line in the page header (focus goes there once replies are authorized). */
export const REPLY_AUTHORIZATION_STATUS_ID = "reply-authorization-status";

/** Every review looked up by id for a location (a `?review=` spotlight, a card kept on screen while it's worked on). */
export const reviewLookupRoot = (locationId: string) => ["locations", locationId, "review-lookup"] as const;

/** One review looked up by id: `Review`, or null when it isn't in the location's lists any more. */
export const reviewLookupKey = (locationId: string, reviewId: string) => [...reviewLookupRoot(locationId), reviewId] as const;

/** Looks every looked-up review up again (after a check with Google, which may have changed any of them). */
export function invalidateReviewLookups(queryClient: QueryClient, locationId: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: reviewLookupRoot(locationId) });
}

/** How long an opened card stays highlighted. */
const SPOTLIGHT_MS = 2400;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The element around the review's card, when it is on the page. */
export function reviewCardElement(reviewId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-review-id="${CSS.escape(reviewId)}"]`);
}

/**
 * Scrolls to the review's card, moves focus to it and highlights it for a moment
 * (`data-spotlight`). False when the card isn't on the page.
 */
export function focusReviewCard(reviewId: string): boolean {
  const element = reviewCardElement(reviewId);
  if (!element) return false;
  element.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  element.focus({ preventScroll: true });
  element.setAttribute("data-spotlight", "");
  window.setTimeout(() => element.removeAttribute("data-spotlight"), SPOTLIGHT_MS);
  return true;
}

/** Scrolls to the reply-authorization banner and focuses it (e.g. a toast's "Show me"). */
export function scrollToReplyAuthorization(): void {
  const banner = document.getElementById(REPLY_AUTHORIZATION_ANCHOR);
  if (!banner) {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    return;
  }
  banner.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  banner.focus({ preventScroll: true });
  // From a toast's button: as focus leaves the toasts, they hand it back to what had it before
  // (Sonner), which undoes the move. Once that has happened, focusing the banner again holds.
  if (document.activeElement !== banner) banner.focus({ preventScroll: true });
}

/** Lists searched for one review, in order, and how many pages of 100 each. */
const SEARCHES: { query: Omit<ReviewsQuery, "page" | "limit">; pages: number }[] = [
  { query: { has_draft: true, sort: "newest" }, pages: 5 },
  { query: { sort: "newest" }, pages: 3 },
  { query: { deleted_on_google: true, sort: "newest" }, pages: 1 },
];

const PAGE = 100;

/** Finds one review by id in the location's lists; null when it isn't in them (any more). */
export async function findReview(locationId: string, reviewId: string, signal?: AbortSignal): Promise<Review | null> {
  for (const search of SEARCHES) {
    for (let page = 1; page <= search.pages; page += 1) {
      const list = await getReviews(locationId, { ...search.query, page, limit: PAGE }, signal);
      const found = list.reviews.find((review) => review.review_id === reviewId);
      if (found) return found;
      if (page * PAGE >= list.total || list.reviews.length === 0) break;
    }
  }
  return null;
}

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

/**
 * The review a `?review=` spotlight opens, when it isn't on the list's page (null: not found). Found
 * once (up to 9 reads of 100); after that the card's own answers keep it current, so the lists aren't
 * scanned again after every draft, send or reply. Only `invalidateReviewLookups` scans again.
 */
export function useSpotlightReview(locationId: string, reviewId: string | null, enabled = true) {
  return useQuery({
    queryKey: reviewLookupKey(locationId, reviewId ?? ""),
    queryFn: ({ signal }): Promise<Review | null> => findReview(locationId, reviewId ?? "", signal),
    enabled: enabled && Boolean(reviewId),
    staleTime: Infinity,
    retry,
  });
}
