/**
 * What AI costs: MyPageSEO tokens per AI action, one list for every AI button, chip and price table.
 *
 * Where the numbers come from, per key (first answer wins; both read the same plan entitlement on the
 * backend, so they agree whenever both load):
 * 1. `GET billing` → `tokens.ai_costs` (owners and members; `useBilling()`, cached 60 s);
 * 2. the location's `GET reviews/summary` → `ai.token_costs` (every role; shared cache with the Reviews
 *    page via `reviewsSummaryQuery`);
 * 3. the backend defaults (`AI_TOKEN_COST_DEFAULTS`, backend `src/modules/billing/domain/constants.ts`).
 *    Admins can change prices per plan, so the defaults are only a fallback, never the source of truth.
 *
 * Since 2026-11-17 the plan has exactly six prices (`post_topics` is gone: post ideas are planned free), and AI
 * review replies and analyses are bought in blocks of 10 per location: `reply_drafts_per_10` buys 10 replies of
 * one location, which stay with it until used ("1 token = 10 replies"; `src/lib/reviews/reply-credits.ts` has the
 * per-location counters and the blocks math).
 *
 * Derived items (no plan key of their own):
 * - `post_revise`: "Change it" on a post (`ai-revise`) costs one post draft; a new picture for it costs
 *   `post_image` (an AI image only: a library photo, enhanced or not, is free);
 * - `auto_post`: each automatic post writes one draft, plus an AI image when its series has pictures on and no
 *   library photo fits;
 * - `post_ideas` and `keyword_suggestions`: free (ideas are planned per location; keyword ideas are limited to
 *   20 runs per location per UTC day, 429 `suggestion_limit_reached`).
 *
 * Also here: `formatTokens` ("1 token", "3 tokens", "Free") and `formatBlockPrice` ("1 token = 10 replies", with
 * `useAiBlockSize`). A block-priced item never shows a bare "1 token" as its price: that reads as a price per reply.
 * What a click on N reviews costs (the replies left count first) is `replyDraftCost` / `analysisCost` /
 * `draftAllCost` in `src/lib/reviews/reply-credits.ts`, with the location's counters (`creditCost` for its chip).
 */
import { useQuery } from "@tanstack/react-query";
import type { ReviewsSummary } from "@/api";
import { useBilling } from "@/lib/billing/use-billing";
import { DEFAULT_BLOCK_SIZE } from "@/lib/reviews/reply-credits";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";

/** The plan's AI price keys (`tokens.ai_costs`), as the backend names them: exactly these six since 2026-11-17. */
export type AiCostKey = "post_draft" | "post_image" | "reply_drafts_per_10" | "analysis_per_10" | "appeal" | "insights";

/**
 * Every priced AI action: the plan keys plus the items derived from them.
 *
 * `regenerate` is kept only so callers written before 2026-11-17 still compile ("Rewrite" is now "Change it",
 * `post_revise`, at the same price); it isn't in `AI_COST_ITEMS`. Post ideas (`post_ideas`) are free.
 */
export type AiCostItemId =
  | AiCostKey
  | "post_revise"
  | "post_ideas"
  | "auto_post"
  | "keyword_suggestions"
  /** @deprecated `ai-regenerate` is deleted: use `post_revise` ("Change it"). */
  | "regenerate";

/** Tokens per AI action, every item resolved (0 = free). */
export type AiCosts = Readonly<Record<AiCostItemId, number>>;

/** Backend defaults, used only when neither billing nor the reviews summary answered. */
export const AI_COST_DEFAULTS: Readonly<Record<AiCostKey, number>> = {
  post_draft: 1,
  post_image: 3,
  reply_drafts_per_10: 1,
  analysis_per_10: 1,
  appeal: 1,
  insights: 2,
};

const AI_COST_KEYS = Object.keys(AI_COST_DEFAULTS) as AiCostKey[];

export type AiCostItem = {
  id: AiCostItemId;
  /** Sentence case, for price lists and tooltips. */
  label: string;
  /** What one charge covers. */
  unit: string;
  /** A shorter name for tight lists (the token popover); `label` when absent. */
  short?: string;
  /**
   * Bought in blocks per location (review replies and analyses): the price reads "1 token = 10 replies" with
   * `formatBlockPrice`, the noun being what one block holds and the size `block_size`. Every price list shows it
   * that way (AI Studio, Billing, the token popover), with `block.unit` next to it; `unit` (no size: it is never
   * hard-coded) is only the fallback for a list that shows a plain token price.
   */
  block?: { one: string; many: string; unit: string };
  group: "posts" | "reviews" | "keywords";
};

/** Price list rows in display order (AI Studio "What AI costs", the token popover, Settings ▸ Billing). */
export const AI_COST_ITEMS: readonly AiCostItem[] = [
  { id: "post_draft", label: "AI post", unit: "per post the AI writes and saves as a draft", group: "posts" },
  { id: "post_image", label: "AI image", unit: "per picture the AI makes; photos from your library are free", group: "posts" },
  { id: "post_revise", label: "Change a post with AI", short: "Change a post", unit: "per change; a new picture costs the same as an AI image", group: "posts" },
  { id: "auto_post", label: "Automatic post", unit: "per post: one AI post, plus an AI image when one is made", group: "posts" },
  { id: "post_ideas", label: "Post ideas", unit: "planned for each location", group: "posts" },
  {
    id: "reply_drafts_per_10",
    label: "AI review replies",
    short: "AI replies",
    unit: "per block of replies for one location; replies left stay with it",
    block: { one: "reply", many: "replies", unit: "bought for one location; replies left stay with it" },
    group: "reviews",
  },
  {
    id: "analysis_per_10",
    label: "AI review analysis",
    short: "AI analyses",
    unit: "per block of analyses for one location; analyses left stay with it",
    block: { one: "analysis", many: "analyses", unit: "bought for one location; analyses left stay with it" },
    group: "reviews",
  },
  { id: "appeal", label: "Removal request draft", unit: "per review", group: "reviews" },
  { id: "insights", label: "Review insights", unit: "per update", group: "reviews" },
  { id: "keyword_suggestions", label: "Keyword ideas", unit: "free, up to 20 runs a day per location", group: "keywords" },
];

const ITEMS_BY_ID = new Map(AI_COST_ITEMS.map((item) => [item.id, item]));

/** The price list row for an item. */
export function aiCostItem(id: AiCostItemId): AiCostItem {
  // Only the deprecated `regenerate` is missing from AI_COST_ITEMS: it is "Change it" under its old name.
  return ITEMS_BY_ID.get(id) ?? { ...(ITEMS_BY_ID.get("post_revise") as AiCostItem), id };
}

type CostSource = Readonly<Record<string, unknown>> | null | undefined;

/**
 * Merges price sources into one complete `AiCosts` (pure; exported for tests). Per key, the first
 * finite, non-negative number wins; missing keys fall back to `AI_COST_DEFAULTS`. Keys the plan no longer has
 * (`post_topics`) are ignored even when an older answer still sends them.
 */
export function resolveAiCosts(...sources: CostSource[]): AiCosts {
  const pick = (key: AiCostKey): number => {
    for (const source of sources) {
      const value = source?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    }
    return AI_COST_DEFAULTS[key];
  };
  const base = Object.fromEntries(AI_COST_KEYS.map((key) => [key, pick(key)])) as Record<AiCostKey, number>;
  return {
    ...base,
    post_revise: base.post_draft,
    post_ideas: 0,
    auto_post: base.post_draft + base.post_image,
    keyword_suggestions: 0,
    regenerate: base.post_draft,
  };
}

/** Prices before anything has loaded (the backend defaults). */
export const DEFAULT_AI_COSTS: AiCosts = resolveAiCosts();

/** A placeholder id for the shared reviews-summary query when no location is given (the query stays disabled). */
export const NO_LOCATION = "";

const selectTokenCosts = (summary: ReviewsSummary) => summary.ai?.token_costs ?? null;

/**
 * Token cost of every AI action for the signed-in organization. `locationId` adds the location's
 * reviews summary as a source (useful for a client_user, who can't read billing); without it,
 * billing and the defaults answer.
 */
export function useAiCosts(locationId?: string | null): AiCosts {
  const billing = useBilling();
  const summaryCosts = useQuery({
    ...reviewsSummaryQuery(locationId ?? NO_LOCATION),
    enabled: Boolean(locationId),
    select: selectTokenCosts,
  });
  return resolveAiCosts(billing.data?.tokens?.ai_costs, summaryCosts.data);
}

const selectBlockSize = (summary: ReviewsSummary) => summary.ai?.credits?.block_size ?? null;

/** The first block size that is a positive number, else `DEFAULT_BLOCK_SIZE` (pure; exported for tests). */
export function resolveBlockSize(...sizes: (number | null | undefined)[]): number {
  for (const size of sizes) if (typeof size === "number" && Number.isFinite(size) && size > 0) return Math.round(size);
  return DEFAULT_BLOCK_SIZE;
}

/**
 * How many replies (or analyses) one block holds, for "1 token = 10 replies": the location's `credits.block_size`
 * (its reviews summary, shared with the Reviews page), else billing's `ai_credits.block_size`, else 10.
 */
export function useAiBlockSize(locationId?: string | null): number {
  const billing = useBilling();
  const summarySize = useQuery({
    ...reviewsSummaryQuery(locationId ?? NO_LOCATION),
    enabled: Boolean(locationId),
    select: selectBlockSize,
  });
  return resolveBlockSize(summarySize.data, billing.data?.tokens?.ai_credits?.block_size);
}

const COUNT = new Intl.NumberFormat();

/** A price: "Free", "1 token", "3 tokens" ("—" when unknown). */
export function formatTokens(count: number): string {
  if (!Number.isFinite(count)) return "—";
  if (count <= 0) return "Free";
  return formatTokenCount(count);
}

/** A balance or an amount: "0 tokens", "1 token", "1,200 tokens" (never "Free"). */
export function formatTokenCount(count: number): string {
  const value = Number.isFinite(count) ? Math.max(0, count) : 0;
  return `${COUNT.format(value)} token${value === 1 ? "" : "s"}`;
}

/**
 * A block-priced item's price as "1 token = 10 replies" ("Free" at price 0); any other item's as `formatTokens`.
 * `blockSize` is `credits.block_size` / `tokens.ai_credits.block_size` when known (10 by default).
 */
export function formatBlockPrice(item: Pick<AiCostItem, "id" | "block">, costs: AiCosts, blockSize: number = DEFAULT_BLOCK_SIZE): string {
  const price = costs[item.id];
  if (!item.block || price <= 0) return formatTokens(price);
  const size = resolveBlockSize(blockSize);
  return `${formatTokenCount(price)} = ${COUNT.format(size)} ${size === 1 ? item.block.one : item.block.many}`;
}
