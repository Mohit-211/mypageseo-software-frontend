/**
 * How the other modules use a location's tracked keywords TODAY: the one place the app's
 * explanations come from (the Keywords page "Used by" strip, the per-keyword sheet, the table's
 * "Used by AI" column and the order tip). Keep every sentence about keyword usage here.
 *
 * Backend behaviour (Phase 22, live; read in the backend source, 2026-11-13):
 * - Rank tracking: every tracked keyword, in every run (the free monthly run and manual refreshes).
 * - AI post drafts ("Write with AI"): the keywords the user picks (up to 3), otherwise the FIRST 2
 *   tracked keywords (`postAi.service.ts` `keywordsToUse`); the draft also sees the first 8 as context.
 * - Auto-posts: every slot drafts without picked keywords, so always the first 2 (`series.service.ts`).
 * - Post ideas: the FIRST 12 tracked keywords; each idea names at most 2 of them (`suggestTopics`).
 * - AI review replies: every batch gets the FIRST 8 tracked keywords and works one in where it fits
 *   (two at most on a long positive review); 3★ may use one, 1–2★ usually none
 *   (`reviews.service.ts` `draftBatches`, `prompts.service.ts`).
 * So the saved order is the AI priority.
 *
 * Phase 25a/25b (approved, not built yet) replace the post rules with a rank-based keyword plan
 * (user picks capped at 2) and limit replies to one keyword in at most 1 reply in 3. When the backend
 * announces them, change the numbers and sentences below; every screen follows.
 */
import { quoteList } from "./keywords";

export const KEYWORD_USAGE = {
  /** Write with AI uses the first N tracked keywords when the user picks none (auto-posts always do). */
  postDefaultCount: 2,
  /** Write with AI takes at most this many picked keywords. */
  postPickMax: 3,
  /** Post ideas read the first N tracked keywords. */
  postIdeasCount: 12,
  /** AI reply drafts read the first N tracked keywords. */
  replyContextCount: 8,
} as const;

/** What one keyword is used for, from its place in the saved list (0 = first). */
export type KeywordUse = {
  /** Write with AI and auto-posts use it when no keywords are picked. */
  postDefault: boolean;
  /** Post ideas can build on it. */
  postIdeas: boolean;
  /** AI review reply drafts are offered it. */
  replies: boolean;
};

export function usageFor(position: number): KeywordUse {
  return {
    postDefault: position < KEYWORD_USAGE.postDefaultCount,
    postIdeas: position < KEYWORD_USAGE.postIdeasCount,
    replies: position < KEYWORD_USAGE.replyContextCount,
  };
}

/** Short labels for the "Used by AI" column, from most to least use. */
export function usageLabels(use: KeywordUse): string[] {
  const labels: string[] = [];
  if (use.postDefault) labels.push("Posts");
  if (use.replies) labels.push("Replies");
  if (!use.postDefault && use.postIdeas) labels.push("Post ideas");
  return labels;
}

/** Sentences for the "Used by" strip, the sheet and tips. */
export const USAGE_COPY = {
  rankings: {
    title: "Rank tracking",
    /** "Every keyword in every run, from 5 spots and a 7×7 grid around the business." */
    summary: (gridSize: number | null | undefined) =>
      `Every keyword is measured in every run: from 5 spots and ${gridSize ? `a ${gridSize}×${gridSize} grid` : "a grid of points"} around your business.`,
  },
  posts: {
    title: "AI posts",
    summary: (defaults: readonly string[]) =>
      defaults.length > 0
        ? `Write with AI weaves in up to ${KEYWORD_USAGE.postPickMax} keywords you pick. If you pick none, it uses your first ${KEYWORD_USAGE.postDefaultCount}: ${quoteList(defaults, KEYWORD_USAGE.postDefaultCount)}. Post ideas draw on your first ${KEYWORD_USAGE.postIdeasCount}.`
        : `Write with AI weaves in up to ${KEYWORD_USAGE.postPickMax} keywords you pick, or your first ${KEYWORD_USAGE.postDefaultCount} when you pick none.`,
  },
  replies: {
    title: "AI review replies",
    summary: `Each batch of reply drafts gets your first ${KEYWORD_USAGE.replyContextCount} keywords and works one in where it fits. Replies to 1–2★ reviews usually use none.`,
  },
  /** Under the keyword table: why the order matters. */
  orderTip: `AI posts default to your first ${KEYWORD_USAGE.postDefaultCount} keywords and AI replies draw on your first ${KEYWORD_USAGE.replyContextCount}. Move the ones that matter most to the top.`,
  /** The "Used by AI" column's explanation. */
  columnTip: `Your order is the AI priority. Write with AI uses your first ${KEYWORD_USAGE.postDefaultCount} when you don't pick any, post ideas draw on your first ${KEYWORD_USAGE.postIdeasCount}, and AI replies on your first ${KEYWORD_USAGE.replyContextCount}.`,
} as const;

/** What AI posts do with the keyword at `position` (the detail sheet). */
export function postUsageText(position: number): string {
  const use = usageFor(position);
  if (use.postDefault) {
    return `Write with AI and auto-posts use it by default: it's one of your first ${KEYWORD_USAGE.postDefaultCount} keywords. You can also pick it yourself.`;
  }
  if (use.postIdeas) {
    return `Write with AI uses it when you pick it, and post ideas can build on it (they read your first ${KEYWORD_USAGE.postIdeasCount}).`;
  }
  return `Write with AI uses it when you pick it. Post ideas only read your first ${KEYWORD_USAGE.postIdeasCount} keywords, so move it up to include it.`;
}

/** What AI review replies do with the keyword at `position` (the detail sheet). */
export function replyUsageText(position: number): string {
  return usageFor(position).replies
    ? `AI reply drafts are offered it (your first ${KEYWORD_USAGE.replyContextCount}) and use it where it fits the review.`
    : `AI reply drafts don't see it today: they read only your first ${KEYWORD_USAGE.replyContextCount} keywords. Move it up to include it.`;
}
