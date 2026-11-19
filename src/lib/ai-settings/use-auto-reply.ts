/**
 * Automatic replies (Phase 25b): `GET/PUT …/reviews/auto-reply`, read and changed. The key sits under the reviews
 * keys, so a reviews reload (a send, a draft) reads the week's counts again too. A change writes its answer into the
 * cache and reads again what shows it elsewhere: the reviews summary (`auto_reply`, the paused stat) and the AI
 * settings' read-only `auto_reply`.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAutoReply, isApiError, updateAutoReply, type AutoReplySettings, type AutoReplyUpdate } from "@/api";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { aiSettingsKey } from "./use-ai-settings";

export const autoReplyKey = (locationId: string) => [...reviewsKey(locationId), "auto-reply"] as const;

const isAutoReply = (value: AutoReplySettings) => Boolean(value && typeof value === "object" && typeof value.feature === "string");

export const autoReplyQuery = (locationId: string) =>
  queryOptions({
    queryKey: autoReplyKey(locationId),
    queryFn: async ({ signal }) => {
      const value = await getAutoReply(locationId, signal);
      if (!isAutoReply(value)) throw new Error("The answer was incomplete.");
      return value;
    },
    retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
  });

/** The location's automatic replies (the card shows only while `feature` is `on`). */
export function useAutoReply(locationId: string, enabled = true) {
  return useQuery({ ...autoReplyQuery(locationId), enabled });
}

/** Errors after which the card reads the setting again (it changed, or the switch or the consent text did). */
const RELOAD_REASONS = new Set(["auto_reply_changed", "consent_outdated", "auto_reply_off", "auto_reply_not_available", "admin_paused"]);

/** Switches on or off, widens, narrows, pauses or resumes; the answer goes straight into the cache. */
export function useUpdateAutoReply(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: AutoReplyUpdate) => updateAutoReply(locationId, update),
    onSuccess: (view) => {
      if (isAutoReply(view)) queryClient.setQueryData(autoReplyKey(locationId), view);
      void queryClient.invalidateQueries({ queryKey: [...reviewsKey(locationId), "summary"] });
      void queryClient.invalidateQueries({ queryKey: aiSettingsKey(locationId) });
    },
    onError: (err) => {
      if (isApiError(err) && err.reason && RELOAD_REASONS.has(err.reason)) void queryClient.invalidateQueries({ queryKey: autoReplyKey(locationId) });
    },
  });
}
