/**
 * How the dashboard and a location's Overview offer to answer reviews (and write posts). The words
 * follow the Reviews page: "need a reply" is every review without a reply (`unreplied`, the Reviews
 * page's "Needs reply" view), and "urgent" is the subset the backend calls `awaiting_attention`
 * (unanswered 1–3★ reviews and flagged ones).
 */
import type { AiStatus } from "@/lib/ai/ai-status";
import { locationPath } from "@/lib/mypageseo/section-links";

/**
 * What the person looking can write right now:
 * - `ai`: AI can draft (AI Review Replies, AI Posts);
 * - `manual`: AI is off or paused for the day, so they write it themselves;
 * - `view`: nothing can be sent (read-only access, or an account that can't make changes now),
 *   so links only offer to look.
 */
export type WritingMode = "ai" | "manual" | "view";

/** The mode for a location's AI status (`useAiStatus(locationId)`; the AI switch is server-wide). */
export function writingModeFor(ai: Pick<AiStatus, "state" | "blockedBy">): WritingMode {
  if (ai.blockedBy === "role" || ai.blockedBy === "suspended" || ai.blockedBy === "subscription") return "view";
  if (ai.state === "off" || ai.state === "paused") return "manual";
  return "ai";
}

/** Every review of the location without a reply: its count is `unreplied`. */
export function needsReplyPath(locationId: string): string {
  return locationPath(locationId, "reputation", "?reply=needs");
}

/** A "reply" link: AI drafts, the Reviews list to answer by hand, or the same list just to look. */
export function replyLink(mode: WritingMode, locationId: string): { label: string; to: string } {
  switch (mode) {
    case "ai":
      return { label: "Draft replies", to: locationPath(locationId, "ai/replies") };
    case "manual":
      return { label: "Reply now", to: needsReplyPath(locationId) };
    default:
      return { label: "See reviews", to: needsReplyPath(locationId) };
  }
}

/**
 * A link for the urgent reviews: the unanswered 1–3★ ones, as AI Review Replies' "Low-rated" view
 * or the same filter on Reviews. One list can't also hold the flagged 4–5★ ones (the API ANDs its
 * filters); those wait under "Needs attention" on both pages.
 */
export function urgentReplyLink(mode: WritingMode, locationId: string): { label: string; to: string } {
  const lowRated = locationPath(locationId, "reputation", "?reply=needs&rating=1,2,3");
  switch (mode) {
    case "ai":
      return { label: "Draft replies", to: locationPath(locationId, "ai/replies", "?filter=low") };
    case "manual":
      return { label: "Reply now", to: lowRated };
    default:
      return { label: "Open reviews", to: lowRated };
  }
}
