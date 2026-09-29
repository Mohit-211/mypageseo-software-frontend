import {
  PLATFORM_LABEL,
  RESPONSE_STATUS_LABEL,
  SENTIMENT_LABEL,
  TOPIC_LABEL,
  awaitingReply,
  type ResponseStatus,
  type Review,
  type ReviewPlatform,
  type ReviewSentiment,
  type ReviewTopic,
} from "@/lib/reviews/review-management";

export type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
export type ReplyFilter = "all" | "needs_response" | "has_response";
export type DateFilter = "all" | "7d" | "30d" | "90d";

export type ReviewFilterState = {
  search: string;
  rating: RatingFilter;
  sentiment: ReviewSentiment | "all";
  topic: ReviewTopic | "all";
  status: ResponseStatus | "all";
  reply: ReplyFilter;
  date: DateFilter;
  platform: ReviewPlatform | "all";
};

export const DEFAULT_REVIEW_FILTERS: ReviewFilterState = {
  search: "",
  rating: "all",
  sentiment: "all",
  topic: "all",
  status: "all",
  reply: "all",
  date: "all",
  platform: "all",
};

export const RATING_OPTIONS: Record<RatingFilter, string> = { all: "All ratings", "5": "5 stars", "4": "4 stars", "3": "3 stars", "2": "2 stars", "1": "1 star" };
export const SENTIMENT_OPTIONS = { all: "All sentiment", ...SENTIMENT_LABEL } as Record<ReviewSentiment | "all", string>;
export const TOPIC_OPTIONS = { all: "All topics", ...TOPIC_LABEL } as Record<ReviewTopic | "all", string>;
export const STATUS_OPTIONS = { all: "Any status", ...RESPONSE_STATUS_LABEL } as Record<ResponseStatus | "all", string>;
export const REPLY_OPTIONS: Record<ReplyFilter, string> = { all: "All reviews", needs_response: "Needs Response", has_response: "Has Response" };
export const DATE_OPTIONS: Record<DateFilter, string> = { all: "Any date", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };
export const PLATFORM_OPTIONS = { all: "All platforms", ...PLATFORM_LABEL } as Record<ReviewPlatform | "all", string>;

const DATE_DAYS: Record<Exclude<DateFilter, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function matchesReviewFilters(review: Review, filters: ReviewFilterState, now = Date.now()): boolean {
  const query = filters.search.trim().toLowerCase();
  if (query && !review.customerName.toLowerCase().includes(query) && !review.text.toLowerCase().includes(query)) return false;
  if (filters.rating !== "all" && review.rating !== Number(filters.rating)) return false;
  if (filters.sentiment !== "all" && review.analysis?.sentiment !== filters.sentiment) return false;
  if (filters.topic !== "all" && !review.analysis?.topics.some((t) => t.topic === filters.topic)) return false;
  if (filters.status !== "all" && review.responseStatus !== filters.status) return false;
  if (filters.reply === "needs_response" && !awaitingReply(review.responseStatus)) return false;
  if (filters.reply === "has_response" && awaitingReply(review.responseStatus)) return false;
  if (filters.platform !== "all" && review.platform !== filters.platform) return false;
  if (filters.date !== "all" && now - new Date(review.createdAt).getTime() > DATE_DAYS[filters.date] * 86_400_000) return false;
  return true;
}

/** Applied filters, excluding the free-text search. */
export function activeFilterChips(filters: ReviewFilterState) {
  const chips: { label: string; value: string }[] = [];
  if (filters.reply !== "all") chips.push({ label: "Response", value: REPLY_OPTIONS[filters.reply] });
  if (filters.rating !== "all") chips.push({ label: "Rating", value: RATING_OPTIONS[filters.rating] });
  if (filters.sentiment !== "all") chips.push({ label: "Sentiment", value: SENTIMENT_OPTIONS[filters.sentiment] });
  if (filters.topic !== "all") chips.push({ label: "Topic", value: TOPIC_OPTIONS[filters.topic] });
  if (filters.status !== "all") chips.push({ label: "Status", value: STATUS_OPTIONS[filters.status] });
  if (filters.date !== "all") chips.push({ label: "Date", value: DATE_OPTIONS[filters.date] });
  if (filters.platform !== "all") chips.push({ label: "Platform", value: PLATFORM_OPTIONS[filters.platform] });
  return chips;
}
