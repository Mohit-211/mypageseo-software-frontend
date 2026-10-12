import { api, unwrapData, type QueryParams } from "../client";
import type {
  AiImageStyle,
  AiPostDraft,
  ApprovalMode,
  CtaType,
  Post,
  PostCreateInput,
  PostCta,
  PostInput,
  PostIssue,
  PostMedia,
  PostSeries,
  PostSeriesInput,
  PostsCalendar,
  PostsList,
  PostsQuery,
  PostsSummary,
  PostTone,
  PostType,
  SeriesPreview,
} from "../types/posts";

/**
 * GBP posts (Phase 9) and AI posts / auto-posts (9.1). Errors carry `data.reason`:
 * `post_incomplete` (422, with `issues`), `invalid_status` / `post_changed` (409),
 * `refresh_too_soon` (429), and the AI reasons (`insufficient_tokens`, `ai_not_configured`,
 * `ai_budget_reached`, `ai_failed`).
 */
const posts = (locationId: string) => `locations/${encodeURIComponent(locationId)}/posts`;
const post = (locationId: string, postId: string) => `${posts(locationId)}/${encodeURIComponent(postId)}`;
const series = (locationId: string) => `locations/${encodeURIComponent(locationId)}/post-series`;
const oneSeries = (locationId: string, seriesId: string) => `${series(locationId)}/${encodeURIComponent(seriesId)}`;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

export async function getPostsSummary(locationId: string, signal?: AbortSignal): Promise<PostsSummary> {
  return unwrapData(await api.get(`${posts(locationId)}/summary`, withSignal(signal)));
}

export async function getPosts(locationId: string, query: PostsQuery, signal?: AbortSignal): Promise<PostsList> {
  return unwrapData(await api.get(posts(locationId), { query: query as QueryParams, ...withSignal(signal) }));
}

export async function getPost(locationId: string, postId: string, signal?: AbortSignal): Promise<Post> {
  return unwrapData(await api.get(post(locationId, postId), withSignal(signal)));
}

/** `action: draft` (may be incomplete), `schedule` (needs `scheduled_at`) or `publish`. The answer's `status` says what happened. */
export async function createPost(locationId: string, input: PostCreateInput): Promise<Post> {
  return unwrapData(await api.post(posts(locationId), input));
}

/** A post on Google is patched there first (only the changed fields). */
export async function updatePost(locationId: string, postId: string, patch: PostInput): Promise<Post> {
  return unwrapData(await api.patch(post(locationId, postId), patch));
}

export async function deletePost(locationId: string, postId: string): Promise<{ post_id: string; deleted: boolean; deleted_on_google: boolean }> {
  return unwrapData(await api.delete(post(locationId, postId)));
}

export async function schedulePost(locationId: string, postId: string, scheduledAt: string): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/schedule`, { scheduled_at: scheduledAt }));
}

export type PostAction = "publish" | "unschedule" | "retry" | "duplicate";

export async function runPostAction(locationId: string, postId: string, action: PostAction): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/${action}`));
}

export async function approvePost(locationId: string, postId: string, note?: string): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/approve`, note ? { note } : {}));
}

export async function rejectPost(locationId: string, postId: string, note: string): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/reject`, { note }));
}

/** Reads states back from Google and imports posts made there. Once per 15 min (429 `refresh_too_soon`). */
export async function refreshPosts(
  locationId: string,
): Promise<{ updated: number; imported: number; missing: number; refreshed_at: string; next_allowed_at: string | null }> {
  return unwrapData(await api.post(`${posts(locationId)}/refresh`));
}

/** Owner only (403 `owner_only`); `client` needs the location to belong to a client (400 `no_client`). */
export async function updatePostSettings(
  locationId: string,
  settings: { approval?: ApprovalMode; default_cta?: PostCta | null; language_code?: string },
): Promise<PostsSummary["settings"]> {
  return unwrapData<{ settings: PostsSummary["settings"] }>(await api.put(`${posts(locationId)}/settings`, settings)).settings;
}

export async function getPostsCalendar(locationId: string, from: string, to: string, signal?: AbortSignal): Promise<PostsCalendar> {
  return unwrapData(await api.get(`${posts(locationId)}/calendar`, { query: { from, to }, ...withSignal(signal) }));
}

/** Every location the caller may see (adds `location_name` and `locations`). `from`–`to` at most 93 days. */
export async function getOrganizationPostsCalendar(
  from: string,
  to: string,
  locationIds?: string[],
  signal?: AbortSignal,
): Promise<PostsCalendar> {
  return unwrapData(
    await api.get("posts/calendar", {
      query: { from, to, ...(locationIds?.length ? { location_ids: locationIds.join(",") } : {}) },
      ...withSignal(signal),
    }),
  );
}

/* --------------------------------- Photos --------------------------------- */

/** JPEG / PNG ≤ 5 MB, ≥ 250×250; comes back cropped to 4:3. 400 `media_type | media_too_small | media_too_large | media_too_plain`. */
export async function uploadPostMedia(locationId: string, file: File): Promise<PostMedia> {
  const body = new FormData();
  body.append("file", file);
  return unwrapData(await api.post(`${posts(locationId)}/media`, body, { timeoutMs: 60_000 }));
}

/** Newest first, 50 per page by default (≤ 100). */
export async function getPostMedia(
  locationId: string,
  page = 1,
  limit = 50,
  signal?: AbortSignal,
): Promise<{ media: PostMedia[]; page: number; limit: number; total: number }> {
  return unwrapData(await api.get(`${posts(locationId)}/media`, { query: { page, limit }, ...withSignal(signal) }));
}

/**
 * The editor's live check: the same body as create (no `action`) plus an optional `scheduled_at`.
 * Nothing saved, no Google call, no tokens. For an existing post, send its full current content.
 */
export async function validatePost(
  locationId: string,
  input: PostInput & { type: PostType; scheduled_at?: string },
  signal?: AbortSignal,
): Promise<{ issues: PostIssue[]; warnings: { code: string; message: string }[]; complete: boolean }> {
  return unwrapData(await api.post(`${posts(locationId)}/validate`, input, withSignal(signal)));
}

export async function deletePostMedia(locationId: string, mediaId: string): Promise<unknown> {
  return unwrapData(await api.delete(`${posts(locationId)}/media/${encodeURIComponent(mediaId)}`));
}

/* ----------------------------------- AI ----------------------------------- */

export async function aiDraftPost(
  locationId: string,
  input: { topic: string; tone?: PostTone; type?: PostType; cta_type?: CtaType; variants?: number; language_code?: string },
): Promise<{ drafts: AiPostDraft[]; tokens_spent: number }> {
  return unwrapData(await api.post(`${posts(locationId)}/ai-draft`, input, { timeoutMs: 60_000 }));
}

/** 10–60 s. Either a description (`prompt_hint`) or a saved post to illustrate (`post_id`). */
export async function aiPostImage(
  locationId: string,
  input: ({ prompt_hint: string } | { post_id: string }) & { style?: AiImageStyle },
): Promise<{ media: PostMedia; style: AiImageStyle; tokens_spent: number }> {
  return unwrapData(await api.post(`${posts(locationId)}/ai-image`, input, { timeoutMs: 120_000 }));
}

/** New text and / or image for a post not on Google yet; a scheduled post keeps its time. */
export async function aiRegeneratePost(
  locationId: string,
  postId: string,
  input: { text?: boolean; image?: boolean; topic?: string; tone?: PostTone },
): Promise<{ post: Post; tokens_spent: number }> {
  return unwrapData(await api.post(`${post(locationId, postId)}/ai-regenerate`, input, { timeoutMs: 120_000 }));
}

/* ------------------------------- Auto-posts ------------------------------- */

export async function getPostSeries(locationId: string, signal?: AbortSignal): Promise<{ series: PostSeries[]; limit: number }> {
  return unwrapData(await api.get(series(locationId), withSignal(signal)));
}

/** 400 `gbp_not_connected`, `ends_before_start`; 409 `too_many_series` (3 active). */
export async function createPostSeries(locationId: string, input: PostSeriesInput): Promise<PostSeries> {
  return unwrapData(await api.post(series(locationId), input));
}

export async function updatePostSeries(locationId: string, seriesId: string, patch: Partial<PostSeriesInput>): Promise<PostSeries> {
  return unwrapData(await api.patch(oneSeries(locationId, seriesId), patch));
}

/** Its scheduled posts move to Drafts unless `keepScheduled`; published posts stay. */
export async function deletePostSeries(locationId: string, seriesId: string, keepScheduled: boolean): Promise<unknown> {
  return unwrapData(await api.delete(oneSeries(locationId, seriesId), { query: { keep_scheduled: keepScheduled } }));
}

export async function setPostSeriesActive(locationId: string, seriesId: string, active: boolean): Promise<PostSeries> {
  return unwrapData(await api.post(`${oneSeries(locationId, seriesId)}/${active ? "resume" : "pause"}`));
}

export async function previewPostSeries(locationId: string, seriesId: string, count = 5, signal?: AbortSignal): Promise<SeriesPreview> {
  return unwrapData(await api.get(`${oneSeries(locationId, seriesId)}/preview`, { query: { count }, ...withSignal(signal) }));
}

/** Makes the next slot's post now (spends tokens). */
export async function generateNextSeriesPost(locationId: string, seriesId: string): Promise<{ series: PostSeries; post: Post }> {
  return unwrapData(await api.post(`${oneSeries(locationId, seriesId)}/generate-next`, undefined, { timeoutMs: 120_000 }));
}
