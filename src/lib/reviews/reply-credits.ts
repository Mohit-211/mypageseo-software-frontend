/**
 * AI replies and analyses in blocks of 10 per location (2026-11-17 entry, section 2: "1 token = 10 replies").
 *
 * Every review the AI drafts uses one of the location's AI replies (a Draft, each "Draft all" page, "Change it",
 * an automatic reply). When none is left, the next reply buys a block of `credits.block_size` (10) for
 * `token_costs.reply_drafts_per_10` tokens (1 by default; a plan can set 0–100, so never hard-code it). What is
 * left stays with the location; a reply that fails or is skipped goes back, and a block nobody used is refunded.
 * Analyze has blocks of its own (`analyses_left`, `analysis_per_10`).
 *
 * Read the counters from `GET …/reviews/summary` → `ai.credits` and `ai.token_costs`; the drafts, "Draft all",
 * "Change it" and Analyze answers carry `replies_left` / `analyses_left` (write them into the cached summary with
 * `withCreditsLeft`). Pure helpers: no React, no fetching.
 */
import { apiErrorData, isApiError, type InsufficientCreditsData, type ReplyCredits, type ReviewsSummary } from "@/api";

/** The default block size (`credits.block_size`), for a server that doesn't send it. */
export const DEFAULT_BLOCK_SIZE = 10;

/**
 * Reviews per drafts / Analyze request and per "Draft all" page when the summary doesn't say
 * (`ai.draft_all_max`: 6 by default since Phase 25b, a server setting of 1–50: read the field).
 */
export const DEFAULT_DRAFT_ALL_MAX = 6;

/** `ai.draft_all_max` from the summary, else the default: the most ids one drafts or Analyze request may carry. */
export function draftBatchSize(summary: Pick<ReviewsSummary, "ai"> | null | undefined): number {
  const max = summary?.ai?.draft_all_max;
  return typeof max === "number" && Number.isInteger(max) && max > 0 ? max : DEFAULT_DRAFT_ALL_MAX;
}

type CreditsLike = Partial<Pick<ReplyCredits, "block_size" | "replies_left" | "analyses_left">> | null | undefined;

const COUNT = new Intl.NumberFormat("en-US");
const plural = (n: number, one: string, many: string) => `${COUNT.format(n)} ${n === 1 ? one : many}`;
const tokensText = (n: number) => plural(n, "token", "tokens");
const repliesText = (n: number) => plural(n, "reply", "replies");
const analysesText = (n: number) => plural(n, "analysis", "analyses");

function blockSizeOf(credits: CreditsLike): number {
  const size = credits?.block_size;
  return typeof size === "number" && size > 0 ? size : DEFAULT_BLOCK_SIZE;
}

const nonNegative = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0);

/** Tokens for `n` items with `left` left: ⌈max(0, n − left) ÷ block⌉ × price. */
function blocksCost(n: number, left: number, blockSize: number, pricePerBlock: number): number {
  const missing = Math.max(0, nonNegative(n) - nonNegative(left));
  return missing === 0 ? 0 : Math.ceil(missing / blockSize) * nonNegative(pricePerBlock);
}

/**
 * Tokens a click on `n` reviews costs: ⌈max(0, n − replies_left) ÷ block_size⌉ × `reply_drafts_per_10`. Nothing
 * while `n` or more replies are left. Without `credits` (a server before 2026-11-17) none are counted as left.
 */
export function replyDraftCost(n: number, credits: CreditsLike, pricePer10: number): number {
  return blocksCost(n, credits?.replies_left ?? 0, blockSizeOf(credits), pricePer10);
}

/** Tokens Analyze on `n` reviews costs: the same rule with `analyses_left` and `analysis_per_10` (reused analyses are free: count only new ones). */
export function analysisCost(n: number, credits: CreditsLike, pricePer10: number): number {
  return blocksCost(n, credits?.analyses_left ?? 0, blockSizeOf(credits), pricePer10);
}

/**
 * How many reviews "Draft all" would draft: the summary's `draftable`, plus, with `include_stars_only`, the
 * stars-only 4–5★ reviews it adds (at most `stars_only_draftable`, within this week's `stars_only_left`).
 */
export function draftAllCount(summary: Pick<ReviewsSummary, "ai"> | null | undefined, options: { includeStarsOnly?: boolean } = {}): number {
  const ai = summary?.ai;
  if (!ai) return 0;
  const starsOnly = options.includeStarsOnly ? Math.min(nonNegative(ai.stars_only_draftable), nonNegative(ai.stars_only_left)) : 0;
  return nonNegative(ai.draftable) + starsOnly;
}

/**
 * Tokens "Draft all" would cost (an upper bound: a review the analysis flags gives its reply back). With the
 * credits known it is `replyDraftCost(draftAllCount(…))`; on an older server, the summary's `draft_all_cost`.
 */
export function draftAllCost(summary: Pick<ReviewsSummary, "ai"> | null | undefined, options: { includeStarsOnly?: boolean } = {}): number {
  const ai = summary?.ai;
  if (!ai) return 0;
  if (!ai.credits) return nonNegative(ai.draft_all_cost);
  return replyDraftCost(draftAllCount(summary, options), ai.credits, ai.token_costs?.reply_drafts_per_10 ?? 0);
}

export type CreditsText = {
  /** "AI replies left: 4" / "AI analyses left: 0". */
  left: string;
  /** The block's price: "1 token = 10 replies", "2 tokens = 10 replies", or "Free on your plan" at price 0. */
  price: string;
};

/**
 * The counter and the price, from the fields (never hard-coded): `kind` "replies" reads `replies_left` and
 * `reply_drafts_per_10`, "analyses" reads `analyses_left` and `analysis_per_10`.
 */
export function creditsText(
  credits: CreditsLike,
  costs: { reply_drafts_per_10?: number; analysis_per_10?: number } | null | undefined,
  kind: "replies" | "analyses" = "replies",
): CreditsText {
  const blockSize = blockSizeOf(credits);
  if (kind === "analyses") {
    const price = nonNegative(costs?.analysis_per_10);
    return {
      left: `AI analyses left: ${COUNT.format(nonNegative(credits?.analyses_left))}`,
      price: price === 0 ? "Free on your plan" : `${tokensText(price)} = ${analysesText(blockSize)}`,
    };
  }
  const price = nonNegative(costs?.reply_drafts_per_10);
  return {
    left: `AI replies left: ${COUNT.format(nonNegative(credits?.replies_left))}`,
    price: price === 0 ? "Free on your plan" : `${tokensText(price)} = ${repliesText(blockSize)}`,
  };
}

/**
 * What one AI reply (or analysis) button costs, for its chip: the tokens the click spends, or, while the location's
 * replies left cover it, how many are left ("4 left": no tokens). Never "Free" unless the plan's price is 0.
 */
export type CreditCost = {
  /** Tokens the click spends: 0 while the replies (analyses) left cover it, or at price 0. */
  tokens: number;
  /** `tokens`: it buys blocks; `left`: the replies left cover it; `free`: the plan's price is 0. */
  kind: "tokens" | "left" | "free";
  /** The chip's words: "1 token", "4 left", "Free". */
  chip: string;
  /** One sentence for the tooltip and screen readers: "Uses 1 of your 4 AI replies left." */
  detail: string;
};

/**
 * The chip of a button that drafts `n` replies (`kind` "replies") or analyses `n` reviews ("analyses"). Without
 * `credits` (a server before 2026-11-17) none are counted as left, so the chip shows the tokens.
 */
export function creditCost(
  n: number,
  credits: CreditsLike,
  pricePer10: number | null | undefined,
  kind: "replies" | "analyses" = "replies",
): CreditCost {
  const price = nonNegative(pricePer10);
  const name = kind === "analyses" ? "AI analyses" : "AI replies";
  if (price === 0) return { tokens: 0, kind: "free", chip: "Free", detail: `${name} are free on your plan.` };
  const count = Math.max(1, Math.round(nonNegative(n)));
  const blockSize = blockSizeOf(credits);
  const leftValue = kind === "analyses" ? credits?.analyses_left : credits?.replies_left;
  const known = typeof leftValue === "number" && Number.isFinite(leftValue);
  const left = known ? nonNegative(leftValue) : 0;
  const tokens = blocksCost(count, left, blockSize, price);
  if (tokens === 0) {
    return {
      tokens: 0,
      kind: "left",
      chip: `${COUNT.format(left)} left`,
      detail: `Uses ${COUNT.format(count)} of your ${COUNT.format(left)} ${name} left. No tokens needed.`,
    };
  }
  const bought = COUNT.format(Math.ceil(Math.max(0, count - left) / blockSize) * blockSize);
  const buys = `${tokensText(tokens)} ${tokens === 1 ? "buys" : "buy"} ${bought} more`;
  return {
    tokens,
    kind: "tokens",
    chip: tokensText(tokens),
    detail: left > 0 ? `Uses your ${COUNT.format(left)} ${name} left, then ${buys}.` : `${buys} ${name}.`,
  };
}

/** The 402 `insufficient_tokens` body of a reply or analysis route, or null for any other error. */
export function insufficientCreditsData(error: unknown): InsufficientCreditsData | null {
  if (!isApiError(error) || error.reason !== "insufficient_tokens") return null;
  const data = apiErrorData(error);
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
  const cost = num(data.cost);
  const balance = num(data.balance);
  if (cost === undefined || balance === undefined) return null;
  const reviews = num(data.reviews);
  const repliesLeft = num(data.replies_left);
  const analysesLeft = num(data.analyses_left);
  return {
    reason: "insufficient_tokens",
    cost,
    balance,
    ...(reviews === undefined ? {} : { reviews }),
    ...(repliesLeft === undefined ? {} : { replies_left: repliesLeft }),
    ...(analysesLeft === undefined ? {} : { analyses_left: analysesLeft }),
  };
}

/**
 * The 402's message from its fields: "2 replies left, 6 needed: 1 token buys 10 more" (Analyze: "analyses").
 * `blockSize` is the summary's `credits.block_size` (10 by default). Null when the error isn't this 402 or lacks
 * the counts (an older server: fall back to the AI copy deck). Add "Buy tokens" (or "Ask the account owner")
 * next to it, by role.
 */
export function insufficientCreditsText(error: unknown, options: { blockSize?: number } = {}): string | null {
  const data = insufficientCreditsData(error);
  if (!data || data.reviews === undefined) return null;
  const analyses = data.analyses_left !== undefined && data.replies_left === undefined;
  const left = analyses ? data.analyses_left : data.replies_left;
  if (left === undefined) return null;
  const blockSize = options.blockSize && options.blockSize > 0 ? options.blockSize : DEFAULT_BLOCK_SIZE;
  const missing = Math.max(0, data.reviews - left);
  const more = Math.ceil(missing / blockSize) * blockSize;
  const things = analyses ? analysesText : repliesText;
  const buys = data.cost === 1 ? "buys" : "buy";
  return `${things(left)} left, ${COUNT.format(data.reviews)} needed: ${tokensText(data.cost)} ${buys} ${COUNT.format(more)} more`;
}

/**
 * The summary with the counters an answer reported (`replies_left`, `analyses_left`), for writing into the cached
 * `GET …/reviews/summary` after a drafts, "Draft all", "Change it" or Analyze call. Unchanged when the answer has
 * neither, or the summary has no `credits` (an older server).
 */
export function withCreditsLeft<T extends Pick<ReviewsSummary, "ai">>(
  summary: T,
  answer: { replies_left?: number | null; analyses_left?: number | null },
): T {
  const credits = summary.ai?.credits;
  const replies = answer.replies_left;
  const analyses = answer.analyses_left;
  if (!credits || (typeof replies !== "number" && typeof analyses !== "number")) return summary;
  return {
    ...summary,
    ai: {
      ...summary.ai,
      credits: {
        ...credits,
        ...(typeof replies === "number" ? { replies_left: replies } : {}),
        ...(typeof analyses === "number" ? { analyses_left: analyses } : {}),
      },
    },
  };
}
