import { apiErrorData, isApiError } from "@/api";
import { formatTime } from "@/lib/datetime";
import { aiErrorText } from "@/lib/ai/ai-errors";
import { noteAiError } from "@/lib/ai/ai-signal";

/**
 * Reasons worded by the shared AI copy deck (`aiErrorText`), so a failed reply draft, analysis,
 * removal request or insights run reads the same as a failed AI post. The deck never mentions "the
 * server" and covers the plan and account gates the reviews routes share with every AI route.
 */
const AI_REASONS = new Set([
  "ai_not_configured",
  "ai_budget_reached",
  "ai_failed",
  "insufficient_tokens",
  "subscription_required",
  "organization_suspended",
  "feature_not_included",
  "read_only",
]);

const BILLING_PATH = "/settings/billing";

/**
 * Message for a failed reviews call, as one sentence or two. `buyTokens` is set when the user should
 * be offered token packs (402 `insufficient_tokens` for someone who can buy them).
 *
 * New code that toasts an AI failure should prefer `useToastAiError()` (`@/lib/ai/toast-ai-error`),
 * which adds the right toast type and action; this stays for inline messages and older call sites.
 */
export function reviewErrorMessage(err: unknown, fallback: string): { message: string; buyTokens?: boolean } {
  if (!isApiError(err)) return { message: fallback };
  if (err.reason && AI_REASONS.has(err.reason)) {
    // Lets every AI button and banner on the page catch up (AI off or paused).
    noteAiError(err);
    const text = aiErrorText(err, { fallback });
    const title = text.title.replace(/[.!?]+$/, "");
    const buyTokens = err.reason === "insufficient_tokens" && text.action?.href === BILLING_PATH;
    return { message: `${title}. ${text.description}`, ...(buyTokens ? { buyTokens: true } : {}) };
  }
  const data = apiErrorData(err);
  switch (err.reason) {
    case "rate_limited": {
      const at = typeof data.next_allowed_at === "string" ? formatTime(data.next_allowed_at, "") : "";
      return { message: `Reviews were checked a moment ago. Try again ${at ? `at ${at}` : "in a few minutes"}.` };
    }
    case "gbp_not_connected":
      return { message: "Connect the Google Business Profile to manage reviews." };
    case "v4_access_pending":
      return { message: "Reviews need a Google approval that is still pending." };
    case "not_eligible":
      return { message: "A removal request can only be drafted for flagged or 1–3 star reviews." };
    case "no_reply":
      return { message: "This review has no published reply." };
    case "no_draft":
      return { message: "There's no draft to send. Write a reply first." };
    case "deleted_on_google":
      return { message: "This review was deleted on Google, so it can't get a reply." };
    default:
      return { message: err.message && !/server|request failed/i.test(err.message) ? err.message : fallback };
  }
}
