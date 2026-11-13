/**
 * One way to report a failed posts action as a toast.
 *
 * AI, token and account reasons go through the AI library's `toastAiError` (same words as AI
 * replies and keyword ideas, "Buy tokens" only for owners, and it tells `useAiStatus` and the shell's
 * account banner what happened, so AI buttons turn off with a reason instead of failing again).
 * Every other reason keeps the posts copy from `postErrorText`.
 */
import { toast } from "sonner";
import { noteAccountError } from "@/lib/billing/account-restriction";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { isAiRoutedError, postErrorText } from "./use-posts";

export type PostErrorToastOptions = {
  /** Offered as "Try again" when the AI library says the failure is retryable. */
  onRetry?: () => void;
  /** Called when the post changed meanwhile (409 `post_changed` / `invalid_status`), after the toast. */
  onReload?: () => void;
};

export function useToastPostError(): (error: unknown, fallback: string, options?: PostErrorToastOptions) => void {
  const toastAiError = useToastAiError();
  return (error, fallback, options = {}) => {
    if (isAiRoutedError(error)) {
      // Also records the outcome for useAiStatus and the account banner.
      toastAiError(error, { fallback, ...(options.onRetry ? { onRetry: options.onRetry } : {}) });
      return;
    }
    noteAccountError(error);
    const { message, reload } = postErrorText(error, fallback);
    toast.error(message);
    if (reload) options.onReload?.();
  };
}
