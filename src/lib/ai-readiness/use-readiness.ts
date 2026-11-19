/**
 * The readiness checklist's data (`GET …/ai/readiness`, Phase 25b/25c), shared by AI Studio and AI Settings.
 * Free, no AI. Every change that moves a check (facts, the signature, the logo, library photos, the brief) calls
 * `invalidateAiReadiness`, so the checklist follows without a reload.
 */
import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import { getAiReadiness, isApiError, type AiReadiness } from "@/api";

/** Under the location's AI keys (`aiLocationKey` in `use-ai-settings.ts`), written out to keep the modules apart. */
export const aiReadinessKey = (locationId: string) => ["locations", locationId, "ai", "readiness"] as const;

const isReadiness = (value: AiReadiness) => Boolean(value && typeof value === "object" && value.checks && typeof value.total === "number");

export const aiReadinessQuery = (locationId: string) =>
  queryOptions({
    queryKey: aiReadinessKey(locationId),
    queryFn: async ({ signal }) => {
      const value = await getAiReadiness(locationId, signal);
      if (!isReadiness(value)) throw new Error("The answer was incomplete.");
      return value;
    },
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

/** "Get the AI ready · N of M done". */
export function useAiReadiness(locationId: string, enabled = true) {
  return useQuery({ ...aiReadinessQuery(locationId), enabled });
}

/** Reads the checklist again (after a change that can move a check). */
export function invalidateAiReadiness(queryClient: QueryClient, locationId: string): void {
  void queryClient.invalidateQueries({ queryKey: aiReadinessKey(locationId) });
}
