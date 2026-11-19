/**
 * Post topics (Phase 25c; 2026-11-16 "Post topics", 2026-11-17 section 1): each location keeps a backlog of up to
 * 12 planned topics (best first) that never repeat. Planning is free (no token chip anywhere here).
 *
 * - `usePostTopics(locationId)`: `GET …/posts/topics` (client users read it too), keyed under `postsKey`
 *   (`postTopicsKey`), so a plan run's end and any posts reload refresh it.
 * - `useTopicStatus(locationId)`: Dismiss (`dismissed`) or Restore (`proposed`); 409 `invalid_status`,
 *   `topic_expired`, `backlog_full`, `topic_changed` (reload); 404 `topic_not_found`.
 * - Words for a topic's `reasons`, timing and suggestions.
 *
 * "Plan more" (`planPostTopics`) and "Post ideas" (`aiPostTopics`) start runs: `use-post-runs.ts`.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPostTopics, isApiError, updatePostTopic, type PostTopic, type PostTopicsList, type TopicSuggestion } from "@/api";
import { formatDate } from "@/lib/datetime";
import { postTopicsKey } from "./ai-runs";

/** The backlog's size when the server doesn't say (`limits.backlog_max`). */
export const BACKLOG_MAX = 12;

/** How many ideas "Post ideas" asks for (1–12). */
export const IDEAS_COUNT = 6;

/** The longest focus for "Plan more" and "Post ideas". */
export const FOCUS_MAX = 200;

/** `GET …/posts/topics` query options. */
export function postTopicsQuery(locationId: string) {
  return queryOptions({
    queryKey: postTopicsKey(locationId),
    queryFn: ({ signal }) => getPostTopics(locationId, signal),
    retry: false,
  });
}

/** The location's topics: the backlog (best first), reserved, recently used, dismissed, suggestions. */
export function usePostTopics(locationId: string, enabled = true) {
  return useQuery({ ...postTopicsQuery(locationId), enabled: enabled && Boolean(locationId) });
}

/** Why a topic was planned, in words. */
export const TOPIC_REASON_LABEL: Readonly<Record<string, string>> = {
  service_new: "A service you haven't posted about",
  keyword_due: "A keyword that's due for a post",
  keyword_top10: "A keyword you rank in the top 10 for",
  keyword_top20: "A keyword close to the top 10",
  keyword_low: "A keyword to climb on",
  season: "In season now",
  season_ahead: "For the season ahead",
  holiday: "A holiday coming up",
  faq: "A question customers ask",
  owner_offer: "Your own offer",
  owner_event: "Your own event",
  review_theme: "Your recent reviews mention it",
};

/** A topic's reasons in words, known ones only, in the order sent. */
export function topicReasonLabels(reasons: readonly string[] | null | undefined): string[] {
  return (reasons ?? []).flatMap((reason) => (Object.hasOwn(TOPIC_REASON_LABEL, reason) ? [TOPIC_REASON_LABEL[reason] as string] : []));
}

/** When a topic fits ("For Halloween, Oct 31", "Until Nov 30"), or null. */
export function topicTimingText(topic: Pick<PostTopic, "fits" | "valid_until">): string | null {
  const holiday = topic.fits?.holiday;
  if (holiday) return topic.fits.holiday_date ? `For ${holiday}, ${formatDate(topic.fits.holiday_date)}` : `For ${holiday}`;
  if (topic.valid_until) return `Until ${formatDate(topic.valid_until)}`;
  return null;
}

/** The link text for a suggestion (`add_offer`, `add_event`): its facts live in AI Settings. */
export function suggestionLinkText(suggestion: Pick<TopicSuggestion, "code">): string {
  if (suggestion.code === "add_offer") return "Add an offer";
  if (suggestion.code === "add_event") return "Add an event";
  return "Open AI Settings";
}

/** The list with one topic moved to where its new status puts it (the answer of a Dismiss or Restore). */
function withTopic(list: PostTopicsList, topic: PostTopic): PostTopicsList {
  const without = (topics: PostTopic[]) => topics.filter((entry) => entry.topic_id !== topic.topic_id);
  const next: PostTopicsList = {
    ...list,
    backlog: without(list.backlog),
    reserved: without(list.reserved),
    recently_used: without(list.recently_used),
    dismissed: without(list.dismissed),
  };
  if (topic.status === "dismissed") next.dismissed = [topic, ...next.dismissed];
  // A restored topic goes back among the waiting ones; the server's order comes with the next read.
  else if (topic.status === "proposed") next.backlog = [...next.backlog, topic];
  return next;
}

/**
 * Dismiss a waiting topic or restore a dismissed one. The answer goes into the cached list at once, then the
 * list is read again for the server's order. A topic that changed meanwhile (409 `topic_changed`,
 * `topic_expired`, `invalid_status`; 404) reloads the list too.
 */
export function useTopicStatus(locationId: string) {
  const queryClient = useQueryClient();
  const key = postTopicsKey(locationId);
  return useMutation({
    mutationFn: ({ topicId, status }: { topicId: string; status: "dismissed" | "proposed" }) => updatePostTopic(locationId, topicId, status),
    onSuccess: (topic) => {
      if (topic && typeof topic === "object" && "topic_id" in topic) {
        queryClient.setQueryData<PostTopicsList>(key, (list) => (list ? withTopic(list, topic) : list));
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Words for a failed Dismiss, Restore, "Plan more" or "Post ideas" that the AI copy deck has none for. */
export function topicErrorText(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  switch (error.reason) {
    case "backlog_full":
      return "Your list is full. Dismiss a topic to make room, then try again.";
    case "topic_expired":
      return "This topic has expired, so it can't come back. Plan more topics instead.";
    case "invalid_status":
    case "topic_changed":
      return "This topic changed in the meantime. The list has been reloaded.";
    case "topic_not_found":
      return "This topic is gone. The list has been reloaded.";
    case "topic_not_available":
      return "This topic is being written or was just used. Pick another one.";
    default:
      return error.message?.trim() && !/server|request failed/i.test(error.message) ? error.message : fallback;
  }
}
