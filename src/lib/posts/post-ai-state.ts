/**
 * Can the post AI buttons run, and what do they cost (Phase 25c, 2026-11-16 "Post writer v2" item 5)?
 *
 * `GET …/posts/summary` → `ai { configured, paused_today, token_costs }` is the posts' own answer: whether
 * "Write with AI", "Change it" and "Create image" can run now (`configured: false`: AI isn't switched on yet;
 * `paused_today`: today's AI budget, or the organization's share of it, is used up) and what they cost. It is
 * merged here with `useAiStatus` (the user's role, the account, and what this session's AI calls said), so a
 * location without reviews, or a client user, still gets a reason.
 *
 * Topics (planning, "Post ideas", Dismiss, Restore) are free: no price here.
 */
import type { PostsSummary } from "@/api";
import { useAiCosts } from "@/lib/ai/ai-costs";
import { useAiStatus, type AiStatus } from "@/lib/ai/ai-status";
import { formatResumeTime, nextUtcMidnight } from "@/lib/ai/ai-time";

export type PostAiState = AiStatus & {
  /** Tokens for one "Write with AI" or "Change it" (`post_draft`). */
  draftCost: number;
  /** Tokens for an AI image (`post_image`); a photo from the library costs nothing. */
  imageCost: number;
};

/** The paused note for the posts summary's `paused_today` (the budget comes back at 00:00 UTC). */
function pausedReason(updatedAt: number): string {
  if (!updatedAt) return "AI is paused for today. Try again tomorrow.";
  return `AI is paused for today. It's back at ${formatResumeTime(nextUtcMidnight(updatedAt), updatedAt)}.`;
}

/**
 * `useAiStatus(locationId)` with the posts summary's `ai` block: AI buttons are disabled with the reason while
 * the summary says AI isn't switched on or is paused today, and the prices come from its `token_costs`.
 * `summaryUpdatedAt` is the summary query's `dataUpdatedAt` (for the time AI comes back).
 */
export function usePostAiState(locationId: string, summary: PostsSummary | null | undefined, summaryUpdatedAt = 0): PostAiState {
  const status = useAiStatus(locationId);
  const costs = useAiCosts(locationId);
  const block = summary?.ai;
  const draftCost = block?.token_costs?.post_draft ?? costs.post_draft;
  const imageCost = block?.token_costs?.post_image ?? costs.post_image;
  if (!status.canRun || !block) return { ...status, draftCost, imageCost };
  if (!block.configured) {
    return { ...status, canRun: false, state: "off", blockedBy: "off", reason: "AI is almost ready, but it isn't switched on yet.", draftCost, imageCost };
  }
  if (block.paused_today) {
    return { ...status, canRun: false, state: "paused", blockedBy: "paused", reason: pausedReason(summaryUpdatedAt), draftCost, imageCost };
  }
  return { ...status, draftCost, imageCost };
}
