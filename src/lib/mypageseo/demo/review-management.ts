/**
 * Demo Review Management data: Google Business Profile reviews, customers,
 * reply history, AI analysis, AI reply suggestions and automation rules.
 *
 * Everything here is sample data. No review source or AI provider is called;
 * review text is composed from topic phrases so the simulated analysis
 * (sentiment, topics, summary) always agrees with what the review says.
 */
import { addHours, addMinutes, setHours, setMinutes, startOfDay, subDays, subHours, subMinutes } from "date-fns";
import { pickInt, pickOne, rng, seedFrom } from "./demo-mode";
import { demoLocation } from "./entities";
import type {
  AutomationRule,
  ReplySettings,
  ReplyTone,
  Review,
  ReviewAnalysis,
  ReviewDataset,
  ReviewSentiment,
  ReviewTopic,
  ResponseStatus,
} from "../../reviews/review-management";

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

const FIRST_NAMES = [
  "Sarah", "John", "Michael", "Jessica", "David", "Amanda", "Chris", "Emily", "Brian", "Nicole", "Kevin", "Rachel",
  "Jason", "Laura", "Andrew", "Megan", "Tyler", "Danielle", "Ryan", "Ashley", "Marcus", "Grace", "Jordan", "Olivia",
  "Sean", "Priya", "Carlos", "Hannah", "Derek", "Monica", "Alex", "Fatima", "Wei", "Isabel", "Omar", "Tanya",
];
const LAST_INITIALS = ["M.", "D.", "T.", "R.", "K.", "S.", "B.", "L.", "H.", "W.", "P.", "G.", "C.", "N.", "F.", "A."];

/* -------------------------------------------------------------------------- */
/* Review text                                                                */
/* -------------------------------------------------------------------------- */

type Phrase = { text: string; topic: ReviewTopic; sentiment: ReviewSentiment };

/** Every phrase names its topic, so keyword analysis below finds it again. */
const PHRASES: Phrase[] = [
  // Service
  { topic: "service", sentiment: "positive", text: "Amazing service from start to finish." },
  { topic: "service", sentiment: "positive", text: "Service was quick, professional and thorough." },
  { topic: "service", sentiment: "positive", text: "The service went above and beyond what I expected." },
  { topic: "service", sentiment: "neutral", text: "Service was fine, nothing out of the ordinary." },
  { topic: "service", sentiment: "negative", text: "Service felt rushed and impersonal." },
  { topic: "service", sentiment: "negative", text: "Follow-up service was nonexistent after my visit." },
  // Staff
  { topic: "staff", sentiment: "positive", text: "Very friendly staff who made me feel welcome." },
  { topic: "staff", sentiment: "positive", text: "The team explained everything clearly and patiently." },
  { topic: "staff", sentiment: "positive", text: "Front desk staff were incredibly helpful." },
  { topic: "staff", sentiment: "neutral", text: "Staff were polite but seemed busy." },
  { topic: "staff", sentiment: "negative", text: "The receptionist was dismissive when I asked a question." },
  { topic: "staff", sentiment: "negative", text: "Staff didn't seem to communicate with each other." },
  // Quality
  { topic: "quality", sentiment: "positive", text: "The quality of work was excellent." },
  { topic: "quality", sentiment: "positive", text: "Results were even better than I hoped." },
  { topic: "quality", sentiment: "neutral", text: "Quality was about what I expected." },
  { topic: "quality", sentiment: "negative", text: "Had to come back because the job wasn't done right." },
  // Price
  { topic: "price", sentiment: "positive", text: "Pricing was fair and explained upfront." },
  { topic: "price", sentiment: "neutral", text: "Prices are a bit high, but about average for the area." },
  { topic: "price", sentiment: "negative", text: "The final bill was higher than the quote." },
  { topic: "price", sentiment: "negative", text: "Felt overcharged for what was done." },
  // Waiting time
  { topic: "waiting_time", sentiment: "positive", text: "Got in right on time with no wait." },
  { topic: "waiting_time", sentiment: "neutral", text: "The wait was a little long but they kept me updated." },
  { topic: "waiting_time", sentiment: "negative", text: "Had to wait for a long time before getting service." },
  { topic: "waiting_time", sentiment: "negative", text: "Waited over 40 minutes past my appointment time." },
  // Location
  { topic: "location", sentiment: "positive", text: "Convenient location with easy parking." },
  { topic: "location", sentiment: "positive", text: "Easy to find, and the space is clean and comfortable." },
  { topic: "location", sentiment: "neutral", text: "Parking can be tricky at busy times." },
  { topic: "location", sentiment: "negative", text: "Parking was a nightmare and the entrance is hard to find." },
];

/** Industry-specific first sentences, free of topic keywords. */
const OPENERS: Record<string, string[]> = {
  cl_riverside: ["Came in for a routine cleaning.", "Had a crown replaced here last week.", "Brought my kids in for their checkups.", "Visited for a tooth that had been bothering me."],
  cl_hearth: ["Came in for dinner with my family.", "Stopped by for weekend brunch.", "Celebrated a birthday here on Friday.", "Grabbed lunch with coworkers."],
  cl_summit: ["Brought my car in for new brakes.", "Took my truck in for an oil change.", "Had my check engine light looked at.", "Dropped off my SUV for a tire rotation."],
  cl_lumen: ["Hired them for my custody case.", "Used them for a prenuptial agreement.", "Worked with them on my divorce settlement.", "Consulted them about a child support change."],
};

/** Rating mix per location rating band: 5★ … 1★ shares. */
function ratingWeights(rating: number): number[] {
  if (rating >= 4.6) return [0.74, 0.17, 0.05, 0.02, 0.02];
  if (rating >= 4.2) return [0.6, 0.22, 0.09, 0.05, 0.04];
  return [0.48, 0.24, 0.12, 0.08, 0.08];
}

function phrasesFor(topic: ReviewTopic | null, sentiment: ReviewSentiment, exclude: Set<ReviewTopic>) {
  return PHRASES.filter((p) => p.sentiment === sentiment && (topic ? p.topic === topic : !exclude.has(p.topic)));
}

/** Builds review text whose phrase sentiments fit the star rating. */
function composeReviewText(seed: number, rating: number, clientId: string): string {
  const next = rng(seed);
  const used = new Set<ReviewTopic>();
  const parts: string[] = [];
  const add = (sentiment: ReviewSentiment) => {
    const options = phrasesFor(null, sentiment, used);
    if (options.length === 0) return;
    const phrase = options[Math.floor(next() * options.length)]!;
    used.add(phrase.topic);
    parts.push(phrase.text);
  };

  if (rating === 5) {
    add("positive");
    add("positive");
    if (next() < 0.4) add("positive");
  } else if (rating === 4) {
    add("positive");
    if (next() < 0.5) add("positive");
    // Some 4-star reviews mention one real complaint.
    add(next() < 0.4 ? "negative" : "neutral");
  } else if (rating === 3) {
    add("positive");
    add("negative");
    if (next() < 0.5) add("neutral");
  } else {
    add("negative");
    add("negative");
    if (rating === 2 && next() < 0.4) add("neutral");
  }

  const openers = OPENERS[clientId] ?? OPENERS.cl_riverside!;
  if (next() < 0.45) parts.unshift(openers[Math.floor(next() * openers.length)]!);
  return parts.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Simulated AI analysis                                                      */
/* -------------------------------------------------------------------------- */

const TOPIC_PATTERNS: [ReviewTopic, RegExp][] = [
  ["service", /service/i],
  ["staff", /staff|team|receptionist|front desk/i],
  ["quality", /quality|results|done right/i],
  ["price", /pric|bill|quote|overcharged|cost/i],
  ["waiting_time", /wait|on time/i],
  ["location", /parking|location|easy to find|entrance/i],
];

const NEGATIVE_CUES = /rushed|impersonal|nonexistent|dismissive|didn't|wasn't|higher than|overcharged|long time|over \d+ minutes|nightmare|hard to find/i;
const POSITIVE_CUES = /amazing|quick|above and beyond|friendly|welcome|clearly|helpful|excellent|better than|fair|on time|convenient|clean|comfortable/i;

const POSITIVE_PHRASE: Record<ReviewTopic, string> = {
  service: "level of service",
  staff: "friendly staff",
  quality: "quality of work",
  price: "fair pricing",
  waiting_time: "short wait",
  location: "convenient location",
};

const NEGATIVE_PHRASE: Record<ReviewTopic, string> = {
  service: "the service experience",
  staff: "interactions with staff",
  quality: "the quality of work",
  price: "pricing and billing",
  waiting_time: "long wait times",
  location: "parking and access",
};

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function sentenceSentiment(sentence: string): ReviewSentiment {
  if (NEGATIVE_CUES.test(sentence)) return "negative";
  if (POSITIVE_CUES.test(sentence)) return "positive";
  return "neutral";
}

/** Keyword-based stand-in for the AI sentiment and topic analysis API. */
export function demoAnalyzeReview(review: Pick<Review, "text" | "rating">, analyzedAt: string): ReviewAnalysis {
  const sentences = review.text.match(/[^.!?]+[.!?]*/g) ?? [review.text];
  const topics: ReviewAnalysis["topics"] = [];
  for (const sentence of sentences) {
    for (const [topic, pattern] of TOPIC_PATTERNS) {
      if (pattern.test(sentence) && !topics.some((t) => t.topic === topic)) {
        topics.push({ topic, sentiment: sentenceSentiment(sentence) });
      }
    }
  }

  const negatives = topics.filter((t) => t.sentiment === "negative").length;
  const positives = topics.filter((t) => t.sentiment === "positive").length;
  let sentiment: ReviewSentiment;
  if (review.rating >= 5) sentiment = "positive";
  else if (review.rating === 4) sentiment = negatives > 0 ? "neutral" : "positive";
  else if (review.rating === 3) sentiment = negatives > positives ? "negative" : "neutral";
  else sentiment = "negative";

  const good = topics.filter((t) => t.sentiment === "positive").map((t) => POSITIVE_PHRASE[t.topic]);
  const bad = topics.filter((t) => t.sentiment === "negative").map((t) => NEGATIVE_PHRASE[t.topic]);
  let summary: string;
  if (sentiment === "positive") {
    summary = good.length ? `Customer highlighted the ${joinList(good)}.` : "Customer shared a positive overall experience.";
  } else if (sentiment === "negative") {
    summary = bad.length ? `Customer raised concerns about ${joinList(bad)}.` : "Customer was dissatisfied with the overall experience.";
    if (good.length) summary += ` They were positive about the ${joinList(good)}.`;
  } else {
    summary =
      good.length && bad.length
        ? `Customer described a mixed experience: positive about the ${joinList(good)}, but concerned about ${joinList(bad)}.`
        : "Customer described an average experience without strong praise or complaints.";
  }

  return { sentiment, topics, summary, analyzedAt };
}

/* -------------------------------------------------------------------------- */
/* Simulated AI replies                                                       */
/* -------------------------------------------------------------------------- */

const REPLY_TOPIC_PHRASE: Record<ReviewTopic, string> = {
  service: "our service",
  staff: "our team",
  quality: "the quality of our work",
  price: "our pricing",
  waiting_time: "how quickly we got you in",
  location: "our location",
};

type ReplyParts = { opening: string[]; middle: (topics: string) => string[]; closing: string[] };

const POSITIVE_REPLIES: Record<ReplyTone, ReplyParts> = {
  professional: {
    opening: ["Thank you for sharing your experience.", "Thank you for taking the time to leave a review.", "We appreciate your feedback."],
    middle: (t) => [
      `We're glad to hear that you enjoyed ${t}.`,
      `It's great to know that ${t} met your expectations.`,
      `We're pleased that ${t} stood out during your visit.`,
    ],
    closing: ["We look forward to welcoming you again.", "We hope to see you again soon.", "Thank you for choosing us."],
  },
  friendly: {
    opening: ["Thanks so much for the great review!", "Wow, thank you for the kind words!", "Thanks for stopping by and sharing this!"],
    middle: (t) => [`We're so happy you loved ${t}.`, `It made our day to hear about ${t}.`, `We love hearing that ${t} made a difference.`],
    closing: ["See you next time!", "Can't wait to see you again!", "Come back and see us soon!"],
  },
  short: {
    opening: ["Thank you for the review!", "Thanks for the kind words!", "We appreciate it!"],
    middle: () => [""],
    closing: ["See you again soon.", "Hope to see you again.", "Thanks for choosing us."],
  },
  warm: {
    opening: ["Thank you so much for your thoughtful review.", "Your kind words truly mean a lot to us.", "We're touched that you took the time to write this."],
    middle: (t) => [
      `Knowing that ${t} made your visit a good one is exactly why we do what we do.`,
      `Our whole team will be delighted to hear how much you appreciated ${t}.`,
      `It's wonderful to hear that ${t} made you feel looked after.`,
    ],
    closing: ["We can't wait to welcome you back.", "We'll be here whenever you need us.", "It's always a pleasure to have you with us."],
  },
};

const NEGATIVE_REPLIES: Record<ReplyTone, ReplyParts> = {
  professional: {
    opening: ["Thank you for your feedback, and we're sorry your visit didn't meet expectations.", "We appreciate you letting us know about your experience.", "Thank you for raising this with us."],
    middle: (t) => [
      `We're sorry to hear about ${t}. This isn't the standard we aim for, and we're reviewing it with our team.`,
      `Your comments about ${t} have been shared with our team so we can address them.`,
      `We take concerns about ${t} seriously and are looking into what happened.`,
    ],
    closing: ["Please contact us directly so we can make this right.", "We'd welcome the chance to discuss this with you directly.", "Please reach out to us so we can resolve this."],
  },
  friendly: {
    opening: ["Thanks for being honest with us, and we're sorry about this.", "We really appreciate you telling us about this.", "Thanks for the feedback, and we're sorry we let you down."],
    middle: (t) => [`We hate hearing about ${t}, and we're working on it.`, `That's not what we want for anyone, especially when it comes to ${t}.`, `We've passed your note about ${t} to the whole team.`],
    closing: ["Give us a call so we can make it up to you.", "We'd love the chance to make it right, so please reach out.", "Please get in touch so we can sort this out."],
  },
  short: {
    opening: ["We're sorry about your experience.", "Thank you for the feedback, and we apologize.", "We're sorry this happened."],
    middle: () => [""],
    closing: ["Please contact us so we can make it right.", "Please reach out so we can help.", "Please call us so we can resolve this."],
  },
  warm: {
    opening: ["We're truly sorry to read about your experience.", "Thank you for trusting us with this feedback, and we're so sorry.", "We're genuinely sorry your visit felt this way."],
    middle: (t) => [
      `Hearing about ${t} is difficult for us, because we want everyone to leave feeling cared for.`,
      `We understand how frustrating ${t} must have been, and we want to do better.`,
      `You deserved better when it came to ${t}, and we're taking that to heart.`,
    ],
    closing: ["We'd be grateful for the chance to speak with you and make things right.", "Please reach out to us personally so we can make this right.", "We hope you'll give us the chance to put this right."],
  },
};

const NEUTRAL_OPENING: Record<ReplyTone, string[]> = {
  professional: ["Thank you for your balanced feedback.", "Thank you for sharing both the positives and where we can improve."],
  friendly: ["Thanks for the honest review!", "Thanks for telling us what worked and what didn't!"],
  short: ["Thanks for the feedback.", "We appreciate the honest review."],
  warm: ["Thank you for taking the time to share such honest feedback.", "We truly appreciate you telling us about your visit."],
};

/** Greeting and sign-off sit on their own lines around the body. */
function fitToLength(greeting: string, sentences: string[], signOff: string, maxLength: number): string {
  const parts = sentences.filter(Boolean);
  const compose = () => [greeting, parts.join(" "), signOff].filter(Boolean).join("\n\n");
  let text = compose();
  // Drop middle sentences first so the reply keeps its opening and closing.
  while (text.length > maxLength && parts.length > 2) {
    parts.splice(Math.floor(parts.length / 2), 1);
    text = compose();
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** Stand-in for the AI reply generation API. `variant` changes the wording on regenerate. */
export function demoReplyText({
  review,
  tone,
  settings,
  businessName,
  variant,
}: {
  review: Pick<Review, "customerName" | "rating" | "analysis">;
  tone: ReplyTone;
  settings: Pick<ReplySettings, "maxLength" | "includeBusinessName" | "includeCustomerName">;
  businessName: string;
  variant: number;
}): string {
  const sentiment = review.analysis?.sentiment ?? (review.rating >= 4 ? "positive" : review.rating === 3 ? "neutral" : "negative");
  const topics = review.analysis?.topics ?? [];
  const pick = <T,>(items: T[]) => items[variant % items.length]!;
  const firstName = review.customerName.split(" ")[0];
  const greeting = settings.includeCustomerName && firstName ? `Hi ${firstName},` : "";
  const signOff = settings.includeBusinessName ? `— The ${businessName} team` : "";

  const sentences: string[] = [];
  if (sentiment === "positive") {
    const praised = topics.filter((t) => t.sentiment === "positive").map((t) => REPLY_TOPIC_PHRASE[t.topic]);
    const parts = POSITIVE_REPLIES[tone];
    sentences.push(pick(parts.opening), praised.length ? pick(parts.middle(joinList(praised.slice(0, 2)))) : "", pick(parts.closing));
  } else if (sentiment === "negative") {
    const concerns = topics.filter((t) => t.sentiment === "negative").map((t) => NEGATIVE_PHRASE[t.topic]);
    const parts = NEGATIVE_REPLIES[tone];
    sentences.push(pick(parts.opening), pick(parts.middle(joinList(concerns.slice(0, 2)) || "your experience")), pick(parts.closing));
  } else {
    const concerns = topics.filter((t) => t.sentiment === "negative").map((t) => NEGATIVE_PHRASE[t.topic]);
    sentences.push(
      pick(NEUTRAL_OPENING[tone]),
      concerns.length ? pick(NEGATIVE_REPLIES[tone].middle(joinList(concerns.slice(0, 2)))) : "",
      pick(POSITIVE_REPLIES[tone].closing),
    );
  }
  return fitToLength(greeting, sentences, signOff, settings.maxLength);
}

/* -------------------------------------------------------------------------- */
/* Automation defaults                                                        */
/* -------------------------------------------------------------------------- */

export const DEMO_REPLY_SETTINGS: ReplySettings = {
  defaultTone: "professional",
  maxLength: 300,
  includeBusinessName: true,
  includeCustomerName: true,
  requireApproval: true,
};

function demoAutomationRules(createdAt: string): AutomationRule[] {
  return [
    { id: "rule_5_star", name: "5-star positive reviews", ratings: [5], sentiments: ["positive"], action: "auto_publish", tone: "friendly", enabled: true, createdAt },
    { id: "rule_low_rating", name: "1–3 star reviews", ratings: [1, 2, 3], sentiments: [], action: "require_approval", tone: "professional", enabled: true, createdAt },
    { id: "rule_4_star", name: "4-star reviews", ratings: [4], sentiments: ["positive", "neutral"], action: "require_approval", tone: "warm", enabled: false, createdAt },
  ];
}

/* -------------------------------------------------------------------------- */
/* Datasets                                                                   */
/* -------------------------------------------------------------------------- */

const MAX_REVIEWS = 248;
const HISTORY_DAYS = 540;

const FAILURE_REASON = "Google Business Profile rejected the reply because the profile connection expired. Reconnect the profile and try again.";

/** Spreads `count` reviews over the history window, denser in recent months. */
function reviewDaysAgo(index: number, count: number, seed: number): number {
  const base = HISTORY_DAYS * Math.pow((index + 0.5) / count, 1.15);
  return Math.max(0, Math.round(base + (rng(seed)() - 0.5) * 3));
}

/** Exact rating counts from weights, shuffled deterministically. */
function ratingSequence(count: number, weights: number[], seed: number): number[] {
  const counts = weights.map((w) => Math.round(w * count));
  counts[0]! += count - counts.reduce((a, b) => a + b, 0);
  const sequence = counts.flatMap((n, i) => Array.from({ length: Math.max(0, n) }, () => 5 - i));
  const next = rng(seed);
  for (let i = sequence.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [sequence[i], sequence[j]] = [sequence[j]!, sequence[i]!];
  }
  return sequence;
}

type Featured = { customerName: string; rating: number; text: string; hoursAgo: number; status: ResponseStatus };

/** The newest reviews on the primary profile, matching the product brief's examples. */
const FEATURED: Featured[] = [
  { customerName: "Sarah M.", rating: 5, text: "Amazing service and very friendly staff. The quality of work was excellent and the whole team made me feel at ease.", hoursAgo: 5, status: "replied" },
  { customerName: "John D.", rating: 2, text: "Had to wait for a long time before getting service. Nobody at the front desk told us about the delay.", hoursAgo: 20, status: "needs_response" },
  { customerName: "Priya K.", rating: 5, text: "Amazing service and very friendly staff. Got in right on time with no wait.", hoursAgo: 30, status: "needs_response" },
];

function replyFor(review: Review, businessName: string, variant: number, publishedAt: string, source: "manual" | "automation") {
  return {
    text: demoReplyText({ review, tone: source === "automation" ? "friendly" : "professional", settings: DEMO_REPLY_SETTINGS, businessName, variant }),
    publishedAt,
    source,
  } as const;
}

/** Response state for the n-th newest generated review. */
function seededStatus(index: number, rating: number, seed: number): ResponseStatus {
  if (index < 22) {
    if (rating <= 2) return index % 2 === 0 ? "pending_approval" : "needs_response";
    if (index === 6) return "failed";
    if (index === 3 || index === 9 || index === 14) return "ai_draft";
    if (index === 1 || index === 11 || index === 18) return rating === 5 ? "auto_replied" : "replied";
    return "needs_response";
  }
  // Older reviews: a small backlog stays unanswered.
  const roll = pickInt(seed, 0, 99);
  if (roll < 1) return "needs_response";
  if (rating === 5 && roll < 40) return "auto_replied";
  return "replied";
}

function buildReviews(locationId: string, businessName: string, now: Date, analyzed: boolean): Review[] {
  const location = demoLocation(locationId);
  const count = Math.min(location.reviewCount, MAX_REVIEWS);
  const seedBase = seedFrom(location.id, "review-management");
  const isPrimary = location.id === "loc_riverside_north";
  const featured = isPrimary ? FEATURED : [];
  const ratings = ratingSequence(count - featured.length, ratingWeights(location.rating), seedBase);
  const analyzedAt = now.toISOString();

  const generated: Review[] = ratings.map((rating, index) => {
    const seed = seedBase + index * 131;
    const daysAgo = reviewDaysAgo(index, ratings.length, seed + 7) + (isPrimary ? 2 : 0);
    const posted = addMinutes(addHours(startOfDay(subDays(now, daysAgo)), pickInt(seed + 5, 8, 20)), pickInt(seed + 6, 0, 59));
    // Today's reviews can't be later than now.
    const createdAt = posted > now ? subHours(now, 2 + (index % 5)) : posted;
    const text = composeReviewText(seed + 1, rating, location.clientId);
    const customerName = `${pickOne(seed + 2, FIRST_NAMES)} ${pickOne(seed + 3, LAST_INITIALS)}`;
    const status = seededStatus(index, rating, seed + 4);
    return makeReview({ id: `rv_${location.id}_${index + 1}`, locationId, customerName, rating, text, createdAt: createdAt.toISOString(), status, businessName, analyzedAt, variant: index, now });
  });

  const top = featured.map((f, i) =>
    makeReview({ id: `rv_${location.id}_featured_${i + 1}`, locationId, customerName: f.customerName, rating: f.rating, text: f.text, createdAt: subHours(now, f.hoursAgo).toISOString(), status: f.status, businessName, analyzedAt, variant: i, now }),
  );

  const reviews = [...top, ...generated].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return analyzed ? reviews : reviews.map((r) => ({ ...r, analysis: null }));
}

function makeReview({
  id,
  locationId,
  customerName,
  rating,
  text,
  createdAt,
  status,
  businessName,
  analyzedAt,
  variant,
  now,
}: {
  id: string;
  locationId: string;
  customerName: string;
  rating: number;
  text: string;
  createdAt: string;
  status: ResponseStatus;
  businessName: string;
  analyzedAt: string;
  variant: number;
  now: Date;
}): Review {
  const review: Review = {
    id,
    locationId,
    platform: "google",
    customerName,
    rating,
    text,
    createdAt,
    analysis: null,
    responseStatus: status,
    reply: null,
    draft: null,
    failureReason: null,
  };
  review.analysis = demoAnalyzeReview(review, analyzedAt);
  const created = new Date(createdAt);
  // Replies land a few hours to two days after the review, never in the future.
  const repliedAt = new Date(Math.min(now.getTime(), created.getTime() + (3 + (variant % 45)) * 3_600_000)).toISOString();

  if (status === "replied") review.reply = replyFor(review, businessName, variant, repliedAt, "manual");
  if (status === "auto_replied") review.reply = replyFor(review, businessName, variant, repliedAt, "automation");
  if (status === "ai_draft" || status === "pending_approval" || status === "failed") {
    review.draft = {
      text: demoReplyText({ review, tone: "professional", settings: DEMO_REPLY_SETTINGS, businessName, variant }),
      tone: "professional",
      createdAt: repliedAt,
      source: status === "pending_approval" ? "automation" : "ai",
    };
  }
  if (status === "failed") review.failureReason = FAILURE_REASON;
  return review;
}

/** Last sync is today at 10:30 AM (or yesterday, before 10:30). */
function lastSyncTime(now: Date): Date {
  const today = setMinutes(setHours(startOfDay(now), 10), 30);
  return today > now ? subDays(today, 1) : today;
}

/**
 * Initial dataset for a profile. Active profiles are synced and analyzed;
 * profiles still being set up have never been synced, so they start empty.
 */
export function demoReviewDataset(locationId: string, now = new Date()): ReviewDataset {
  const location = demoLocation(locationId);
  const synced = location.state_ === "active";
  const syncedAt = lastSyncTime(now);
  return {
    locationId,
    businessName: location.businessName,
    reviews: synced ? buildReviews(locationId, location.businessName, now, true) : [],
    lastSyncedAt: synced ? syncedAt.toISOString() : null,
    analyzedAt: synced ? syncedAt.toISOString() : null,
    automation: {
      enabled: synced,
      rules: demoAutomationRules(subDays(now, 64).toISOString()),
      settings: DEMO_REPLY_SETTINGS,
    },
  };
}

const NEW_REVIEW_TEXTS: { rating: number; text: string }[] = [
  { rating: 5, text: "Very friendly staff who made me feel welcome. Service was quick, professional and thorough." },
  { rating: 4, text: "The quality of work was excellent. The wait was a little long but they kept me updated." },
  { rating: 5, text: "Convenient location with easy parking. The team explained everything clearly and patiently." },
  { rating: 1, text: "The final bill was higher than the quote. The receptionist was dismissive when I asked a question." },
];

/**
 * Stand-in for the review sync API. A profile that was never synced imports
 * its full history (unanalyzed, without AI drafts); otherwise 1–2 new reviews
 * arrive since the last sync.
 */
export function demoSyncReviews(dataset: ReviewDataset, now = new Date()): Review[] {
  if (dataset.reviews.length === 0) {
    return buildReviews(dataset.locationId, dataset.businessName, now, false).map((r) =>
      r.responseStatus === "ai_draft" || r.responseStatus === "pending_approval" || r.responseStatus === "failed"
        ? { ...r, responseStatus: "needs_response", draft: null, failureReason: null }
        : r,
    );
  }
  const syncIndex = dataset.reviews.filter((r) => r.id.includes("_sync_")).length;
  const count = 1 + (syncIndex % 2);
  return Array.from({ length: count }, (_, i) => {
    const n = syncIndex + i;
    const sample = NEW_REVIEW_TEXTS[n % NEW_REVIEW_TEXTS.length]!;
    const seed = seedFrom(dataset.locationId, "sync", n);
    const review: Review = {
      id: `rv_${dataset.locationId}_sync_${n + 1}`,
      locationId: dataset.locationId,
      platform: "google",
      customerName: `${pickOne(seed, FIRST_NAMES)} ${pickOne(seed + 1, LAST_INITIALS)}`,
      rating: sample.rating,
      text: sample.text,
      createdAt: subMinutes(now, 12 + i * 37).toISOString(),
      analysis: null,
      responseStatus: "needs_response",
      reply: null,
      draft: null,
      failureReason: null,
    };
    return dataset.analyzedAt ? { ...review, analysis: demoAnalyzeReview(review, now.toISOString()) } : review;
  });
}
