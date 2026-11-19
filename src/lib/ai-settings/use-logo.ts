/**
 * The location's logo (Phase 25c): read, set (upload or website candidate, with the attestation) and removed. A
 * change writes the answer into the cache and reads the readiness checklist again; "Use for all my locations" also
 * reads every other location's logo and checklist again.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteLocationLogo, getLocationLogo, isApiError, setLocationLogo, type LocationLogoInput, type LocationLogoView } from "@/api";
import { invalidateAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { noteAiError } from "@/lib/ai/ai-signal";
import { aiLocationKey } from "./use-ai-settings";

export const locationLogoKey = (locationId: string) => [...aiLocationKey(locationId), "logo"] as const;

const isLogoView = (value: LocationLogoView) => Boolean(value && typeof value === "object" && "logo" in value && Array.isArray(value.candidates));

export const locationLogoQuery = (locationId: string) =>
  queryOptions({
    queryKey: locationLogoKey(locationId),
    queryFn: async ({ signal }) => {
      const value = await getLocationLogo(locationId, signal);
      if (!isLogoView(value)) throw new Error("The answer was incomplete.");
      return value;
    },
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

export function useLocationLogo(locationId: string, enabled = true) {
  return useQuery({ ...locationLogoQuery(locationId), enabled });
}

/** Every location's logo and checklist (`["locations", id, "ai", "logo" | "readiness"]`). */
const isAnyLogoOrReadiness = (key: readonly unknown[]) => key[0] === "locations" && key[2] === "ai" && (key[3] === "logo" || key[3] === "readiness");

export function useLogoMutations(locationId: string) {
  const queryClient = useQueryClient();
  // `applied_to` (how many other locations got it) is for the toast; the page never reads it from the cache.
  const put = (view: LocationLogoView) => {
    if (isLogoView(view)) queryClient.setQueryData(locationLogoKey(locationId), view);
    invalidateAiReadiness(queryClient, locationId);
  };
  const set = useMutation({
    mutationFn: (input: LocationLogoInput) => setLocationLogo(locationId, input),
    onSuccess: (view, input) => {
      put(view);
      if (input.apply_to === "organization") void queryClient.invalidateQueries({ predicate: (query) => isAnyLogoOrReadiness(query.queryKey) });
    },
    onError: (err) => {
      // AI switched off or paused (for everyone or this organization): every AI status on the page catches up, as
      // after any other AI call.
      noteAiError(err);
      // The website's list changed: read it again so the dialog offers what is there now.
      if (isApiError(err) && err.reason === "logo_candidate_unknown") void queryClient.invalidateQueries({ queryKey: locationLogoKey(locationId) });
    },
  });
  const remove = useMutation({ mutationFn: () => deleteLocationLogo(locationId), onSuccess: put });
  return { set, remove };
}
