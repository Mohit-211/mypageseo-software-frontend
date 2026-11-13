import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generateReviewInsights, isApiError } from "@/api";
import { formatTokenCount } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { reviewsKey } from "./use-reviews";

/** After a timeout, look for the finished run once more this much later (the backend may need up to ~2 minutes). */
const LATE_RUN_CHECK_MS = 40_000;

/**
 * "Generate insights" / "Update insights" (AI, `insights` tokens). The new insights replace the cached
 * ones at once; AI errors go through the shared AI toast, which also updates AI's status on the page.
 */
export function useGenerateInsights(locationId: string) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  return useMutation({
    mutationFn: () => generateReviewInsights(locationId),
    onSuccess: (data) => {
      noteAiSuccess();
      queryClient.setQueryData([...reviewsKey(locationId), "insights"], data);
      toast.success("Insights updated", data.tokens_spent ? { description: `${formatTokenCount(data.tokens_spent)} used.` } : undefined);
    },
    onError: (err) => {
      if (isApiError(err) && err.status === 408) {
        // We stopped waiting, but the run usually still finishes (and is charged): show it when it
        // lands instead of suggesting a second, paid run.
        const insightsKey = [...reviewsKey(locationId), "insights"];
        void queryClient.invalidateQueries({ queryKey: insightsKey });
        window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: insightsKey }), LATE_RUN_CHECK_MS);
        toast.info("Your insights are taking longer than usual", {
          description: "They'll show here when the run finishes. Check back in a minute before running it again, since each run uses tokens.",
        });
        return;
      }
      toastAiError(err, { fallback: "Insights couldn't be generated" });
    },
    // The balance changed (or a refund came back); the insights themselves were set above.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["billing"] }),
  });
}
