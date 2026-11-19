/**
 * The business brief (Phase 25b): read (polled while a build is queued or running), corrected, its suggestions
 * decided, and the website read again. Free, no tokens. Every change can move the readiness checklist; a confirmed
 * suggestion becomes an owner fact, so the facts list is read again too.
 */
import { useEffect, useRef } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideBriefSuggestion,
  getBusinessBrief,
  isApiError,
  refreshBusinessBrief,
  updateBusinessBrief,
  type BriefPatch,
  type BriefSuggestion,
  type BusinessBriefView,
} from "@/api";
import { invalidateAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { aiFactsKey, aiLocationKey } from "@/lib/ai-settings/use-ai-settings";
import { briefChangeErrorText, briefIsBuilding, refreshErrorText, suggestionErrorText } from "./brief";

/** How often a build in progress is read (it takes minutes). */
export const BRIEF_POLL_MS = 5_000;

export const businessBriefKey = (locationId: string) => [...aiLocationKey(locationId), "brief"] as const;

const isBriefView = (value: BusinessBriefView) => Boolean(value && typeof value === "object" && typeof value.feature === "string" && typeof value.status === "string");

export const businessBriefQuery = (locationId: string) =>
  queryOptions({
    queryKey: businessBriefKey(locationId),
    queryFn: async ({ signal }) => {
      const value = await getBusinessBrief(locationId, signal);
      if (!isBriefView(value)) throw new Error("The answer was incomplete.");
      return value;
    },
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

/**
 * The brief; read again every few seconds while it is being built. When a build ends while it is watched, the
 * readiness checklist is read again (the brief is one of its checks).
 */
export function useBusinessBrief(locationId: string, enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...businessBriefQuery(locationId),
    enabled,
    refetchInterval: (state) => (briefIsBuilding(state.state.data) ? BRIEF_POLL_MS : false),
  });
  const building = briefIsBuilding(query.data);
  const wasBuilding = useRef(building);
  useEffect(() => {
    if (wasBuilding.current && !building) invalidateAiReadiness(queryClient, locationId);
    wasBuilding.current = building;
  }, [building, queryClient, locationId]);
  return query;
}

/** The cached brief with one suggestion replaced by its decided version. */
function withSuggestion(view: BusinessBriefView, suggestion: BriefSuggestion): BusinessBriefView {
  if (!view.brief) return view;
  const swap = (list: BriefSuggestion[]) => list.map((item) => (item.id === suggestion.id ? { ...item, ...suggestion } : item));
  const proof = swap(view.brief.proof_points ?? []);
  const research = swap(view.brief.research ?? []);
  const pending = [...proof, ...research].filter((item) => item.status === "suggested").length;
  return { ...view, brief: { ...view.brief, proof_points: proof, research, suggestions_pending: pending } };
}

export function useBriefMutations(locationId: string) {
  const queryClient = useQueryClient();
  const key = businessBriefKey(locationId);
  const reload = () => void queryClient.invalidateQueries({ queryKey: key });

  const patch = useMutation({
    mutationFn: (body: BriefPatch) => updateBusinessBrief(locationId, body),
    onSuccess: (view) => {
      if (isBriefView(view)) queryClient.setQueryData(key, view);
      invalidateAiReadiness(queryClient, locationId);
    },
    onError: (err) => {
      if (briefChangeErrorText(err).reload) reload();
    },
  });

  const decide = useMutation({
    mutationFn: ({ itemId, action }: { itemId: string; action: "confirm" | "dismiss" }) => decideBriefSuggestion(locationId, itemId, action),
    onSuccess: (answer) => {
      if (answer?.suggestion) queryClient.setQueryData<BusinessBriefView>(key, (view) => (view ? withSuggestion(view, answer.suggestion) : view));
      if (answer?.fact) void queryClient.invalidateQueries({ queryKey: aiFactsKey(locationId) });
      reload();
      invalidateAiReadiness(queryClient, locationId);
    },
    onError: (err) => {
      if (suggestionErrorText(err).reload) {
        reload();
        void queryClient.invalidateQueries({ queryKey: aiFactsKey(locationId) });
      }
    },
  });

  const refresh = useMutation({
    mutationFn: () => refreshBusinessBrief(locationId),
    // The build is queued: reading the brief now shows "queued" and starts the polling.
    onSuccess: () => {
      reload();
      invalidateAiReadiness(queryClient, locationId);
    },
    onError: (err) => {
      if (refreshErrorText(err).reload) reload();
    },
  });

  return { patch, decide, refresh };
}
