import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoGbpReviews } from "../mypageseo/demo/reviews";

export type GbpReviewsStatus = "loading" | "ready" | "no_reviews" | "disconnected" | "error";

export type ReviewResponseState = "unanswered" | "responded" | "unavailable";

export type GbpReview = {
  id: string;
  /** Reviewer name or identifier supplied by the backend. */
  reviewer: string | null;
  rating: number | null;
  text: string | null;
  /** Human readable review date supplied by the backend. */
  date: string | null;
  /** Sortable ISO timestamp, when the backend supplies one. */
  timestamp: string | null;
  responseState: ReviewResponseState;
  responseText: string | null;
  responseDate: string | null;
  /** Original Google review URL, only when the backend exposes one. */
  sourceUrl: string | null;
};

export type GbpReviewsSummary = {
  averageRating: number | null;
  total: number | null;
  unanswered: number | null;
  /** Rating -> count, empty when the backend does not supply a distribution. */
  distribution: { rating: number; count: number }[];
};

export type GbpReviewsCapabilities = {
  canRespond: boolean;
  canEditResponse: boolean;
  canGenerateResponse: boolean;
  canSearch: boolean;
  canFilterByDate: boolean;
};

export type GbpReviewsData = {
  status: GbpReviewsStatus;
  lastCheckedAt: string | null;
  summary: GbpReviewsSummary;
  reviews: GbpReview[];
  capabilities: GbpReviewsCapabilities;
};

/**
 * The live Google Business Profile review source is not connected in this
 * frontend yet, so this adapter falls back to a deterministic demo review
 * list with realistic write capabilities enabled.
 */
export function getGbpReviews(
  locationId?: string | null,
  real?: GbpReviewsData | null,
): GbpReviewsData {
  return withDemoFallback(real, () => demoGbpReviews(locationId));
}

export const REVIEWS_PAGE_SIZE = 20;
