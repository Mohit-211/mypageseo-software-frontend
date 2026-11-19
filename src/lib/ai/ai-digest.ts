/**
 * The AI review digest (Phase 25c; backend API.md "The AI review digest"): a daily email, in the morning of the
 * recipient's locations, when AI posts wait for their review or new AI reply drafts are ready (owners and members
 * get both, client users the posts waiting for them). Nothing new, no email. It is the user's own setting, for
 * every organization they belong to: `GET /posts/digest` → `{ enabled, opted_out_at }`, `PUT /posts/digest
 * { enabled }`. Every digest's opt-out link (`/email/opt-out?list=ai-digest&token=…`) switches it off too.
 *
 * The digest is behind a server switch (`AI_DIGEST_ENABLED`, off until Mohit's grading round), and features behind
 * a switch show only when it says `on`. `GET /posts/digest` doesn't say yet (contract question): until it does,
 * the setting shows only to someone who switched it off (from a digest's link, or here), which means digests
 * reached them, so they can switch it back on as the opt-out page promises. Once the answer carries `feature`
 * (or `switch`), that decides: `on` shows it, anything else hides it.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPostsDigest, setPostsDigest, type AiFeatureState, type PostsDigestSetting } from "@/api";

/** The answer, with the switch state a later server may add (as the automatic replies and the brief do). */
export type DigestSettingAnswer = PostsDigestSetting & { feature?: AiFeatureState | null; switch?: AiFeatureState | null };

/** Per user, not per organization (a switch of organization reloads it, which is harmless). */
export const DIGEST_SETTING_KEY = ["notifications", "ai-digest"] as const;

export const digestSettingQuery = () =>
  queryOptions({
    queryKey: DIGEST_SETTING_KEY,
    queryFn: ({ signal }): Promise<DigestSettingAnswer> => getPostsDigest(signal),
    staleTime: 60_000,
    retry: false,
  });

/** The server's switch for the digest, when the answer has one; null when it doesn't say. */
export function digestFeature(answer: DigestSettingAnswer | null | undefined): AiFeatureState | null {
  const state = answer?.feature ?? answer?.switch ?? null;
  return state === "on" || state === "switched_off" || state === "not_in_pilot" ? state : null;
}

/**
 * Whether to show the "Daily review email" setting (pure): the switch says `on`; or, while the server doesn't
 * say, the user has it off (`enabled: false`), or changed it on this page (`touched`), so the switch doesn't
 * vanish under their hand when they turn it back on.
 */
export function showDigestSetting(answer: DigestSettingAnswer | null | undefined, touched = false): boolean {
  if (!answer) return false;
  const feature = digestFeature(answer);
  if (feature !== null) return feature === "on";
  return !answer.enabled || touched;
}

/** The setting and its switch: `set(enabled)` saves it (the answer replaces the cached one). */
export function useDigestSetting(options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({ ...digestSettingQuery(), enabled: options.enabled ?? true });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setPostsDigest(enabled),
    // Merged, so a switch state the GET carried stays when the PUT's answer has none.
    onSuccess: (answer) => queryClient.setQueryData<DigestSettingAnswer>(DIGEST_SETTING_KEY, (previous) => ({ ...previous, ...answer })),
  });
  return { query, mutation };
}
