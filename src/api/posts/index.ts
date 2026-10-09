import { api, unwrapData } from "../client";
import type {
  Post,
  PostAction,
  PostApprovalMode,
  PostCtaType,
  PostInput,
  PostMedia,
  PostsCalendar,
  PostsList,
  PostsListQuery,
  PostsSummary,
  PostAiDraft,
  PostImageStyle,
  PostSeries,
  PostSeriesInput,
  PostSeriesPreview,
  PostTone,
  PostType,
} from "../types/posts";

const base = (locationId: string) => `locations/${encodeURIComponent(locationId)}/posts`;
const one = (locationId: string, postId: string) => `${base(locationId)}/${encodeURIComponent(postId)}`;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** Stats, posting settings, connection state and what the caller may do (`you`). */
export async function getPostsSummary(locationId: string, signal?: AbortSignal): Promise<PostsSummary> {
  return unwrapData(await api.get(`${base(locationId)}/summary`, withSignal(signal)));
}

export async function getPosts(locationId: string, query: PostsListQuery, signal?: AbortSignal): Promise<PostsList> {
  return unwrapData(await api.get(base(locationId), { query, ...withSignal(signal) }));
}

export async function getPost(locationId: string, postId: string, signal?: AbortSignal): Promise<Post> {
  return unwrapData(await api.get(one(locationId, postId), withSignal(signal)));
}

/** Published and scheduled posts by day; at most 93 days. */
export async function getPostsCalendar(locationId: string, from: string, to: string, signal?: AbortSignal): Promise<PostsCalendar> {
  return unwrapData(await api.get(`${base(locationId)}/calendar`, { query: { from, to }, ...withSignal(signal) }));
}

/** 201. `status` says what happened (`pending_approval` when approval is required). 422 `post_incomplete`. */
export async function createPost(locationId: string, body: PostInput & { action?: PostAction }): Promise<Post> {
  return unwrapData(await api.post(base(locationId), body));
}

/** A published post is patched on Google first (502 with Google's reason). 409 `type_change_on_published`, 422 when it must stay complete. */
export async function updatePost(locationId: string, postId: string, body: PostInput): Promise<Post> {
  return unwrapData(await api.patch(one(locationId, postId), body));
}

export async function deletePost(locationId: string, postId: string): Promise<{ post_id: string; deleted: boolean; deleted_on_google: boolean }> {
  return unwrapData(await api.delete(one(locationId, postId)));
}

export async function schedulePost(locationId: string, postId: string, scheduledAt: string): Promise<Post> {
  return unwrapData(await api.post(`${one(locationId, postId)}/schedule`, { scheduled_at: scheduledAt }));
}

/** `publish`, `retry` (only from failed), `unschedule` (back to draft) and `duplicate` (201, a new draft). 409 `invalid_status` / `post_changed`. */
export async function postAction(locationId: string, postId: string, action: "publish" | "retry" | "unschedule" | "duplicate"): Promise<Post> {
  return unwrapData(await api.post(`${one(locationId, postId)}/${action}`));
}

/** 403 `not_an_approver`. */
export async function decidePost(locationId: string, postId: string, decision: "approve" | "reject", note?: string): Promise<Post> {
  return unwrapData(await api.post(`${one(locationId, postId)}/${decision}`, note ? { note } : {}));
}

/** Once per 15 minutes: 429 `refresh_too_soon` (+ `next_allowed_at`). */
export async function refreshPosts(locationId: string): Promise<{ updated: number; imported: number; missing: number; refreshed_at: string; next_allowed_at: string | null }> {
  return unwrapData(await api.post(`${base(locationId)}/refresh`));
}

/** Owner only (403 `owner_only`); `client` needs the location to belong to a client (400 `no_client`). */
export async function updatePostSettings(
  locationId: string,
  body: { approval?: PostApprovalMode; default_cta?: { type: PostCtaType; url?: string | null } | null; language_code?: string },
): Promise<PostsSummary["settings"]> {
  return unwrapData(await api.put(`${base(locationId)}/settings`, body));
}

/** JPEG or PNG, ≤ 5 MB, at least 250×250; cropped to 4:3. 400 `media_type` / `media_too_small` / `media_too_large` / `media_too_plain` / `media_unreadable`. */
export async function uploadPostMedia(locationId: string, file: File): Promise<PostMedia> {
  const form = new FormData();
  form.append("file", file);
  return unwrapData(await api.post(`${base(locationId)}/media`, form));
}

/* AI (Phase 9.1). Errors on every AI route: 402 `insufficient_tokens` { balance, cost }, 503 `ai_not_configured` /
 * `ai_budget_reached`, 502 `ai_failed` (refunded). Costs: `GET billing` → `tokens.ai_costs` (`post_draft`, `post_image`). */

/** Text variants for the editor; nothing is saved. */
export async function aiDraftPost(
  locationId: string,
  body: { topic: string; tone?: PostTone; type?: PostType; cta_type?: PostCtaType; variants?: number },
): Promise<{ drafts: PostAiDraft[]; tokens_spent: number }> {
  return unwrapData(await api.post(`${base(locationId)}/ai-draft`, body, { timeoutMs: 60_000 }));
}

/** 201: a 4:3 image in the location's media; put `media.media_id` in `media_ids`. Takes 10–60 s. */
export async function aiPostImage(
  locationId: string,
  body: ({ prompt_hint: string } | { post_id: string }) & { style?: PostImageStyle },
): Promise<{ media: PostMedia; style: PostImageStyle; tokens_spent: number }> {
  return unwrapData(await api.post(`${base(locationId)}/ai-image`, body, { timeoutMs: 120_000 }));
}

/** New text and / or image for a post not on Google yet; a scheduled post keeps its time. */
export async function aiRegeneratePost(
  locationId: string,
  postId: string,
  body: { text?: boolean; image?: boolean; topic?: string; tone?: PostTone },
): Promise<{ post: Post; tokens_spent: number }> {
  return unwrapData(await api.post(`${one(locationId, postId)}/ai-regenerate`, body, { timeoutMs: 120_000 }));
}

/* Auto-posts: at most 3 active series per location. */

const seriesBase = (locationId: string) => `locations/${encodeURIComponent(locationId)}/post-series`;
const oneSeries = (locationId: string, seriesId: string) => `${seriesBase(locationId)}/${encodeURIComponent(seriesId)}`;

export async function getPostSeries(locationId: string, signal?: AbortSignal): Promise<{ series: PostSeries[]; limit: number }> {
  return unwrapData(await api.get(seriesBase(locationId), withSignal(signal)));
}

/** 400 `gbp_not_connected` / `ends_before_start`, 409 `too_many_series`. Creating it consents to its token spend. */
export async function createPostSeries(locationId: string, body: PostSeriesInput): Promise<PostSeries> {
  return unwrapData(await api.post(seriesBase(locationId), body));
}

/** Applies to posts not generated yet. */
export async function updatePostSeries(locationId: string, seriesId: string, body: Partial<PostSeriesInput>): Promise<PostSeries> {
  return unwrapData(await api.patch(oneSeries(locationId, seriesId), body));
}

/** `resume` can answer 409 `too_many_series`. */
export async function setPostSeriesActive(locationId: string, seriesId: string, active: boolean): Promise<PostSeries> {
  return unwrapData(await api.post(`${oneSeries(locationId, seriesId)}/${active ? "resume" : "pause"}`));
}

/** The next slots and their topics; no AI, free. */
export async function getPostSeriesPreview(locationId: string, seriesId: string, count = 5, signal?: AbortSignal): Promise<PostSeriesPreview> {
  return unwrapData(await api.get(`${oneSeries(locationId, seriesId)}/preview`, { query: { count }, ...withSignal(signal) }));
}

/** 201: writes the next slot's post now (spends tokens). */
export async function generateNextSeriesPost(locationId: string, seriesId: string): Promise<{ series: PostSeries; post: Post }> {
  return unwrapData(await api.post(`${oneSeries(locationId, seriesId)}/generate-next`, undefined, { timeoutMs: 120_000 }));
}

/** Its scheduled posts go back to drafts unless `keepScheduled`; published posts stay. */
export async function deletePostSeries(locationId: string, seriesId: string, keepScheduled: boolean): Promise<unknown> {
  return unwrapData(await api.delete(oneSeries(locationId, seriesId), { query: { keep_scheduled: keepScheduled } }));
}
