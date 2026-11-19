import { api, unwrapData, type QueryParams } from "../client";
import type {
  AiDraftInput,
  AiImageInput,
  AiReviseInput,
  PlanTopicsAnswer,
  PostAiDraftRun,
  PostAiImageRun,
  PostAiReviseRun,
  PostAiRun,
  PostAiRunsList,
  PostAiRunsQuery,
  PostAiRunStart,
  PostAiSeriesNextRun,
  PostIdeasAnswer,
  PostTopic,
  PostTopicsList,
} from "../types/post-ai";
import type {
  ApprovalMode,
  BulkApproveResponse,
  Post,
  PostCreateInput,
  PostCta,
  PostInput,
  PostIssue,
  PostMediaDetails,
  PostMediaList,
  PostMediaPatch,
  PostsDigestSetting,
  PostSeries,
  PostSeriesInput,
  PostSeriesUpdateResult,
  PostsCalendar,
  PostsList,
  PostsQuery,
  PostsSummary,
  PostType,
  ReviewQueue,
  ReviewQueueQuery,
  SeriesAutoConsentInput,
  SeriesPreview,
} from "../types/posts";

/**
 * GBP posts (Phase 9) and AI posts / auto-posts (9.1). Errors carry `data.reason`:
 * `post_incomplete` (422, with `issues`), `invalid_status` / `post_changed` (409),
 * `refresh_too_soon` (429), and the AI reasons (`insufficient_tokens`, `ai_not_configured`,
 * `ai_budget_reached`, `ai_org_budget_reached`, `ai_failed`). Phase 25a: `ai_failed` (502) also means nothing
 * usable came back; the tokens are refunded either way.
 *
 * Phase 25c / 2026-11-17: every AI button on posts answers 202 `{ run, existing }` and the work goes on in a job
 * (poll it: `src/lib/posts/ai-runs.ts`). Errors that can be known at once still come at once: 400
 * `invalid_input`, `instructions_declined` (+ `declined_instructions`, `proposed_facts`; nothing spent),
 * `no_text`, `subject_required`; 404 `post_not_found`, `topic_not_found`, `series_not_found`; 409
 * `post_not_empty`, `invalid_status`, `topic_not_available`, `no_slots`, `series_paused`,
 * `generation_in_progress` (+ `data.run`: show and poll that run); 402 `insufficient_tokens`; 503
 * `ai_not_configured`, `ai_budget_reached`, `ai_org_budget_reached`, `run_not_queued` (nothing spent: try
 * again); 429 `rate_limited` (planning: 6 per location per hour); the billing gates and 403 `read_only`.
 * Scheduling, publishing, retrying and approving a post whose AI text still has a hard finding answer 422
 * `checks_failed` (+ `findings`).
 */
const posts = (locationId: string) => `locations/${encodeURIComponent(locationId)}/posts`;
const post = (locationId: string, postId: string) => `${posts(locationId)}/${encodeURIComponent(postId)}`;
const series = (locationId: string) => `locations/${encodeURIComponent(locationId)}/post-series`;
const oneSeries = (locationId: string, seriesId: string) => `${series(locationId)}/${encodeURIComponent(seriesId)}`;
const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** A start route answers at once (its cheap checks, then a queued job): no long request timer. */
const RUN_START = { timeoutMs: 30_000 } as const;

/** True for a 202 `{ run, existing }` answer (Plan now and Post ideas answer 200 without a run in some cases). */
export function isRunStart(answer: unknown): answer is PostAiRunStart {
  if (!answer || typeof answer !== "object" || !("run" in answer)) return false;
  const run = (answer as { run: unknown }).run;
  return Boolean(run && typeof run === "object" && typeof (run as { run_id?: unknown }).run_id === "string");
}

export async function getPostsSummary(locationId: string, signal?: AbortSignal): Promise<PostsSummary> {
  return unwrapData(await api.get(`${posts(locationId)}/summary`, withSignal(signal)));
}

/**
 * One server page of posts. 2026-11-17: `sort=group` (the default) is the Posts page's order, or a time sort with
 * `order`; `counts` gives the filter chips' numbers (the same filters without `status`).
 */
export async function getPosts(locationId: string, query: PostsQuery, signal?: AbortSignal): Promise<PostsList> {
  return unwrapData(await api.get(posts(locationId), { query: query as QueryParams, ...withSignal(signal) }));
}

/** One post (for `?post=<id>` when it isn't on the list's page). 404 `post_not_found`. */
export async function getPost(locationId: string, postId: string, signal?: AbortSignal): Promise<Post> {
  return unwrapData(await api.get(post(locationId, postId), withSignal(signal)));
}

/**
 * `action: draft` (may be incomplete), `schedule` (needs `scheduled_at`) or `publish`. The answer's `status` says
 * what happened. Phase 25c: `schedule` / `publish` need billing in good standing (402 `subscription_required`,
 * 403 `organization_suspended`); 422 `post_incomplete` (+ `issues`) or `checks_failed` (+ `findings`).
 */
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

/**
 * Phase 25c: who may approve follows the post's `approval.reason` (use the post's `can_approve`). 403
 * `not_an_approver` (+ `approval_reason`); 409 `review_expired` (it went back to drafts), `invalid_status`; 422
 * `checks_failed` (+ `findings`).
 */
export async function approvePost(locationId: string, postId: string, note?: string): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/approve`, note ? { note } : {}));
}

export async function rejectPost(locationId: string, postId: string, note: string): Promise<Post> {
  return unwrapData(await api.post(`${post(locationId, postId)}/reject`, { note }));
}

/* ------------------------------ Review queue ------------------------------ */

/**
 * "Posts to review" (`GET /posts/review`, Phase 25c): the AI posts waiting for a person across the locations the
 * caller may see (client users too), the soonest first. `location_ids` ≤ 100; `limit` ≤ 100 (50).
 */
export async function getReviewQueue(query: ReviewQueueQuery = {}, signal?: AbortSignal): Promise<ReviewQueue> {
  const { location_ids, page, limit } = query;
  return unwrapData(
    await api.get("posts/review", {
      query: { ...(location_ids?.length ? { location_ids: location_ids.join(",") } : {}), page, limit },
      ...withSignal(signal),
    }),
  );
}

/**
 * Bulk approve (`POST /posts/approve`, 1–50 ids): one result per post in the order sent; the others are still
 * approved when one isn't. A post already due comes back `scheduled` (published within moments). 402
 * `subscription_required`, 403 `organization_suspended`.
 */
export async function approvePosts(postIds: readonly string[]): Promise<BulkApproveResponse> {
  return unwrapData(await api.post("posts/approve", { post_ids: postIds }, { timeoutMs: 60_000 }));
}

/* --------------------------- The AI review digest -------------------------- */

/** The signed-in user's daily AI review email ("Daily review email"). */
export async function getPostsDigest(signal?: AbortSignal): Promise<PostsDigestSetting> {
  return unwrapData(await api.get("posts/digest", withSignal(signal)));
}

export async function setPostsDigest(enabled: boolean): Promise<PostsDigestSetting> {
  return unwrapData(await api.put("posts/digest", { enabled }));
}

/**
 * The digest email's opt-out link (`/email/opt-out?list=ai-digest&token=…`), public: post it on a click, never on
 * load. Stops the digest in every organization. 400 `invalid_token` / `invalid_input` ("This link doesn't work
 * any more"); 429 `rate_limited`.
 */
export async function optOutOfPostsDigest(token: string): Promise<{ opted_out: true }> {
  return unwrapData(await api.post("posts/digest/opt-out", { token }, { auth: false }));
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

/**
 * Every location the caller may see (adds `location_name` and `locations`). `from`–`to` at most 93 days.
 * 2026-11-17: each `locations[]` row has `gbp_connected` and `posts { failed, rejected, pending_approval }`, so
 * the calendar needs no `posts/summary` per location.
 */
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

/**
 * JPEG / PNG ≤ 5 MB and ≤ 50 megapixels, ≥ 250×250; comes back cropped to 4:3. 400 `media_type | media_too_small |
 * media_too_large | media_too_plain | media_unreadable | invalid_upload`. Phase 25c: `{ library: true }` adds it
 * to the location's photo library (409 `library_full` `{ limit }`, `library_duplicate` `{ media_id }`).
 */
export async function uploadPostMedia(locationId: string, file: File, options: { library?: boolean } = {}): Promise<PostMediaDetails> {
  const body = new FormData();
  body.append("file", file);
  if (options.library) body.append("library", "true");
  return unwrapData(await api.post(`${posts(locationId)}/media`, body, { timeoutMs: 60_000 }));
}

/**
 * Newest first, 50 per page by default (≤ 100). Phase 25c: `library: true` lists the library only, `false` the
 * other photos; the answer's `library { count, max }` is the library's size and cap (200).
 */
export async function getPostMedia(
  locationId: string,
  page = 1,
  limit = 50,
  signal?: AbortSignal,
  options: { library?: boolean } = {},
): Promise<PostMediaList> {
  return unwrapData(
    await api.get(`${posts(locationId)}/media`, {
      query: { page, limit, ...(options.library === undefined ? {} : { library: options.library }) },
      ...withSignal(signal),
    }),
  );
}

/**
 * Phase 25c (owners and members): move a photo in or out of the library (`library`), write its caption (1–200;
 * `null` = back to the screening's), or "Use anyway" for `stock_like` / `watermark` (`flags_cleared`, `[]` takes it
 * back; library photos only). 400 `library_uploads_only`, `not_in_library`, `invalid_input`; 409 `library_full`,
 * `library_duplicate` `{ media_id }`; 404 `media_not_found`.
 */
export async function updatePostMedia(locationId: string, mediaId: string, patch: PostMediaPatch): Promise<PostMediaDetails> {
  return unwrapData(await api.patch(`${posts(locationId)}/media/${encodeURIComponent(mediaId)}`, patch));
}

/**
 * The editor's live check: the same body as create (no `action`) plus an optional `scheduled_at`.
 * Nothing saved, no Google call, no tokens. For an existing post, send its full current content.
 * Its `issues` include the location's post rules a saved post's own `issues` don't show:
 * `offer_not_allowed_for_lodging` and (Phase 25c) `offer_not_allowed_for_regulated`, `cta_not_allowed_for_regulated`.
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

/* ------------------------------- AI: the runs ------------------------------ */

/**
 * One run (`GET …/posts/ai-runs/:runId`, 2026-11-16): poll it every 3 s while `queued` or `running`; stop on any
 * 404 (`run_not_found`: unknown, another location's, or past its 7 days). Prefer the hooks in
 * `src/lib/posts/ai-runs.ts`.
 */
export async function getPostAiRun(locationId: string, runId: string, signal?: AbortSignal): Promise<PostAiRun> {
  return unwrapData<{ run: PostAiRun }>(await api.get(`${posts(locationId)}/ai-runs/${encodeURIComponent(runId)}`, withSignal(signal))).run;
}

/**
 * The location's runs (`GET …/posts/ai-runs`): `status: "active"` (the default) is every queued or running run,
 * newest first, not paged (a run leaves it as soon as it ends: read it once with `getPostAiRun` for its result);
 * `status: "recent"` those finished in the last 24 h (`page`, `limit` ≤ 50, default 20). `post_id` narrows to one post.
 */
export async function getPostAiRuns(locationId: string, query: PostAiRunsQuery = {}, signal?: AbortSignal): Promise<PostAiRunsList> {
  const { status, post_id, page, limit } = query;
  return unwrapData(
    await api.get(`${posts(locationId)}/ai-runs`, {
      query: { status, ...(post_id ? { post_id } : {}), page, limit },
      ...withSignal(signal),
    }),
  );
}

/* --------------------------- AI: the start routes -------------------------- */

/**
 * "Write with AI" (post writer v2): saves a draft. 202 `{ run, existing }` (`kind: draft`); the run's result is
 * `{ post, topic, declined_instructions, proposed_facts, tokens_spent, image }`: open `result.post` in the editor.
 * `{}` lets the planner pick the best waiting topic; `{ topic_id }` writes a backlog topic; `{ topic }` a typed one.
 * Errors at once: 400 `instructions_declined`, `invalid_input`; 404 `topic_not_found`, `post_not_found`; 409
 * `post_not_empty`, `topic_not_available`, `generation_in_progress` (+ `run`); 402; 503 (incl. `run_not_queued`);
 * 429 `rate_limited`. On the run: `no_topic`, `post_changed`, `ai_failed`, … (refunded).
 */
export async function aiDraftPost(locationId: string, input: AiDraftInput = {}): Promise<PostAiRunStart<PostAiDraftRun>> {
  return unwrapData(await api.post(`${posts(locationId)}/ai-draft`, input, RUN_START));
}

/**
 * "Change it" on a post not on Google yet (replaces the deleted `ai-regenerate`): as asked, or without
 * `instructions` a clearly different post on the same topic; `image: "new"` also makes a new picture. 202
 * `{ run, existing }` (`kind: revise`); the result is `{ post, unscheduled, declined_instructions,
 * proposed_facts, tokens_spent, image }` (`unscheduled`: "Review it, then schedule it again"). At once: 404
 * `post_not_found`; 409 `invalid_status` (on Google), `generation_in_progress` (+ `run`); 400 `no_text`,
 * `instructions_declined` (free); 402; 503. On the run: `post_changed`, `invalid_status` (refunded),
 * `instructions_declined` (free).
 */
export async function aiRevisePost(locationId: string, postId: string, input: AiReviseInput = {}): Promise<PostAiRunStart<PostAiReviseRun>> {
  return unwrapData(await api.post(`${post(locationId, postId)}/ai-revise`, input, RUN_START));
}

/**
 * "Create image": a saved post's picture (`post_id`) or a description's (`prompt_hint`), through the picture
 * service (a library photo, that photo enhanced, or an AI image). 202 `{ run, existing }` (`kind: image`); the
 * result says whether the picture is `attached` (with `post_id` and a post not on Google, it replaces the post's
 * photo), or comes back unattached ("Use this picture"), or `media: null` with `reasons` (no picture: not a
 * failure). Don't offer it on posts on Google (their picture always comes back unattached, and is charged).
 * At once: 400 `subject_required`; 404 `post_not_found`; 409 `generation_in_progress` (+ `run`); 402 / 503 only
 * when the picture can only be an AI image; 503 `run_not_queued`.
 */
export async function aiPostImage(locationId: string, input: AiImageInput): Promise<PostAiRunStart<PostAiImageRun>> {
  return unwrapData(await api.post(`${posts(locationId)}/ai-image`, input, RUN_START));
}

/**
 * "Post ideas" (free; `count` 1–12, default 6; `focus` ≤ 200): 200 with `run: null` when enough ideas wait and
 * there is no `focus` (or a plan can't start but ideas wait); else 202 with what waits now plus a plan run
 * (`existing` when a plan with the same focus already runs). With a `focus`, a plan that can't start answers at
 * once (429 `rate_limited`, 503, 409 `generation_in_progress`).
 */
export async function aiPostTopics(locationId: string, input: { count?: number; focus?: string | null } = {}): Promise<PostIdeasAnswer> {
  return unwrapData(await api.post(`${posts(locationId)}/ai-topics`, input, RUN_START));
}

/* ------------------------------- AI: topics -------------------------------- */

/** The topic backlog (`GET …/posts/topics`, Phase 25c; no AI; client users read it too). */
export async function getPostTopics(locationId: string, signal?: AbortSignal): Promise<PostTopicsList> {
  return unwrapData(await api.get(`${posts(locationId)}/topics`, withSignal(signal)));
}

/**
 * "Plan now" / "Plan more" (owners and members; free; 6 per location per hour). 200 with the list and
 * `backlog_full: true` when the backlog is full and there is no `focus`; else 202 `{ run, existing }` (tell them
 * apart with `isRunStart`). Another focus while a plan runs: 409 `generation_in_progress` (+ `run`). At once: 429
 * `rate_limited`, 503 `ai_*`, `run_not_queued`.
 */
export async function planPostTopics(locationId: string, input: { focus?: string | null } = {}): Promise<PlanTopicsAnswer> {
  return unwrapData(await api.post(`${posts(locationId)}/topics/plan`, input, RUN_START));
}

/**
 * Dismiss a waiting topic (`dismissed`) or restore a dismissed one (`proposed`). 404 `topic_not_found`; 409
 * `invalid_status`, `topic_expired` (+ `expired_because`), `backlog_full`, `topic_changed` (reload).
 */
export async function updatePostTopic(locationId: string, topicId: string, status: "dismissed" | "proposed"): Promise<PostTopic> {
  return unwrapData(await api.patch(`${posts(locationId)}/topics/${encodeURIComponent(topicId)}`, { status }));
}

/* ------------------------------- Auto-posts ------------------------------- */

export async function getPostSeries(locationId: string, signal?: AbortSignal): Promise<{ series: PostSeries[]; limit: number }> {
  return unwrapData(await api.get(series(locationId), withSignal(signal)));
}

/**
 * 400 `gbp_not_connected`, `ends_before_start`, `no_days`, `topics_required` (list mode without topics),
 * `keyword_not_tracked` (+ `keywords`); 409 `too_many_series` (3 active). Phase 25c: every field is optional
 * (`{}` makes "AI posts": weekly at 10:00 local, review mode, images on, automatic topics, every eligible keyword).
 */
export async function createPostSeries(locationId: string, input: PostSeriesInput = {}): Promise<PostSeries> {
  return unwrapData(await api.post(series(locationId), input));
}

/**
 * Phase 25c (C81): a change of the schedule or content takes the series' unpublished posts of future slots back
 * to drafts: the answer's `posts_released` counts them ("N scheduled posts went back to drafts").
 */
export async function updatePostSeries(locationId: string, seriesId: string, patch: PostSeriesInput): Promise<PostSeriesUpdateResult> {
  return unwrapData(await api.patch(oneSeries(locationId, seriesId), patch));
}

/**
 * An agency client's approval of the series' automatic publishing (Phase 25c): a client user of the location's
 * client (`grant_method: "client"`) or the owner attesting it (`owner_attestation`). `{ granted: false }`
 * withdraws it (its scheduled automatic posts go back to review). 400 `auto_consent_not_required` (a Business
 * organization), `invalid_input`; 403 `client_or_owner_only` (a member); 409 `client_changed` (reload); 404
 * `series_not_found`.
 */
export async function setSeriesAutoConsent(locationId: string, seriesId: string, input: SeriesAutoConsentInput): Promise<PostSeries> {
  return unwrapData(await api.put(`${oneSeries(locationId, seriesId)}/auto-consent`, input));
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

/**
 * "Generate next": makes the next slot's post now (spends tokens), whatever the series' `planner` says. 202
 * `{ run, existing }` (`kind: series_next`; `run.post_id` and `run.slot_at` are known at once); the result is
 * `{ post, series, outcome: generated | held | not_handed_over, reason, tokens_spent }`. At once: 404
 * `series_not_found`; 409 `series_paused` (resume it first), `no_slots`; 402 `insufficient_tokens`; 503 `ai_*`,
 * `run_not_queued`. On the run: the slot's own error with its data (`insufficient_tokens`, `ai_failed`,
 * `no_topic`, `topic_not_available`, `series_changed`, …).
 */
export async function generateNextSeriesPost(locationId: string, seriesId: string): Promise<PostAiRunStart<PostAiSeriesNextRun>> {
  return unwrapData(await api.post(`${oneSeries(locationId, seriesId)}/generate-next`, undefined, RUN_START));
}
