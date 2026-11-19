import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiErrorData, isApiError } from "@/api";
import { useAccess } from "@/hooks/use-access";
import { formatTime } from "@/lib/datetime";
import { aiErrorText } from "@/lib/ai/ai-errors";
import { noteAiError } from "@/lib/ai/ai-signal";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { insufficientCreditsText } from "./reply-credits";
import { declinedFromError, declinedSummary } from "./reply-checks";

/**
 * What a held-back send of one review says on its card (Phase 25a). The card shows the findings or a
 * dialog with them; these are the one-line messages next to them.
 */
export const SEND_BLOCK_COPY = {
  checks_failed: "This reply can't be sent yet: fix the highlighted parts.",
  confirm_warnings_required: "This reply needs a look before it goes to Google: check the warnings, then send it anyway or change it.",
  reply_changed_on_google: "Google already has a reply to this review that wasn't shown here, so your draft wasn't sent.",
  draft_predates_reply: "This draft was written before the reply now on Google, so it wasn't sent.",
  reply_authorization_required: "Replies need your client's authorization first.",
} as const;

/** An inline message with its colour (`critical` red, `warning` amber, `info` blue). */
export type InlineNotice = { message: string; tone: "info" | "warning" | "critical"; reason?: string };

/**
 * Reasons worded by the shared AI copy deck (`aiErrorText`), so a failed reply draft, analysis,
 * removal request or insights run reads the same as a failed AI post. The deck never mentions "the
 * server" and covers the plan and account gates the reviews routes share with every AI route.
 * Phase 25b's 503 `ai_org_budget_reached` (this organization used its share of today's AI) is one of them:
 * "AI is paused for your organization today", with when it resumes.
 */
const AI_REASONS = new Set([
  "ai_not_configured",
  "ai_budget_reached",
  "ai_org_budget_reached",
  "ai_failed",
  "insufficient_tokens",
  "subscription_required",
  "organization_suspended",
  "feature_not_included",
  "read_only",
]);

const BILLING_PATH = "/settings/billing";

/** The 402's next step for someone who can't buy tokens (a member, a client user). */
const ASK_OWNER_FOR_TOKENS = "Ask the account owner to add tokens.";

/**
 * What a 402 `insufficient_tokens` offers next, by role, as the reply toasts do: "Buy tokens" (Billing) for whoever
 * can buy them (the owner), else "Ask the account owner to add tokens." Null for any other error.
 */
export function outOfTokensNextStep(
  error: unknown,
  canBuyTokens: boolean,
): { kind: "buy"; label: string; href: string } | { kind: "ask"; text: string } | null {
  if (!isApiError(error) || error.reason !== "insufficient_tokens") return null;
  return canBuyTokens ? { kind: "buy", label: "Buy tokens", href: BILLING_PATH } : { kind: "ask", text: ASK_OWNER_FOR_TOKENS };
}

/**
 * Message for a failed reviews call, as one sentence or two. `buyTokens` is set when the user should
 * be offered token packs (402 `insufficient_tokens` for someone who can buy them). `blockSize` is the location's
 * `credits.block_size`, for the 402's "1 token buys 10 more" (10 by default).
 *
 * New code that toasts an AI failure should prefer `useToastAiError()` (`@/lib/ai/toast-ai-error`),
 * which adds the right toast type and action; this stays for inline messages and older call sites.
 */
export function reviewErrorMessage(err: unknown, fallback: string, options: { blockSize?: number } = {}): { message: string; buyTokens?: boolean } {
  if (!isApiError(err)) return { message: fallback };
  // 2026-11-17: the reply routes' 402 says how many replies are left and needed ("2 replies left, 6 needed: …").
  const credits = insufficientCreditsText(err, options.blockSize ? { blockSize: options.blockSize } : {});
  if (credits) return { message: `Not enough tokens. ${credits}.`, buyTokens: true };
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
    case "draft_predates_reply":
    case "reply_authorization_required":
      return { message: SEND_BLOCK_COPY[err.reason] };
    // Phase 25b: "Try the other version".
    case "no_alternative":
      return { message: "There's no other version of this draft." };
    case "draft_edited":
      return { message: "You edited this draft. Switching to the other version would lose your edits." };
    case "review_not_found":
      return { message: "This review isn't here anymore. Reload the page." };
    case "location_not_found":
      return { message: "This location was removed meanwhile, so nothing was drafted or charged." };
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

export type ReplyErrorToastOptions = {
  /** The toast's title for errors without words of their own, e.g. "The replies couldn't be drafted". */
  fallback: string;
  /** `credits.block_size` (10 by default), for the 402's "1 token buys 10 more". */
  blockSize?: number;
  /** "Try again" on a failure that may work a second time (502 `ai_failed`). */
  onRetry?: () => void;
};

/**
 * The toast for a failed AI reply action (drafts, "Draft all", "Change it", Analyze), on top of the shared AI toast
 * (`useToastAiError`):
 * - 402 `insufficient_tokens` with the counts (2026-11-17): "2 replies left, 6 needed: 1 token buys 10 more", with
 *   "Buy tokens" for whoever can buy them (the owner), else "Ask the account owner to add tokens";
 * - 502 `ai_failed`: every review was cut or nothing usable came back, and nothing was used;
 * - anything else, 503 `ai_org_budget_reached` (Phase 25b) included: the shared AI toast, which has its words ("AI
 *   is paused for your organization today", and when it resumes) and records the pause for every AI button.
 */
export function useToastReplyError(): (error: unknown, options: ReplyErrorToastOptions) => void {
  const toastAiError = useToastAiError();
  const navigate = useNavigate();
  const canBuyTokens = useAccess().can("billing.manage");
  return (error, { fallback, blockSize, onRetry }) => {
    const credits = insufficientCreditsText(error, blockSize ? { blockSize } : {});
    if (credits) {
      toast.warning("Not enough tokens", {
        id: "ai-error:insufficient_tokens",
        description: canBuyTokens ? `${credits}.` : `${credits}. ${ASK_OWNER_FOR_TOKENS}`,
        ...(canBuyTokens ? { action: { label: "Buy tokens", onClick: () => void navigate(BILLING_PATH) } } : {}),
      });
      return;
    }
    if (isApiError(error) && error.reason === "ai_failed") {
      toast.error(fallback, {
        id: "ai-error:ai_failed",
        description: "The AI didn't finish in time or nothing usable came back, so nothing was used. Try again.",
        ...(onRetry ? { action: { label: "Try again", onClick: onRetry } } : {}),
      });
      return;
    }
    toastAiError(error, { fallback, ...(onRetry ? { onRetry } : {}) });
  };
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
