/**
 * Numbers derived from the reviews summary and lists (pure). Everything comes from real data:
 * `GET reviews/summary` → `stats`, or a page of `GET reviews` sorted newest first.
 *
 * Backend definitions (backend `src/modules/reviews/services/stats.service.ts`), so the derived
 * numbers stay exact:
 * - `unreplied` = no reply on Google (`reply_state` none, draft or failed);
 * - `drafts_pending` = a draft waits (`reply_state` draft or failed: a failed send keeps its draft);
 * - `flagged` = attention + suspicious flags.
 */
import type { ReviewsList, ReviewsSummary } from "@/api";

type Stats = NonNullable<ReviewsSummary["stats"]>;

const DAY_MS = 86_400_000;

/** Share of reviews with a reply on Google. Null without reviews. */
export function replyRate(stats: Pick<Stats, "total" | "unreplied">): { rate: number | null; answered: number; total: number } {
  const answered = Math.max(0, stats.total - stats.unreplied);
  return { rate: stats.total > 0 ? answered / stats.total : null, answered, total: stats.total };
}

/**
 * "84%" (no decimals). The ends never round to a promise the numbers don't keep: under 1% but above
 * 0 shows "<1%", and anything short of all (199 of 200) shows ">99%", so "100%" means every one.
 */
export function formatPercent(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return "—";
  if (rate > 0 && rate < 0.01) return "<1%";
  if (rate < 1 && Math.round(rate * 100) === 100) return ">99%";
  return `${Math.round(rate * 100)}%`;
}

/** Reviews with nothing written yet: no reply and no draft. */
export function noReplyCount(stats: Pick<Stats, "unreplied" | "drafts_pending">): number {
  return Math.max(0, stats.unreplied - stats.drafts_pending);
}

/** Reviews flagged for attention (not suspicious). */
export function attentionCount(stats: Pick<Stats, "flagged" | "suspicious">): number {
  return Math.max(0, stats.flagged - stats.suspicious);
}

/** Reviews AI would draft now ("Draft all"): the summary's count, else an estimate from the stats. */
export function draftableCount(summary: ReviewsSummary): number {
  if (typeof summary.ai?.draftable === "number") return summary.ai.draftable;
  return summary.stats ? noReplyCount(summary.stats) : 0;
}

/** How many reviews arrive per 30 days, from the newest reviews. */
export type ReviewMomentum = {
  /** New reviews in the last 30 days (at least, when `capped`). */
  last30: number;
  /** The 30 days before; null when the sample doesn't reach back that far. */
  previous30: number | null;
  /** The sample ended inside the last 30 days, so `last30` is a lower bound ("100+"). */
  capped: boolean;
  newestAt: string | null;
};

/**
 * Counts reviews created in the last 30 days and the 30 before from one page of `GET reviews`
 * sorted newest first. A window is exact only when the page holds every review, or reaches back
 * past the window's start.
 */
export function reviewMomentum(list: Pick<ReviewsList, "reviews" | "total">, nowMs: number): ReviewMomentum {
  const times = list.reviews.map((review) => Date.parse(review.create_time ?? "")).filter((time) => Number.isFinite(time));
  const complete = list.reviews.length >= list.total;
  const oldest = times.length ? Math.min(...times) : null;
  const reaches = (since: number) => complete || (oldest !== null && oldest < since);
  const start30 = nowMs - 30 * DAY_MS;
  const start60 = nowMs - 60 * DAY_MS;
  const last30 = times.filter((time) => time >= start30).length;
  const previous30 = reaches(start60) ? times.filter((time) => time >= start60 && time < start30).length : null;
  return {
    last30,
    previous30,
    capped: !reaches(start30),
    newestAt: list.reviews[0]?.create_time ?? null,
  };
}

/** The trend chip for new reviews: more reviews than the 30 days before is good. */
export function momentumTrend(momentum: ReviewMomentum): { direction: "up" | "down" | "flat"; value: string; positive: boolean } | undefined {
  if (momentum.previous30 === null || momentum.capped) return undefined;
  const change = momentum.last30 - momentum.previous30;
  if (change === 0) return { direction: "flat", value: "Same as before", positive: true };
  return { direction: change > 0 ? "up" : "down", value: `${change > 0 ? "+" : "−"}${Math.abs(change)}`, positive: change > 0 };
}

/** Initials for a reviewer avatar ("Sam Lee" → "SL"); "?" for anonymous or missing names. */
export function reviewerInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** A stable small number for a name, to pick an avatar colour. */
export function nameHash(name: string | null | undefined): number {
  let hash = 0;
  for (const char of name ?? "") hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Why reviews can't be shown for a location, if they can't: Google not connected, or Google's approval pending. */
export type ReviewsGate = "not_connected" | "access_pending";

export function reviewsGate(summary: Pick<ReviewsSummary, "gbp_connected" | "v4_enabled">): ReviewsGate | null {
  if (!summary.gbp_connected) return "not_connected";
  if (!summary.v4_enabled) return "access_pending";
  return null;
}
