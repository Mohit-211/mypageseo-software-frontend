import { apiErrorData, isApiError } from "@/api";
import { formatTime } from "@/lib/datetime";
import { aiErrorText } from "@/lib/ai/ai-errors";
import { noteAiError } from "@/lib/ai/ai-signal";
import { declinedFromError, declinedSummary } from "./reply-checks";

/**
 * What a held-back send of one review says on its card (Phase 25a). The card shows the findings or a
 * dialog with them; these are the one-line messages next to them.
 */
export const SEND_BLOCK_COPY = {
  checks_failed: "This reply can't be sent yet: fix the highlighted parts.",
  confirm_warnings_required: "This reply needs a look before it goes to Google: check the warnings, then send it anyway or change it.",
  reply_changed_on_google: "Google already has a reply to this review that wasn't shown here, so your draft wasn't sent.",
  reply_authorization_required: "Replies need your client's authorization first.",
} as const;

/** An inline message with its colour (`critical` red, `warning` amber, `info` blue). */
export type InlineNotice = { message: string; tone: "info" | "warning" | "critical"; reason?: string };

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
      // "Change it" (Phase 25a) says why AI can't write for this review; a removal request has no `skip_reason`.
      if (data.skip_reason === "flagged" || data.skip_reason === "suspicious")
        return { message: "AI doesn't write replies to reviews with suspicious indicators. You can still change the draft yourself." };
      if (data.skip_reason === "no_rating") return { message: "AI replies need a star rating. You can still change the draft yourself." };
      return { message: "A removal request can only be drafted for flagged or 1–3 star reviews." };
    case "no_reply":
      return { message: "This review has no published reply." };
    case "no_draft":
      return { message: "There's no draft yet. Write or draft a reply first." };
    case "deleted_on_google":
      return { message: "This review was deleted on Google, so it can't get a reply." };
    // Phase 25a: sending one review runs every check again, and Google may already have a reply.
    case "checks_failed":
    case "confirm_warnings_required":
    case "reply_changed_on_google":
    case "reply_authorization_required":
      return { message: SEND_BLOCK_COPY[err.reason] };
    // Phase 25a: "Change it".
    case "instructions_declined": {
      const declined = declinedFromError(err);
      return {
        message: declined.length
          ? `We left out all of it: ${declinedSummary(declined)}. Nothing was charged.`
          : "We left out all of it: those changes would break the reply rules. Nothing was charged.",
      };
    }
    case "revision_in_progress":
      return { message: "Another change of this reply is still running. Try again in a minute." };
    case "draft_changed":
      return { message: "The draft changed while the AI was rewriting it, so nothing was charged. Here is the latest version." };
    // Phase 25a: the agency's reply authorization.
    case "client_or_owner_only":
      return { message: "Only your client or the account owner can authorize replies." };
    case "client_changed":
      return { message: "The location's client changed. Reload to see who can authorize replies." };
    case "reply_authorization_not_required":
      return { message: "This account doesn't need an authorization to reply." };
    default:
      return { message: err.message && !/server|request failed/i.test(err.message) ? err.message : fallback };
  }
}

/** "Change it" errors shown inside its box (the AI and account errors go to the shared AI toast instead). */
const REVISE_NOTICE_TONE: Record<string, InlineNotice["tone"]> = {
  instructions_declined: "warning",
  no_draft: "warning",
  not_eligible: "warning",
  deleted_on_google: "warning",
  revision_in_progress: "info",
  draft_changed: "info",
  invalid_input: "critical",
  review_not_found: "critical",
};

/**
 * The inline message for a failed "Change it" (`POST …/reviews/:reviewId/draft/revise`), or null when
 * the error belongs in the shared AI toast (`useToastAiError`: 402/503/502, the account gates, timeouts).
 */
export function reviseErrorNotice(err: unknown): InlineNotice | null {
  if (!isApiError(err) || !err.reason) return null;
  const tone = REVISE_NOTICE_TONE[err.reason];
  if (!tone) return null;
  const message =
    err.reason === "invalid_input"
      ? "Say what to change in 1 to 500 characters."
      : err.reason === "review_not_found"
        ? "This review isn't here anymore. Reload the page."
        : reviewErrorMessage(err, "The draft couldn't be changed.").message;
  return { message, tone, reason: err.reason };
}
