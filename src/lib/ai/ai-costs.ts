/**
 * What AI costs: MyPageSEO tokens per AI action, one list for every AI button, chip and price table.
 *
 * Where the numbers come from, per key (first answer wins; both read the same plan entitlement on the
 * backend, so they agree whenever both load):
 * 1. `GET billing` → `tokens.ai_costs` (owners and members; `useBilling()`, cached 60 s);
 * 2. the location's `GET reviews/summary` → `ai.token_costs` (every role; shared cache with the Reviews
 *    page via `reviewsSummaryQuery`). The backend sends all seven keys there, although the frontend's
 *    `ReviewTokenCosts` type names only the four review ones;
 * 3. the backend defaults (`AI_TOKEN_COST_DEFAULTS`, backend `src/modules/billing/domain/constants.ts`).
 *    Admins can change prices per plan, so the defaults are only a fallback, never the source of truth.
 *
 * Derived items (no plan key of their own):
 * - `regenerate`: rewriting a saved post's text costs one post draft (Phase 25b's "Change it" keeps that
 *   price); a new AI image for it costs `post_image`;
 * - `auto_post`: each auto-post writes one draft plus one image when the series has images on;
 * - `keyword_suggestions`: free (20 runs per location per UTC day, 429 `suggestion_limit_reached`).
 *
 * Also here: `formatTokens` ("1 token", "3 tokens", "Free") and estimators that mirror the backend's
 * per-started-10 billing for review replies and analysis, so a selection bar can show the real price.
 */
import { useQuery } from "@tanstack/react-query";
import type { Review, ReviewsSummary } from "@/api";
import { useBilling } from "@/lib/billing/use-billing";
import { reviewsSummaryQuery } from "@/lib/reviews/use-reviews";

/** The plan's AI price keys (`tokens.ai_costs`), as the backend names them. */
export type AiCostKey = "post_topics" | "post_draft" | "post_image" | "reply_drafts_per_10" | "analysis_per_10" | "appeal" | "insights";

/** Every priced AI action: the plan keys plus the items derived from them. */
export type AiCostItemId = AiCostKey | "regenerate" | "auto_post" | "keyword_suggestions";

/** Tokens per AI action, every item resolved (0 = free). */
export type AiCosts = Readonly<Record<AiCostItemId, number>>;

/** Backend defaults, used only when neither billing nor the reviews summary answered. */
export const AI_COST_DEFAULTS: Readonly<Record<AiCostKey, number>> = {
  post_topics: 1,
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
  group: "posts" | "reviews" | "keywords";
};

/** Price list rows in display order (AI Studio "What AI costs", the token popover, Settings ▸ Billing). */
export const AI_COST_ITEMS: readonly AiCostItem[] = [
  { id: "post_topics", label: "Post ideas", unit: "per set of ideas", group: "posts" },
  { id: "post_draft", label: "Post draft", unit: "per request, up to 3 versions", group: "posts" },
  { id: "post_image", label: "AI image", unit: "per image", group: "posts" },
  { id: "regenerate", label: "Rewrite a post", unit: "per rewrite; a new image costs the same as an AI image", group: "posts" },
  { id: "auto_post", label: "Auto-post", unit: "per post: a draft, plus an image when images are on", group: "posts" },
  { id: "reply_drafts_per_10", label: "Review reply drafts", unit: "per batch of up to 10 reviews", group: "reviews" },
  { id: "analysis_per_10", label: "Review analysis", unit: "per batch of up to 10 reviews", group: "reviews" },
  { id: "appeal", label: "Removal request draft", unit: "per review", group: "reviews" },
  { id: "insights", label: "Review insights", unit: "per update", group: "reviews" },
  { id: "keyword_suggestions", label: "Keyword ideas", unit: "free, up to 20 runs a day per location", group: "keywords" },
];

const ITEMS_BY_ID = new Map(AI_COST_ITEMS.map((item) => [item.id, item]));

/** The price list row for an item. */
export function aiCostItem(id: AiCostItemId): AiCostItem {
  // Every id is in AI_COST_ITEMS (the type is closed), so the fallback never shows.
  return ITEMS_BY_ID.get(id) ?? { id, label: id, unit: "", group: "posts" };
}

type CostSource = Readonly<Record<string, unknown>> | null | undefined;

/**
 * Merges price sources into one complete `AiCosts` (pure; exported for tests). Per key, the first
 * finite, non-negative number wins; missing keys fall back to `AI_COST_DEFAULTS`.
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
    regenerate: base.post_draft,
    auto_post: base.post_draft + base.post_image,
    keyword_suggestions: 0,
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

/** Tokens for `count` items charged per started batch of 10 (the backend's `per10`). */
export function perStartedTen(count: number, costPer10: number): number {
  return count <= 0 ? 0 : Math.ceil(count / 10) * costPer10;
}

type DraftableReview = Pick<Review, "rating" | "reply_state" | "flag_level" | "draft">;

/**
 * Tokens `POST reviews/drafts` will spend on these reviews, the way the backend counts them
 * (`generateDrafts` / `draftBatchesOf` in backend `reviews.service.ts`):
 * - only eligible reviews: rated, no reply on Google yet, not flagged suspicious;
 * - a current draft (not stale), or one the user wrote or edited, is reused for free unless `regenerate`;
 * - 4–5★ and 1–3★ reviews go in separate batches (different reply rules), each charged per started 10.
 * The old "ceil(selected / 10) × price" estimate missed the last two rules.
 */
export function estimateReplyDraftCost(reviews: readonly DraftableReview[], per10: number, regenerate = false): number {
  let positive = 0;
  let critical = 0;
  for (const review of reviews) {
    if (review.rating === null || review.reply_state === "sent" || review.flag_level === "suspicious") continue;
    const draft = review.draft;
    const reused = !regenerate && draft !== null && (!draft.stale || draft.source === "user" || Boolean(draft.edited));
    if (reused) continue;
    if (review.rating <= 3) critical += 1;
    else positive += 1;
  }
  return perStartedTen(positive, per10) + perStartedTen(critical, per10);
}

type AnalysableReview = Pick<Review, "comment" | "analysis">;

/**
 * Tokens `POST reviews/analyze` will spend: reviews with text and no current analysis (a stale one is
 * redone; `regenerate` redoes all), charged per started 10 (backend `analyze` in `reviews.service.ts`).
 */
export function estimateAnalysisCost(reviews: readonly AnalysableReview[], per10: number, regenerate = false): number {
  const todo = reviews.filter((review) => {
    if (!review.comment?.trim()) return false;
    return regenerate || !review.analysis || review.analysis.stale;
  }).length;
  return perStartedTen(todo, per10);
}
