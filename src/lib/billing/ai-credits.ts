/**
 * Locations named on the Billing page: the AI replies and analyses left per location (`GET billing` →
 * `tokens.ai_credits`) and the token history (`GET billing/tokens/ledger`), 2026-11-17 entry, section 2.
 *
 * The token history has one row per block of 10 AI replies or analyses bought or refunded (`ref:
 * "ai_credits:<block>"`, `location_id`, notes such as "AI replies: block of 10" or "Refund: AI replies not used
 * (location removed)"), and the refresh rows carry their location too. A row is named after its location only
 * when it is one this person can open (the workspace's locations: a removed location, or one outside a member's
 * clients, isn't), else it shows no name. Pure helpers.
 */
import type { AiCreditsLocation, ReplyCredits, TokenLedgerEntry } from "@/api";
import { DEFAULT_BLOCK_SIZE } from "@/lib/reviews/reply-credits";

type KnownLocation = { id: string; businessName: string };

/**
 * What removing a location does to its AI replies and analyses, from its reviews summary's counters
 * (`ai.credits`): a block nobody used is refunded, but what's left of a started block (at most 9) is lost. Replies
 * are used oldest block first, so that is the remainder of the replies left by the block size (at rest a location
 * keeps no unused block, so it is usually all of them). Null when none would be lost (or the counters are unknown).
 */
export function unusedCreditsNote(
  credits: Partial<Pick<ReplyCredits, "replies_left" | "analyses_left" | "block_size">> | null | undefined,
): string | null {
  const size = typeof credits?.block_size === "number" && credits.block_size >= 1 ? Math.floor(credits.block_size) : DEFAULT_BLOCK_SIZE;
  const count = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) % size : 0);
  const replies = count(credits?.replies_left);
  const analyses = count(credits?.analyses_left);
  const parts = [
    ...(replies > 0 ? [`${replies.toLocaleString()} AI ${replies === 1 ? "reply" : "replies"}`] : []),
    ...(analyses > 0 ? [`${analyses.toLocaleString()} AI review ${analyses === 1 ? "analysis" : "analyses"}`] : []),
  ];
  if (parts.length === 0) return null;
  const one = replies + analyses === 1;
  return `The ${parts.join(" and ")} left for this location ${one ? "is" : "are"} lost: what's left of a started block isn't refunded.`;
}

/** The token history row's location name, or null when the row has none or it isn't one you can open. */
export function ledgerLocationName(entry: Pick<TokenLedgerEntry, "location_id">, locations: readonly KnownLocation[]): string | null {
  const id = entry.location_id;
  if (!id) return null;
  return locations.find((location) => location.id === id)?.businessName.trim() || null;
}

/** An AI credits row's name: the workspace's (renamed since?) when known, else the one billing sent. */
export function creditLocationName(row: Pick<AiCreditsLocation, "location_id" | "name">, locations: readonly KnownLocation[]): string {
  return locations.find((location) => location.id === row.location_id)?.businessName.trim() || row.name.trim() || "A location";
}
