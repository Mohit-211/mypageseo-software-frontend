/**
 * One copy deck for failed AI actions: post ideas, drafts, images, rewrites, auto-posts, review reply
 * drafts, analysis, removal requests, insights and keyword ideas.
 *
 * It replaces three helpers that grew apart (`postErrorText` in src/lib/posts/use-posts.ts,
 * `reviewErrorMessage` in src/lib/reviews/review-errors.ts, `errorText` in
 * src/components/keywords/keyword-suggestions.tsx; see ai.md §2.1). Those keep working; their AI cases
 * can delegate here.
 *
 * Reasons (backend docs/API.md "AI errors (every AI route)", billing gates, Phase 22/25):
 * - 503 `ai_not_configured`: AI isn't switched on yet. Shown as "AI is almost ready"; never "the server".
 * - 503 `ai_budget_reached`: today's AI budget is used up (per UTC day, nothing charged).
 * - 502 `ai_failed`: the AI didn't answer or (Phase 25a) nothing in its answer could be used: no usable
 *   reply, analysis, report text, post text or idea, or an AI image that couldn't be stored (`posts/ai-image`
 *   answers this instead of a `media_*` error). Either way the tokens were refunded, and the words say so.
 *   Keyword ideas are free and never answer it for an unusable answer: that's `suggestions: []`.
 * - 402 `insufficient_tokens` `{ balance, cost }`: owners get "Buy tokens"; others are told to ask the owner.
 * - 402 `subscription_required`: owners get "Go to billing"; others are told to ask the owner.
 * - 403 `organization_suspended` (→ a new support ticket), 403 `feature_not_included` `{ feature }`,
 *   403 `read_only` (client_user).
 * - 429 `suggestion_limit_reached` (keyword ideas: 20 runs per location per UTC day), 429 `rate_limited`
 *   `{ retry_after_seconds | next_allowed_at }`.
 * - Phase 25: 409 `revision_in_progress` ("Change it" already running); `ai_not_compliant` (an auto-post
 *   draft failed Google's post rules; tokens refunded).
 *
 * `aiErrorText` is pure. `useAiErrorText()` fills the owner/billing options from the signed-in user.
 * To show a toast (and record the outcome for `useAiStatus`), use `toastAiError` / `useToastAiError`.
 */
import { apiErrorData, isApiError } from "@/api";
import { useAccess } from "@/hooks/use-access";
import { formatTime } from "@/lib/datetime";
import { formatTokenCount, formatTokens } from "./ai-costs";
import { formatResumeTime, nextUtcMidnight } from "./ai-time";

/** Reasons this deck has its own words for. */
export const AI_ERROR_REASONS = [
  "ai_not_configured",
  "ai_budget_reached",
  "ai_failed",
  "insufficient_tokens",
  "subscription_required",
  "organization_suspended",
  "feature_not_included",
  "read_only",
  "suggestion_limit_reached",
  "rate_limited",
  "revision_in_progress",
  "ai_not_compliant",
  "gbp_not_connected",
  "v4_access_pending",
] as const;
export type AiErrorReason = (typeof AI_ERROR_REASONS)[number];

/** How serious it is: picks the toast type and the inline colour. */
export type AiErrorTone = "info" | "warning" | "critical";

export type AiErrorText = {
  /** Short, sentence case: a toast title or an inline heading. */
  title: string;
  /** What happened and what to do, in plain words. */
  description: string;
  /** A link that resolves it (buy tokens, billing, support). */
  action?: { label: string; href: string };
  tone: AiErrorTone;
  /** The backend `reason`, when there was one. */
  reason?: string;
  /** Trying the same thing again may work (offer "Try again"). */
  retryable: boolean;
};

export type AiErrorTextOptions = {
  /** The title for errors this deck has no words for, e.g. "The ideas couldn't be loaded." */
  fallback?: string;
  /**
   * The user can pay: buy tokens and subscribe (`billing.manage`, owners). Default true, so an owner is
   * never told to ask the owner.
   */
  canBuyTokens?: boolean;
  /** The user can open Settings ▸ Billing (`billing.view`, owners and members). Default true. */
  canViewBilling?: boolean;
  /** The action costs no tokens (keyword ideas), so a failure "charged nothing" rather than "refunded". */
  free?: boolean;
  /** "Now" in ms for the paused copy's resume time; defaults to the call time. */
  now?: number;
};

const BILLING_PATH = "/settings/billing";
// Where a suspended account goes, as in the shell's account banner: straight to the new-ticket form
// (a suspended account can still open a ticket; Help is the self-serve guide).
const SUPPORT_PATH = "/support?new=1";

/** Plan features as the backend names them (`requireFeature`), for the "not in your plan" copy. */
const FEATURE_NAME: Record<string, string> = {
  gbp_posts: "Google posts",
  gbp_report: "reviews and Business Profile reports",
  white_label: "white label",
};

/** The backend `reason` of an API error, if any. */
export function aiErrorReason(error: unknown): string | undefined {
  return isApiError(error) ? error.reason : undefined;
}

/** True when AI itself can't run right now (not switched on, or paused for today), as opposed to one failed request. */
export function isAiUnavailableError(error: unknown): boolean {
  const reason = aiErrorReason(error);
  return reason === "ai_not_configured" || reason === "ai_budget_reached";
}

const numberOf = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** "in 12 minutes" / "at 7:15 PM" / "in a few minutes" for a 429. */
function retryWhen(data: Record<string, unknown>): string {
  const seconds = numberOf(data.retry_after_seconds);
  if (seconds !== undefined && seconds > 0) {
    const minutes = Math.ceil(seconds / 60);
    return minutes <= 1 ? "in a minute" : minutes < 120 ? `in ${minutes} minutes` : `in ${Math.round(minutes / 60)} hours`;
  }
  if (typeof data.next_allowed_at === "string") {
    const at = formatTime(data.next_allowed_at, "");
    if (at) return `at ${at}`;
  }
  return "in a few minutes";
}

/** The backend's own message, unless it is empty or talks about the server (people never need that word). */
function safeMessage(message: string | undefined): string | undefined {
  const text = message?.trim();
  if (!text || /server|request failed/i.test(text)) return undefined;
  return text;
}

/** Words for a failed AI action (pure). */
export function aiErrorText(error: unknown, options: AiErrorTextOptions = {}): AiErrorText {
  const { fallback = "That didn't work", canBuyTokens = true, canViewBilling = true, free = false } = options;
  const billing = canViewBilling ? { label: "Go to billing", href: BILLING_PATH } : undefined;

  if (!isApiError(error)) {
    return { title: fallback, description: "Try again in a moment.", tone: "critical", retryable: true };
  }

  const data = apiErrorData(error);
  const reason = error.reason;
  const base = { reason, retryable: false };

  switch (reason) {
    case "ai_not_configured":
      return { ...base, tone: "info", title: "AI is almost ready", description: "It isn't switched on yet. Until it is, you can do this yourself." };
    case "ai_budget_reached": {
      const now = options.now ?? Date.now();
      const back = formatResumeTime(nextUtcMidnight(now), now);
      return { ...base, tone: "info", title: "AI is paused for today", description: `Today's AI limit has been reached, so nothing was charged. It's back at ${back}.` };
    }
    case "ai_failed":
      // No answer, or (Phase 25a) nothing usable in it: refunded either way, and this says so.
      return {
        ...base,
        tone: "critical",
        retryable: true,
        title: "The AI couldn't finish this",
        description: free
          ? "Nothing usable came back, and nothing was charged. Try again in a moment."
          : "Nothing usable came back, so your tokens were refunded. Try again.",
      };
    case "insufficient_tokens": {
      const cost = numberOf(data.cost);
      const balance = numberOf(data.balance);
      const need =
        cost !== undefined && cost > 0
          ? `This needs ${formatTokens(cost)}${balance !== undefined ? ` and you have ${formatTokenCount(balance)}` : ""}.`
          : "You don't have enough tokens for this.";
      return canBuyTokens
        ? { ...base, tone: "warning", title: "Not enough tokens", description: need, action: { label: "Buy tokens", href: BILLING_PATH } }
        : { ...base, tone: "warning", title: "Not enough tokens", description: `${need} Ask the account owner to add tokens.` };
    }
    case "subscription_required":
      // Only the owner can subscribe (the same `billing.manage` that buys tokens); anyone else is
      // told to ask the owner, as the shell's account banner does, and gets no billing button.
      return canBuyTokens
        ? {
            ...base,
            tone: "warning",
            title: "Your account is read-only",
            description: "AI and other paid actions are paused until you subscribe.",
            ...(billing ? { action: billing } : {}),
          }
        : { ...base, tone: "warning", title: "Your account is read-only", description: "AI and other paid actions are paused. Ask the account owner to subscribe." };
    case "organization_suspended":
      return {
        ...base,
        tone: "critical",
        title: "This account is suspended",
        description: "Contact support to restore access. Your data is kept.",
        action: { label: "Contact support", href: SUPPORT_PATH },
      };
    case "feature_not_included": {
      const feature = typeof data.feature === "string" ? FEATURE_NAME[data.feature] : undefined;
      return {
        ...base,
        tone: "info",
        title: "Not included in your plan",
        description: feature ? `Your plan doesn't include ${feature}.` : "Your plan doesn't include this feature.",
        ...(billing ? { action: { label: "See your plan", href: BILLING_PATH } } : {}),
      };
    }
    case "read_only":
      return { ...base, tone: "info", title: "Your access is read-only", description: "Ask the agency that manages this account to make changes." };
    case "suggestion_limit_reached":
      return {
        ...base,
        tone: "info",
        title: "That's all for today",
        description: "You've used today's keyword ideas for this location. You can still type your own keywords.",
      };
    case "revision_in_progress":
      return { ...base, tone: "info", title: "A change is already on its way", description: "Wait for it to finish, then try again." };
    case "ai_not_compliant":
      return {
        ...base,
        tone: "warning",
        retryable: true,
        title: "The draft didn't meet Google's post rules",
        description: "Your tokens were refunded. Try again, or change the topic.",
      };
    case "gbp_not_connected":
      return { ...base, tone: "warning", title: "Connect Google first", description: "This needs the location's Google Business Profile to be connected." };
    case "v4_access_pending":
      return { ...base, tone: "info", title: "Waiting for Google", description: "Google hasn't granted access to this profile's posts and reviews yet." };
    default:
      break;
  }

  if (reason === "rate_limited" || error.status === 429) {
    return { ...base, tone: "warning", title: "Too many tries for now", description: `Try again ${retryWhen(data)}.` };
  }
  if (error.status === 0) {
    return { ...base, tone: "critical", retryable: true, title: "You seem to be offline", description: "Check your internet connection, then try again." };
  }
  if (error.status === 408) {
    // We stopped waiting, but a charged run usually still finishes (and is charged), so don't invite
    // a second paid run straight away. Free actions can simply be tried again.
    return free
      ? { ...base, tone: "critical", retryable: true, title: "That took too long", description: "Try again in a moment." }
      : {
          ...base,
          tone: "info",
          title: "It's taking longer than usual",
          description: "It may still finish. Check back in a minute before trying again, since each run uses tokens.",
        };
  }
  return {
    ...base,
    tone: "critical",
    retryable: error.status >= 500,
    title: fallback,
    description: safeMessage(error.message) ?? "Try again in a moment.",
  };
}

/**
 * `aiErrorText` with the owner/billing options filled from the signed-in user: owners get
 * "Buy tokens", members and client users are told to ask the owner.
 */
export function useAiErrorText(): (error: unknown, options?: AiErrorTextOptions) => AiErrorText {
  const access = useAccess();
  const canBuyTokens = access.can("billing.manage");
  const canViewBilling = access.can("billing.view");
  return (error, options) => aiErrorText(error, { canBuyTokens, canViewBilling, ...options });
}
