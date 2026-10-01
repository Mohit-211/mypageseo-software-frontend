import { apiErrorData, isApiError } from "@/api";

/**
 * Message for a failed reviews call. AI routes: 402 `insufficient_tokens`, 503
 * `ai_not_configured` / `ai_budget_reached`, 502 `ai_failed` (tokens refunded).
 * `buyTokens` is set when the user should be offered token packs.
 */
export function reviewErrorMessage(err: unknown, fallback: string): { message: string; buyTokens?: boolean } {
  if (!isApiError(err)) return { message: fallback };
  const data = apiErrorData(err);
  switch (err.reason) {
    case "insufficient_tokens":
      return { message: `Not enough tokens: this costs ${String(data.cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`, buyTokens: true };
    case "ai_not_configured":
      return { message: "AI isn't set up on the server yet." };
    case "ai_budget_reached":
      return { message: "Today's AI limit is used up. Try again tomorrow." };
    case "ai_failed":
      return { message: "The AI didn't answer. Your tokens were refunded; try again." };
    case "rate_limited":
      return { message: "Reviews were refreshed a moment ago. Try again in a few minutes." };
    case "gbp_not_connected":
      return { message: "Connect the Google Business Profile to manage reviews." };
    case "v4_access_pending":
      return { message: "Reviews need a Google approval that is still pending." };
    case "not_eligible":
      return { message: "A removal request can only be drafted for flagged or 1–3 star reviews." };
    case "no_reply":
      return { message: "This review has no published reply." };
    case "read_only":
      return { message: "Your access is read-only." };
    default:
      return { message: err.message || fallback };
  }
}
