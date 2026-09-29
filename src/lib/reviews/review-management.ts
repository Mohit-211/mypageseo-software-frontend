import { useEffect, useSyncExternalStore } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { StatusTone } from "@/components/layout/shared/data-display";
import type { DateBounds } from "../ai-visibility/ai-visibility";
import { demoAnalyzeReview, demoReplyText, demoReviewDataset, demoSyncReviews } from "../mypageseo/demo/review-management";

// Date ranges behave the same as on the AI Visibility dashboard.
export {
  DATE_RANGE_LABEL,
  describeRange,
  formatSigned,
  rangeBounds,
  type DateBounds,
  type DateRangePreset,
  type DateRangeValue,
} from "../ai-visibility/ai-visibility";

/* -------------------------------------------------------------------------- */
/* Contract                                                                   */
/*                                                                            */
/* Shapes the review backend is expected to return. Components only read      */
/* these types, so connecting Google Business Profile reviews means replacing */
/* the store's loaders/actions below — not the components.                    */
/* -------------------------------------------------------------------------- */

export type ReviewPlatform = "google";

export type ReviewSentiment = "positive" | "neutral" | "negative";

export type ReviewTopic = "service" | "staff" | "quality" | "price" | "waiting_time" | "location";

export type ResponseStatus = "needs_response" | "ai_draft" | "pending_approval" | "replied" | "auto_replied" | "failed";

export type ReplyTone = "professional" | "friendly" | "short" | "warm";

/** Result of the AI sentiment + topic analysis for one review. */
export type ReviewAnalysis = {
  sentiment: ReviewSentiment;
  /** Topics in the order they are mentioned, each with the sentiment it was mentioned with. */
  topics: { topic: ReviewTopic; sentiment: ReviewSentiment }[];
  summary: string;
  analyzedAt: string;
};

export type ReviewReply = {
  /** Null when the reply was posted outside this product and only marked as responded. */
  text: string | null;
  publishedAt: string;
  source: "manual" | "ai" | "automation" | "external";
};

export type ReplyDraft = {
  text: string;
  tone: ReplyTone;
  createdAt: string;
  source: "ai" | "automation";
};

export type Review = {
  id: string;
  locationId: string;
  platform: ReviewPlatform;
  customerName: string;
  /** 1–5 stars. */
  rating: number;
  text: string;
  createdAt: string;
  /** Null until the review has been analyzed. */
  analysis: ReviewAnalysis | null;
  responseStatus: ResponseStatus;
  reply: ReviewReply | null;
  draft: ReplyDraft | null;
  failureReason: string | null;
};

export type AutomationAction = "auto_publish" | "require_approval";

export type AutomationRule = {
  id: string;
  name: string;
  /** Star ratings this rule applies to. */
  ratings: number[];
  /** Empty means any sentiment. */
  sentiments: ReviewSentiment[];
  action: AutomationAction;
  tone: ReplyTone;
  enabled: boolean;
  createdAt: string;
};

export type ReplySettings = {
  defaultTone: ReplyTone;
  maxLength: number;
  includeBusinessName: boolean;
  includeCustomerName: boolean;
  /** Holds every automated reply for approval, overriding rules that publish automatically. */
  requireApproval: boolean;
};

export type ReviewAutomation = {
  enabled: boolean;
  rules: AutomationRule[];
  settings: ReplySettings;
};

export type ReviewDataset = {
  locationId: string;
  businessName: string;
  reviews: Review[];
  lastSyncedAt: string | null;
  /** Null until reviews have been analyzed at least once. */
  analyzedAt: string | null;
  automation: ReviewAutomation;
};

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export const SENTIMENTS: ReviewSentiment[] = ["positive", "neutral", "negative"];

export const SENTIMENT_LABEL: Record<ReviewSentiment, string> = { positive: "Positive", neutral: "Neutral", negative: "Negative" };

export const SENTIMENT_TONE: Record<ReviewSentiment, StatusTone> = { positive: "success", neutral: "neutral", negative: "critical" };

/** Series colour per sentiment, reused by every chart. */
export const SENTIMENT_COLOR: Record<ReviewSentiment, string> = {
  positive: "var(--success)",
  neutral: "var(--muted-foreground)",
  negative: "var(--critical)",
};

export const TOPICS: ReviewTopic[] = ["service", "staff", "quality", "price", "waiting_time", "location"];

export const TOPIC_LABEL: Record<ReviewTopic, string> = {
  service: "Service",
  staff: "Staff",
  quality: "Quality",
  price: "Price",
  waiting_time: "Waiting Time",
  location: "Location",
};

export const RESPONSE_STATUSES: ResponseStatus[] = ["needs_response", "ai_draft", "pending_approval", "replied", "auto_replied", "failed"];

export const RESPONSE_STATUS_LABEL: Record<ResponseStatus, string> = {
  needs_response: "Needs Response",
  ai_draft: "AI Draft",
  pending_approval: "Pending Approval",
  replied: "Replied",
  auto_replied: "Auto Replied",
  failed: "Failed",
};

export const RESPONSE_STATUS_TONE: Record<ResponseStatus, StatusTone> = {
  needs_response: "warning",
  ai_draft: "brand",
  pending_approval: "info",
  replied: "success",
  auto_replied: "success",
  failed: "critical",
};

export const PLATFORM_LABEL: Record<ReviewPlatform, string> = { google: "Google" };

export const REPLY_TONES: ReplyTone[] = ["professional", "friendly", "short", "warm"];

export const REPLY_TONE_LABEL: Record<ReplyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  short: "Short",
  warm: "Warm",
};

export const AUTOMATION_ACTION_LABEL: Record<AutomationAction, string> = {
  auto_publish: "Automatically publish",
  require_approval: "Require approval",
};

export const REPLY_LENGTH_LIMITS = { min: 100, max: 1000 } as const;

/* -------------------------------------------------------------------------- */
/* Review predicates                                                          */
/* -------------------------------------------------------------------------- */

/** Statuses that still need a published reply. */
export function awaitingReply(status: ResponseStatus) {
  return status !== "replied" && status !== "auto_replied";
}

/** Negative reviews always go through approval; they are never auto-published. */
export function isNegativeReview(review: Pick<Review, "rating" | "analysis">) {
  return review.rating <= 2 || review.analysis?.sentiment === "negative";
}

/** Whether a rule can safely publish without approval. */
export function ruleCoversNegative(rule: Pick<AutomationRule, "ratings" | "sentiments">) {
  return rule.ratings.some((r) => r <= 2) || rule.sentiments.includes("negative");
}

export function describeRatings(ratings: number[]): string {
  const sorted = [...ratings].sort((a, b) => a - b);
  if (sorted.length === 0) return "No ratings";
  if (sorted.length === 5) return "Any rating";
  const contiguous = sorted.every((r, i) => i === 0 || r === sorted[i - 1]! + 1);
  if (sorted.length === 1) return `${sorted[0]}-star reviews`;
  if (contiguous) return `${sorted[0]}–${sorted.at(-1)} star reviews`;
  return `${sorted.join(", ")} star reviews`;
}

export function describeSentiments(sentiments: ReviewSentiment[]): string {
  if (sentiments.length === 0 || sentiments.length === SENTIMENTS.length) return "Any sentiment";
  return `${SENTIMENTS.filter((s) => sentiments.includes(s)).map((s) => SENTIMENT_LABEL[s]).join(" or ")} sentiment`;
}

/** Whether new reviews are published without anyone approving them first. */
export function rulePublishesAutomatically(rule: AutomationRule, settings: ReplySettings) {
  return rule.action === "auto_publish" && !settings.requireApproval && !ruleCoversNegative(rule);
}

function ruleMatches(rule: AutomationRule, review: Review) {
  if (!rule.enabled || !rule.ratings.includes(review.rating)) return false;
  if (rule.sentiments.length === 0) return true;
  return review.analysis !== null && rule.sentiments.includes(review.analysis.sentiment);
}

/* -------------------------------------------------------------------------- */
/* Derived metrics                                                            */
/*                                                                            */
/* Every number on the dashboard is computed from the reviews here, so the UI */
/* never states a figure the data does not support.                           */
/* -------------------------------------------------------------------------- */

export function reviewsInBounds(reviews: Review[], bounds: DateBounds) {
  return reviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d >= bounds.from && d <= bounds.to;
  });
}

/** Same-length period immediately before `bounds`. */
function previousBounds(bounds: DateBounds): DateBounds {
  const days = differenceInCalendarDays(bounds.to, bounds.from) + 1;
  return { from: startOfDay(subDays(bounds.from, days)), to: endOfDay(subDays(bounds.from, 1)) };
}

function averageRating(reviews: Pick<Review, "rating">[]): number | null {
  if (reviews.length === 0) return null;
  return Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;
}

export type SentimentShares = Record<ReviewSentiment, number> & { analyzed: number };

/** Percentage of analyzed reviews per sentiment; null when nothing is analyzed. */
export function sentimentShares(reviews: Review[]): SentimentShares | null {
  const analyzed = reviews.filter((r) => r.analysis);
  if (analyzed.length === 0) return null;
  const count = (s: ReviewSentiment) => analyzed.filter((r) => r.analysis!.sentiment === s).length;
  const positive = Math.round((count("positive") / analyzed.length) * 100);
  const negative = Math.round((count("negative") / analyzed.length) * 100);
  // Neutral takes the rounding remainder so the three always add up to 100.
  return { positive, negative, neutral: 100 - positive - negative, analyzed: analyzed.length };
}

export type ReviewSummary = {
  total: number;
  newInRange: number;
  newChange: number | null;
  averageRating: number | null;
  /** Change in the all-time average since the start of the range, in stars. */
  ratingChange: number | null;
  sentiment: SentimentShares | null;
  positiveChange: number | null;
  negativeChange: number | null;
  awaitingReply: number;
  negativeAwaitingReply: number;
  draftsReady: number;
};

export function summarizeReviews(dataset: ReviewDataset, bounds: DateBounds): ReviewSummary {
  const { reviews } = dataset;
  const current = reviewsInBounds(reviews, bounds);
  const previous = reviewsInBounds(reviews, previousBounds(bounds));
  const beforeRange = reviews.filter((r) => new Date(r.createdAt) < bounds.from);
  const average = averageRating(reviews);
  const baseline = averageRating(beforeRange);
  const sentiment = sentimentShares(current);
  const previousSentiment = sentimentShares(previous);
  const waiting = reviews.filter((r) => awaitingReply(r.responseStatus));

  return {
    total: reviews.length,
    newInRange: current.length,
    newChange: previous.length ? current.length - previous.length : null,
    averageRating: average,
    ratingChange: average !== null && baseline !== null ? Math.round((average - baseline) * 10) / 10 : null,
    sentiment,
    positiveChange: sentiment && previousSentiment ? sentiment.positive - previousSentiment.positive : null,
    negativeChange: sentiment && previousSentiment ? sentiment.negative - previousSentiment.negative : null,
    awaitingReply: waiting.length,
    negativeAwaitingReply: waiting.filter(isNegativeReview).length,
    draftsReady: waiting.filter((r) => r.draft).length,
  };
}

export function ratingDistribution(reviews: Review[]): { rating: number; count: number; share: number }[] {
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((r) => r.rating === rating).length;
    return { rating, count, share: reviews.length ? count / reviews.length : 0 };
  });
}

export type TrendGranularity = "day" | "week" | "month";

export type TrendBucket = {
  start: string;
  label: string;
  reviews: number;
  /** Average rating of reviews received in this bucket. */
  averageRating: number | null;
  /** All-time average rating as of the end of this bucket. */
  cumulativeRating: number | null;
  positive: number | null;
  neutral: number | null;
  negative: number | null;
};

export function granularityFor(bounds: DateBounds): TrendGranularity {
  const days = differenceInCalendarDays(bounds.to, bounds.from) + 1;
  if (days <= 14) return "day";
  if (days <= 100) return "week";
  return "month";
}

function bucketStarts(bounds: DateBounds, granularity: TrendGranularity): Date[] {
  const starts: Date[] = [];
  let cursor = granularity === "month" ? startOfMonth(bounds.from) : startOfDay(bounds.from);
  while (cursor <= bounds.to) {
    starts.push(cursor);
    cursor = granularity === "day" ? addDays(cursor, 1) : granularity === "week" ? addWeeks(cursor, 1) : addMonths(cursor, 1);
  }
  return starts;
}

const BUCKET_LABEL: Record<TrendGranularity, string> = { day: "MMM d", week: "MMM d", month: "MMM yyyy" };

export function trendBuckets(reviews: Review[], bounds: DateBounds, granularity = granularityFor(bounds)): TrendBucket[] {
  const starts = bucketStarts(bounds, granularity);
  const sorted = [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return starts.map((start, i) => {
    const from = i === 0 ? bounds.from : start;
    const next = starts[i + 1];
    const to = next ? new Date(next.getTime() - 1) : bounds.to;
    const inBucket = sorted.filter((r) => {
      const d = new Date(r.createdAt);
      return d >= from && d <= to;
    });
    const shares = sentimentShares(inBucket);
    return {
      start: start.toISOString(),
      label: format(start, BUCKET_LABEL[granularity]),
      reviews: inBucket.length,
      averageRating: averageRating(inBucket),
      cumulativeRating: averageRating(sorted.filter((r) => new Date(r.createdAt) <= to)),
      positive: shares?.positive ?? null,
      neutral: shares?.neutral ?? null,
      negative: shares?.negative ?? null,
    };
  });
}

/** Monthly all-time average rating for the last 12 months. */
export function ratingTrend(reviews: Review[], now = new Date()): TrendBucket[] {
  return trendBuckets(reviews, { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) }, "month").map((b) => ({
    ...b,
    label: b.label.slice(0, 3),
  }));
}

export type TopicStat = {
  topic: ReviewTopic;
  mentions: number;
  positive: number;
  neutral: number;
  negative: number;
  /** The sentiment the topic is most often mentioned with. */
  sentiment: ReviewSentiment;
};

export function topicStats(reviews: Review[]): TopicStat[] {
  return TOPICS.map((topic) => {
    const mentions = reviews.flatMap((r) => r.analysis?.topics.filter((t) => t.topic === topic) ?? []);
    const count = (s: ReviewSentiment) => mentions.filter((m) => m.sentiment === s).length;
    const positive = count("positive");
    const neutral = count("neutral");
    const negative = count("negative");
    const sentiment: ReviewSentiment = positive >= negative && positive >= neutral ? "positive" : negative >= neutral ? "negative" : "neutral";
    return { topic, mentions: mentions.length, positive, neutral, negative, sentiment };
  })
    .filter((t) => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);
}

/** Neutral, factual observations derived from the reviews. No recommendations. */
export function reviewInsights(reviews: Review[], summary: ReviewSummary, topics: TopicStat[]): string[] {
  const insights: string[] = [];
  const [top] = topics;
  if (top) insights.push(`${TOPIC_LABEL[top.topic]} was mentioned in ${top.mentions} reviews in this period — more than any other topic.`);
  const mostNegative = [...topics].filter((t) => t.negative > 0).sort((a, b) => b.negative / b.mentions - a.negative / a.mentions)[0];
  if (mostNegative) {
    const share = Math.round((mostNegative.negative / mostNegative.mentions) * 100);
    insights.push(`${share}% of mentions of ${TOPIC_LABEL[mostNegative.topic].toLowerCase()} were negative, the highest share of any topic.`);
  }
  if (summary.positiveChange !== null) {
    insights.push(
      summary.positiveChange === 0
        ? "The share of positive reviews did not change compared with the previous period."
        : `The share of positive reviews ${summary.positiveChange > 0 ? "increased" : "decreased"} by ${Math.abs(summary.positiveChange)} points compared with the previous period.`,
    );
  }
  const negativeUnanswered = reviews.filter((r) => isNegativeReview(r) && awaitingReply(r.responseStatus)).length;
  if (reviews.length) {
    insights.push(
      negativeUnanswered === 1
        ? "1 negative review in this period has not received a reply yet."
        : `${negativeUnanswered} negative reviews in this period have not received a reply yet.`,
    );
  }
  return insights;
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/*                                                                            */
/* No review source is connected yet, so reviews live in a frontend-only      */
/* store seeded with demo data. Each action names the API it stands in for;   */
/* replace its body with the backend call when available.                     */
/* -------------------------------------------------------------------------- */

type ReviewState = {
  datasets: Record<string, ReviewDataset>;
  syncing: Record<string, boolean>;
  analyzing: Record<string, boolean>;
};

let state: ReviewState = { datasets: {}, syncing: {}, analyzing: {} };

const listeners = new Set<() => void>();
const pendingLoads = new Set<string>();

function setState(update: (current: ReviewState) => ReviewState) {
  state = update(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Review List API: simulates fetching a profile's reviews so loading states are exercised. */
function ensureLoaded(locationId: string) {
  if (state.datasets[locationId] || pendingLoads.has(locationId)) return;
  pendingLoads.add(locationId);
  window.setTimeout(() => {
    pendingLoads.delete(locationId);
    setState((s) => ({ ...s, datasets: { ...s.datasets, [locationId]: demoReviewDataset(locationId) } }));
  }, 700);
}

export function useReviewManagement(locationId: string | null) {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (locationId) ensureLoaded(locationId);
  }, [locationId]);
  const dataset = locationId ? (snapshot.datasets[locationId] ?? null) : null;
  return {
    status: dataset ? ("ready" as const) : ("loading" as const),
    dataset,
    syncing: locationId ? Boolean(snapshot.syncing[locationId]) : false,
    analyzing: locationId ? Boolean(snapshot.analyzing[locationId]) : false,
  };
}

function updateDataset(locationId: string, update: (dataset: ReviewDataset) => ReviewDataset) {
  const dataset = state.datasets[locationId];
  if (!dataset) return;
  setState((s) => ({ ...s, datasets: { ...s.datasets, [locationId]: update(dataset) } }));
}

function updateReview(reviewId: string, update: (review: Review) => Review) {
  const dataset = Object.values(state.datasets).find((d) => d.reviews.some((r) => r.id === reviewId));
  if (!dataset) return;
  updateDataset(dataset.locationId, (d) => ({ ...d, reviews: d.reviews.map((r) => (r.id === reviewId ? update(r) : r)) }));
}

function findReview(reviewId: string) {
  for (const dataset of Object.values(state.datasets)) {
    const review = dataset.reviews.find((r) => r.id === reviewId);
    if (review) return { review, dataset };
  }
  return null;
}

/** Applies the first matching automation rule to a newly synced review. */
function applyAutomation(review: Review, dataset: ReviewDataset, now: string): Review {
  const { automation } = dataset;
  if (!automation.enabled) return review;
  const rule = automation.rules.find((r) => ruleMatches(r, review));
  if (!rule) return review;
  const text = demoReplyText({ review, tone: rule.tone, settings: automation.settings, businessName: dataset.businessName, variant: review.rating });
  if (rulePublishesAutomatically(rule, automation.settings) && !isNegativeReview(review)) {
    return { ...review, responseStatus: "auto_replied", reply: { text, publishedAt: now, source: "automation" } };
  }
  return { ...review, responseStatus: "pending_approval", draft: { text, tone: rule.tone, createdAt: now, source: "automation" } };
}

const SYNC_DURATION_MS = 1800;
const ANALYSIS_DURATION_MS = 2200;
const REPLY_DURATION_MS = 1200;
const PUBLISH_DURATION_MS = 900;

export type ReplyInput = { text: string; source: ReviewReply["source"] };

export const reviewActions = {
  /** Review Sync API: pulls new reviews from Google Business Profile. Resolves with the synced total. */
  async syncReviews(locationId: string): Promise<{ total: number; added: number }> {
    setState((s) => ({ ...s, syncing: { ...s.syncing, [locationId]: true } }));
    try {
      await delay(SYNC_DURATION_MS);
      const dataset = state.datasets[locationId];
      if (!dataset) return { total: 0, added: 0 };
      const now = new Date().toISOString();
      const incoming = demoSyncReviews(dataset).map((r) => applyAutomation(r, dataset, now));
      const reviews = [...incoming, ...dataset.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      updateDataset(locationId, (d) => ({ ...d, reviews, lastSyncedAt: now }));
      return { total: reviews.length, added: incoming.length };
    } finally {
      setState((s) => ({ ...s, syncing: { ...s.syncing, [locationId]: false } }));
    }
  },

  /** AI Sentiment + Topic Analysis APIs: analyzes every review on the profile. Resolves with the count. */
  async analyzeReviews(locationId: string): Promise<number> {
    setState((s) => ({ ...s, analyzing: { ...s.analyzing, [locationId]: true } }));
    try {
      await delay(ANALYSIS_DURATION_MS);
      const dataset = state.datasets[locationId];
      if (!dataset) return 0;
      const now = new Date().toISOString();
      updateDataset(locationId, (d) => ({
        ...d,
        analyzedAt: now,
        reviews: d.reviews.map((r) => ({ ...r, analysis: demoAnalyzeReview(r, now) })),
      }));
      return dataset.reviews.length;
    } finally {
      setState((s) => ({ ...s, analyzing: { ...s.analyzing, [locationId]: false } }));
    }
  },

  /** AI Reply Generation API. `variant` asks for different wording on regenerate. Saves the result as a draft. */
  async generateReply(reviewId: string, tone: ReplyTone, variant = 0): Promise<string> {
    await delay(REPLY_DURATION_MS);
    const found = findReview(reviewId);
    if (!found) throw new Error("Review not found");
    const { review, dataset } = found;
    const text = demoReplyText({ review, tone, settings: dataset.automation.settings, businessName: dataset.businessName, variant });
    reviewActions.saveDraft(reviewId, text, tone);
    return text;
  },

  /** Keeps an edited AI reply as a draft without publishing it. */
  saveDraft(reviewId: string, text: string, tone: ReplyTone) {
    updateReview(reviewId, (r) => ({
      ...r,
      draft: { text, tone, createdAt: new Date().toISOString(), source: "ai" },
      // Negative reviews wait for approval; nothing is published until someone approves it.
      responseStatus: awaitingReply(r.responseStatus) ? (isNegativeReview(r) ? "pending_approval" : "ai_draft") : r.responseStatus,
      failureReason: null,
    }));
  },

  /** Reply/Publish API: posts the reply to Google Business Profile. */
  async publishReply(reviewId: string, input: ReplyInput): Promise<void> {
    await delay(PUBLISH_DURATION_MS);
    updateReview(reviewId, (r) => ({
      ...r,
      responseStatus: "replied",
      reply: { text: input.text, publishedAt: new Date().toISOString(), source: input.source },
      draft: null,
      failureReason: null,
    }));
  },

  /** Records a reply that was posted outside this product. */
  markResponded(reviewId: string) {
    updateReview(reviewId, (r) => ({
      ...r,
      responseStatus: "replied",
      reply: { text: null, publishedAt: new Date().toISOString(), source: "external" },
      draft: null,
      failureReason: null,
    }));
  },

  /* Automation Rules API ---------------------------------------------------- */

  saveRule(locationId: string, input: Omit<AutomationRule, "id" | "createdAt">, ruleId?: string) {
    updateDataset(locationId, (d) => {
      const rules = ruleId
        ? d.automation.rules.map((r) => (r.id === ruleId ? { ...r, ...input } : r))
        : [...d.automation.rules, { ...input, id: `rule_${Date.now().toString(36)}`, createdAt: new Date().toISOString() }];
      return { ...d, automation: { ...d.automation, rules } };
    });
  },

  deleteRule(locationId: string, ruleId: string) {
    updateDataset(locationId, (d) => ({ ...d, automation: { ...d.automation, rules: d.automation.rules.filter((r) => r.id !== ruleId) } }));
  },

  setRuleEnabled(locationId: string, ruleId: string, enabled: boolean) {
    updateDataset(locationId, (d) => ({
      ...d,
      automation: { ...d.automation, rules: d.automation.rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)) },
    }));
  },

  setAutomationEnabled(locationId: string, enabled: boolean) {
    updateDataset(locationId, (d) => ({ ...d, automation: { ...d.automation, enabled } }));
  },

  async saveReplySettings(locationId: string, settings: ReplySettings): Promise<void> {
    await delay(PUBLISH_DURATION_MS);
    updateDataset(locationId, (d) => ({ ...d, automation: { ...d.automation, settings } }));
  },
};
