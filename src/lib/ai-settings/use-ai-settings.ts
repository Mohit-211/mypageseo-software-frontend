/**
 * AI per location (Phase 25a): the location's AI settings and its facts for the AI, read and changed.
 * Reads work for every role (a client user too); changes are refused for a client user (403
 * `read_only`), so the page doesn't offer them. No AI, no tokens and no Google call: nothing here
 * touches the token balance or billing.
 *
 * Every change writes the answer into the cache, so each section updates at once; settings are then
 * read again, since two saves answering out of order could otherwise leave the older answer on screen.
 * A change that can move the readiness checklist (the signature, a fact) reads it again too.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateAiReadiness } from "@/lib/ai-readiness/use-readiness";
import {
  createAiFact,
  deleteAiFact,
  getAiFacts,
  getAiSettings,
  isApiError,
  updateAiFact,
  updateAiSettings,
  type AiFact,
  type AiFactInput,
  type AiFactPatch,
  type AiFactsList,
  type AiSettings,
  type AiSettingsUpdate,
} from "@/api";
import { isFactGone } from "./errors";

export const aiLocationKey = (locationId: string) => ["locations", locationId, "ai"] as const;
export const aiSettingsKey = (locationId: string) => [...aiLocationKey(locationId), "settings"] as const;
export const aiFactsKey = (locationId: string) => [...aiLocationKey(locationId), "facts"] as const;

const retry = (count: number, err: unknown) => !(isApiError(err) && err.status < 500) && count < 2;

/** An answer without its parts can't be shown (it would read as "all defaults"): treat it as a failure. */
function checked<T>(value: T, ok: (value: T) => boolean): T {
  if (!ok(value)) throw new Error("The answer was incomplete.");
  return value;
}

const isSettings = (value: AiSettings) =>
  Boolean(value && typeof value === "object" && value.settings && value.is_default && value.restricted && value.contact_line_source);
const isFactsList = (value: AiFactsList) => Boolean(value && typeof value === "object" && Array.isArray(value.facts) && value.offers);

export const aiSettingsQuery = (locationId: string) =>
  queryOptions({
    queryKey: aiSettingsKey(locationId),
    queryFn: async ({ signal }) => checked(await getAiSettings(locationId, signal), isSettings),
    retry,
  });

export const aiFactsQuery = (locationId: string) =>
  queryOptions({
    queryKey: aiFactsKey(locationId),
    queryFn: async ({ signal }) => checked(await getAiFacts(locationId, undefined, signal), isFactsList),
    retry,
  });

/** The settings in force, which are defaults, and restricted mode's state. */
export function useAiSettings(locationId: string, enabled = true) {
  return useQuery({ ...aiSettingsQuery(locationId), enabled });
}

/** The location's facts, offers, events and contests (newest first), and whether offers are allowed. */
export function useAiFacts(locationId: string, enabled = true) {
  return useQuery({ ...aiFactsQuery(locationId), enabled });
}

/**
 * Saves any of the settings (`null` = back to the default) and puts the answer in the cache.
 * Restricted mode off: `{ restricted: false, attest: true }`, the owner only.
 */
export function useUpdateAiSettings(locationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: AiSettingsUpdate) => updateAiSettings(locationId, update),
    onSuccess: (view) => {
      if (isSettings(view)) queryClient.setQueryData(aiSettingsKey(locationId), view);
    },
    onSettled: (_view, _err, update) => {
      void queryClient.invalidateQueries({ queryKey: aiSettingsKey(locationId) });
      if ("signature" in update) invalidateAiReadiness(queryClient, locationId);
    },
  });
}

/** The list with `fact` replaced (or added first, as the newest). */
function withFact(list: AiFactsList, fact: AiFact): AiFactsList {
  const known = list.facts.some((entry) => entry.fact_id === fact.fact_id);
  return known
    ? { ...list, facts: list.facts.map((entry) => (entry.fact_id === fact.fact_id ? fact : entry)) }
    : { ...list, facts: [fact, ...list.facts], total: list.total + 1 };
}

/** Add, change, switch on or off, and delete facts; each answer goes straight into the cached list. */
export function useAiFactMutations(locationId: string) {
  const queryClient = useQueryClient();
  const key = aiFactsKey(locationId);
  // The owner's active facts are a readiness check; a fact confirmed from the business brief can be one too.
  const put = (fact: AiFact) => {
    queryClient.setQueryData<AiFactsList>(key, (list) => (list ? withFact(list, fact) : list));
    invalidateAiReadiness(queryClient, locationId);
  };
  // A fact deleted elsewhere: read the list again so it disappears here too.
  const onError = (err: unknown) => {
    if (isFactGone(err)) void queryClient.invalidateQueries({ queryKey: key });
  };

  const create = useMutation({ mutationFn: (input: AiFactInput) => createAiFact(locationId, input), onSuccess: put, onError });
  const update = useMutation({
    mutationFn: ({ factId, patch }: { factId: string; patch: AiFactPatch }) => updateAiFact(locationId, factId, patch),
    onSuccess: put,
    onError,
  });
  const remove = useMutation({
    mutationFn: (factId: string) => deleteAiFact(locationId, factId),
    onSuccess: (_answer, factId) => {
      queryClient.setQueryData<AiFactsList>(key, (list) =>
        list ? { ...list, facts: list.facts.filter((entry) => entry.fact_id !== factId), total: Math.max(0, list.total - 1) } : list,
      );
      invalidateAiReadiness(queryClient, locationId);
    },
    onError,
  });

  return { create, update, remove };
}
