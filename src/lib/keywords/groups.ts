/**
 * Keyword groups: named sets of tracked keywords (e.g. by service) for filtering the ranking pages
 * and comparing groups. Free, up to 20 per location, a keyword can be in several. Owner and member
 * edit; a client user reads. Removing a keyword from tracking removes it from its groups.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorData, createKeywordGroup, deleteKeywordGroup, isApiError, updateKeywordGroup, type KeywordGroup } from "@/api";
import { rankingsKey } from "@/lib/rankings/use-rankings";
import { keywordKey } from "./keywords";

/** Words for a failed group change. */
export function groupErrorText(err: unknown, fallback = "The group couldn't be saved. Try again."): string {
  if (!isApiError(err)) return fallback;
  switch (err.reason) {
    case "group_name_taken":
      return "Another group already has this name.";
    case "unknown_keyword": {
      const keywords = apiErrorData(err).keywords;
      return `These keywords aren't tracked anymore: ${Array.isArray(keywords) ? keywords.join(", ") : "some of the selection"}.`;
    }
    case "too_many_groups":
      return `You can have up to ${String(apiErrorData(err).limit ?? 20)} groups.`;
    case "group_not_found":
      return "This group was deleted in the meantime.";
    case "read_only":
      return "Your access is read-only.";
    default:
      return err.status === 400 && err.message && !/server/i.test(err.message) ? err.message : fallback;
  }
}

/** True when `group` contains `keyword` (case and spacing ignored, like the backend). */
export function groupHas(group: KeywordGroup, keyword: string): boolean {
  const key = keywordKey(keyword);
  return group.keywords.some((entry) => keywordKey(entry) === key);
}

/** Create, change and delete groups; every change reloads the location's ranking data (group summaries). */
export function useGroupMutations(locationId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: rankingsKey(locationId), predicate: (query) => query.queryKey[3] !== "tracking" });

  const create = useMutation({
    mutationFn: (body: { name: string; keywords: string[] }) => createKeywordGroup(locationId, body),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ groupId, ...body }: { groupId: string; name?: string; keywords?: string[] }) => updateKeywordGroup(locationId, groupId, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (groupId: string) => deleteKeywordGroup(locationId, groupId),
    onSuccess: refresh,
  });

  return {
    create: create.mutateAsync,
    update: update.mutateAsync,
    remove: remove.mutateAsync,
    /** Adds one keyword to a group (PATCH replaces the list, so the current list plus the keyword). */
    addKeyword: (group: KeywordGroup, keyword: string) =>
      groupHas(group, keyword) ? Promise.resolve(group) : update.mutateAsync({ groupId: group.group_id, keywords: [...group.keywords, keyword] }),
    /** Takes one keyword out of a group (the backend refuses an empty group: delete it instead). */
    removeKeyword: (group: KeywordGroup, keyword: string) =>
      update.mutateAsync({ groupId: group.group_id, keywords: group.keywords.filter((entry) => keywordKey(entry) !== keywordKey(keyword)) }),
    pending: create.isPending || update.isPending || remove.isPending,
  };
}
