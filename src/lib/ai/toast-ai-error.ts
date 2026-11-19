/**
 * `toastAiError(error)`: the one way to report a failed AI action as a toast.
 *
 * Besides showing `aiErrorText`'s words with the right toast type (info / warning / error) and action,
 * it records what the failure says so the rest of the page catches up without a reload:
 * - `noteAiError`: `ai_not_configured` / `ai_budget_reached` (or the organization's `ai_org_budget_reached`) flip
 *   `useAiStatus` to off / paused;
 * - `noteAccountError`: a 402 `subscription_required` / 403 `organization_suspended` reaches the shell's
 *   account banner even when the call wasn't a `useMutation` (ai.md M6).
 *
 * Toasts share one id per reason, so repeated clicks update one toast instead of stacking them.
 * Inside React prefer `useToastAiError()`: it fills the owner/billing options and navigates in-app.
 *
 * While a window is open (the post editor, a dialog), a toast with a button waits until it closes (ui/toast-hold.ts),
 * so a failure inside the window would show nothing. Then the action's link goes into the words instead ("…under
 * Billing, in your account menu."): the toast has no button, shows at once and lets presses through to the window.
 */
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { windowOnScreen } from "@/components/ui/open-windows";
import { useAccess } from "@/hooks/use-access";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { aiErrorText, type AiErrorTextOptions } from "./ai-errors";
import { noteAiError } from "./ai-signal";

export type ToastAiErrorOptions = AiErrorTextOptions & {
  /** Offered as "Try again" when the failure is retryable and there's no other action. */
  onRetry?: () => void;
  /** Follows the action link; defaults to a full page load (pass react-router's navigate inside the app). */
  navigate?: (href: string) => void;
  /** Toast id; defaults to one per reason. */
  id?: string | number;
};

const TOAST_METHOD = { info: "info", warning: "warning", critical: "error" } as const;

/** Where an action's link leads, said in words, for a toast shown over a window (see the file comment). */
const LINK_WORDS: Record<string, string> = {
  "Buy tokens": "You can buy them under Billing, in your account menu.",
  "Go to billing": "You can subscribe under Billing, in your account menu.",
  "See your plan": "Your plan is under Billing, in your account menu.",
};

/** A toast over a window can't be paused or closed (presses go through it), so it stays longer to be read. */
const OVER_WINDOW_MS = 8_000;

export function toastAiError(error: unknown, options: ToastAiErrorOptions = {}): void {
  noteAiError(error);
  noteAccountError(error);
  const { onRetry, navigate, id, ...textOptions } = options;
  const text = aiErrorText(error, textOptions);
  const link = text.action;
  if (link && windowOnScreen()) {
    const where = LINK_WORDS[link.label];
    toast[TOAST_METHOD[text.tone]](text.title, {
      id: id ?? `ai-error:${text.reason ?? "unknown"}`,
      description: where ? `${text.description} ${where}` : text.description,
      duration: OVER_WINDOW_MS,
      // A toast with this id still waiting from before (with its button) shows now, without it.
      action: undefined,
      toasterId: undefined,
    });
    return;
  }
  const go = navigate ?? ((href: string) => window.location.assign(href));
  const action = link
    ? { label: link.label, onClick: () => go(link.href) }
    : text.retryable && onRetry
      ? { label: "Try again", onClick: onRetry }
      : undefined;
  toast[TOAST_METHOD[text.tone]](text.title, {
    id: id ?? `ai-error:${text.reason ?? "unknown"}`,
    description: text.description,
    ...(action ? { action } : {}),
  });
}

/** `toastAiError` bound to the signed-in user (owners get "Buy tokens") and to in-app navigation. */
export function useToastAiError(): (error: unknown, options?: ToastAiErrorOptions) => void {
  const navigate = useNavigate();
  const access = useAccess();
  const canBuyTokens = access.can("billing.manage");
  const canViewBilling = access.can("billing.view");
  return (error, options) =>
    toastAiError(error, {
      canBuyTokens,
      canViewBilling,
      navigate: (href) => {
        void navigate(href);
      },
      ...options,
    });
}
