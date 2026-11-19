/**
 * Background AI runs on posts (2026-11-17 entry, section 1). "Write with AI", "Change it", "Create image",
 * "Generate next", "Post ideas" and "Plan now" answer 202 `{ run, existing }` and the work goes on in a job (a
 * post can take minutes). The app shows "Creating…" and polls the run every 3 s. Leaving the page never cancels
 * a run; coming back shows it again.
 *
 * How to use it (the API is in `@/api`: `aiDraftPost`, `aiRevisePost`, `aiPostImage`, `generateNextSeriesPost`,
 * `aiPostTopics`, `planPostTopics`, `getPostAiRun`, `getPostAiRuns`):
 *
 * 1. Start: disable the button until the POST answers, then `noteRun(run)` (from `useNoteRunStarted`) with the
 *    answer's `run`: it seeds the run's cache and refreshes the location's active runs and posts. Post ideas and
 *    Plan now answer 200 without a run in some cases: `isRunStart(answer)` (from `@/api`) tells them apart.
 *    `existing: true` means the same request already runs: show that run, nothing new started.
 * 2. Show it: `useAiRun(locationId, runId, { initial })` polls while `queued` / `running` and stops when it ends or
 *    on a 404 (`run_not_found`, `gone`). `progress` has the guide's lines ("Writing your post…"), the step detail
 *    ("Waiting for another post of this location…"), the after-a-minute note ("This can take a few minutes. You
 *    can leave this page.") and a teammate's line ("Sam is writing this post"). Client users see slim runs (no
 *    requester, input, declined parts or error data).
 * 3. Several runs on one page (a list, the editor coming back): `useActivePostRuns(locationId, { postId })` polls
 *    the active list every 3 s while it has runs and puts each run in `useAiRun`'s cache, so a card can read its
 *    own with `useAiRun(locationId, id, { poll: false })` without polling twice. A run that leaves the list is
 *    read once for its result and lands in `ended` (newest first) and in the run's cache.
 *    `useRecentPostRuns` lists those finished in the last 24 h ("Your post is ready").
 * 4. A post view's `ai_run`: `markerRunId(post.ai_run)` is the run to poll; a `series_slot` marker has nothing to
 *    poll (the series' job is writing it: reload the post later). Keep the button, type, event and offer fields
 *    locked while it is set.
 * 5. 409 `generation_in_progress`: `runFromConflict(error)` is the run holding the post or action (null for a
 *    series post its series is writing): note and poll it like your own.
 * 6. The end: `done` → `run.result`, typed by `run.kind`; `failed` → `runErrorFrom(run)` is an `ApiError` with the
 *    status, `reason` and `data` the route would have answered at once, so `postErrorText`, `toastAiError` and
 *    `useToastPostError` say it as they say that error; offer "Try again" (a failed run costs nothing). When a
 *    run ends, the location's posts queries (lists, summary, calendar, series, photos, topics under
 *    `postsKey`), the organization's (`ORGANIZATION_POSTS_KEY`: calendar, review queue) and the token balance are
 *    invalidated.
 *
 * Query keys live under the location (`["locations", id, "post-ai-runs", …]`), apart from `postsKey`, so a posts
 * reload doesn't refetch every run. The hooks are thin wrappers of `aiRunQuery` and `activePostRunsQuery` (query
 * options, usable with `useQuery`, `prefetchQuery` or `useQueries`).
 */
import { useSyncExternalStore } from "react";
import { queryOptions, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiErrorData,
  getPostAiRun,
  getPostAiRuns,
  getSessionSubject,
  isApiError,
  subscribeToAccessToken,
  type PostAiRun,
  type PostAiRunKind,
  type PostAiRunMarker,
  type PostAiRunsList,
} from "@/api";
import { useNow } from "@/hooks/use-now";
import { postsKey } from "./use-posts";

/** Poll every 3 s while a run is queued or running (the guide's rate). */
export const RUN_POLL_MS = 3_000;
/** After this long, the progress adds "This can take a few minutes. You can leave this page." */
export const RUN_SLOW_AFTER_MS = 60_000;
/** How many finished runs `useActivePostRuns` keeps in `ended`. */
const MAX_ENDED = 20;

/* -------------------------------------------------------------------------- */
/* Query keys                                                                   */
/* -------------------------------------------------------------------------- */

/** Every AI run query of a location. */
export const postAiRunsKey = (locationId: string) => ["locations", locationId, "post-ai-runs"] as const;
/** One run (`GET …/posts/ai-runs/:runId`). */
export const postAiRunKey = (locationId: string, runId: string) => [...postAiRunsKey(locationId), "run", runId] as const;
/** The active runs, of the location or of one post. */
export const activePostRunsKey = (locationId: string, postId?: string | null) => [...postAiRunsKey(locationId), "active", postId ?? null] as const;
/** The runs finished in the last 24 h. */
export const recentPostRunsKey = (locationId: string, query: { postId?: string | null; page?: number; limit?: number } = {}) =>
  [...postAiRunsKey(locationId), "recent", query.postId ?? null, query.page ?? 1, query.limit ?? 20] as const;

/**
 * The topic backlog (`GET …/posts/topics`), under `postsKey` so a plan run's end (and any posts reload) refreshes
 * it. Use it for the topics query.
 */
export const postTopicsKey = (locationId: string) => [...postsKey(locationId), "topics"] as const;

/**
 * The organization-wide posts queries (the posts calendar, the review queue): start their keys with it so a run's
 * end and the location's post changes can refresh them.
 */
export const ORGANIZATION_POSTS_KEY = ["posts"] as const;

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                                 */
/* -------------------------------------------------------------------------- */

type RunLike = Pick<PostAiRun, "status">;

/** Queued or running: show "Creating…" and keep polling. */
export function runIsActive(run: RunLike | null | undefined): boolean {
  return run?.status === "queued" || run?.status === "running";
}

/** Done or failed. */
export function runHasEnded(run: RunLike | null | undefined): boolean {
  return run?.status === "done" || run?.status === "failed";
}

/** The run to poll for a post view's `ai_run` (null when there is none, or for a series slot: nothing to poll). */
export function markerRunId(marker: PostAiRunMarker | null | undefined): string | null {
  return marker?.run_id ?? null;
}

/** True while something works on the post (a run, or its series writing it): show "Creating…" and lock the fields the AI writes. */
export function markerIsActive(marker: PostAiRunMarker | null | undefined): boolean {
  return Boolean(marker && (marker.status === "queued" || marker.status === "running"));
}

/**
 * A failed run's error as an `ApiError`, the same as the route would have thrown at once (`status`, `reason` =
 * `code`, `data`), so the existing error copy works on it. Null unless the run failed. A client user's run has no
 * error data: `data` is then just `{ reason }`.
 */
export function runErrorFrom(run: Pick<PostAiRun, "error"> | null | undefined): ApiError | null {
  const error = run?.error;
  if (!error) return null;
  const data = { ...(error.data ?? {}), reason: error.code };
  return new ApiError(error.message, error.status || 500, {
    reason: error.code,
    details: { success: false, status: error.status, message: error.message, data },
  });
}

function isRunShaped(value: unknown): value is PostAiRun {
  return Boolean(value && typeof value === "object" && typeof (value as { run_id?: unknown }).run_id === "string" && "kind" in value);
}

/** The run in a 409 `generation_in_progress` (`data.run`): show and poll it. Null for another error, or a series post its series is writing. */
export function runFromConflict(error: unknown): PostAiRun | null {
  if (!isApiError(error) || error.reason !== "generation_in_progress") return null;
  const run = apiErrorData(error).run;
  return isRunShaped(run) ? run : null;
}

/** A 4xx that polling can't outlive (404 `run_not_found`, lost access); timeouts and rate limits are retried. */
function stopsPolling(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

/** The run is gone (404 `run_not_found`: unknown, another location's, or past its 7 days). */
export function isRunGone(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

const KIND_LINE: Record<PostAiRunKind, string> = {
  draft: "Writing your post…",
  revise: "Changing your post…",
  image: "Creating your picture…",
  series_next: "Writing the next post…",
  plan: "Finding post ideas…",
};

const TEAMMATE_LINE: Record<PostAiRunKind, (name: string, onPost: boolean) => string> = {
  draft: (name, onPost) => `${name} is writing ${onPost ? "this" : "a"} post`,
  revise: (name) => `${name} is changing this post`,
  image: (name) => `${name} is creating a picture`,
  series_next: (name) => `${name} is writing the next post`,
  plan: (name) => `${name} is finding post ideas`,
};

function stepDetail(run: Pick<PostAiRun, "kind" | "step">): string | null {
  switch (run.step) {
    case "waiting":
      return run.kind === "plan" ? "Waiting for another plan of this location…" : "Waiting for another post of this location…";
    case "planning":
      return run.kind === "plan" ? null : "Planning topics first…";
    case "picture":
      return run.kind === "image" ? null : "Making the picture…";
    default:
      return null;
  }
}

export type RunProgress = {
  /** One line per kind: "Writing your post…", "Changing your post…", "Creating your picture…", "Writing the next post…", "Finding post ideas…". */
  title: string;
  /** The step's detail ("Waiting for another post of this location…", "Planning topics first…", "Making the picture…"), or null. */
  detail: string | null;
  /** After a minute: "This can take a few minutes. You can leave this page." */
  note: string | null;
  /** A teammate's run: "Sam is writing this post" (null for your own, a client user's slim view, or an unnamed account). */
  teammate: string | null;
};

export type RunProgressOptions = {
  /** How long the run has taken so far (the hooks pass it); omitted: no after-a-minute note. */
  elapsedMs?: number;
  /** The signed-in user's id, to tell a teammate's run from your own; without it there is no teammate line. */
  viewerUserId?: string | null;
};

type ProgressRun = Pick<PostAiRun, "kind" | "step" | "post_id" | "requested_by">;

/** What to show while a run works, from the guide's wording. Pure. */
export function runProgress(run: ProgressRun, options: RunProgressOptions = {}): RunProgress {
  const by = run.requested_by;
  const viewer = options.viewerUserId;
  const teammate = by?.name && viewer && by.user_id !== viewer ? TEAMMATE_LINE[run.kind](by.name, Boolean(run.post_id)) : null;
  return {
    title: KIND_LINE[run.kind],
    detail: stepDetail(run),
    note: options.elapsedMs !== undefined && options.elapsedMs >= RUN_SLOW_AFTER_MS ? "This can take a few minutes. You can leave this page." : null,
    teammate,
  };
}

/** The progress as one line: the kind's line, then the step's detail ("Writing your post… Planning topics first…"). */
export function runProgressText(run: ProgressRun, options: RunProgressOptions = {}): string {
  const progress = runProgress(run, options);
  return [progress.title, progress.detail].filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* How long a run has worked                                                    */
/* -------------------------------------------------------------------------- */

/**
 * When this page first received each run (this device's clock), recorded where runs enter the cache (a start's
 * answer, a 409's run, a poll, the active list), never during render. Kept for the session, so coming back to a
 * page counts from the first sight, not from the return.
 */
const firstSeenAt = new Map<string, number>();
const FIRST_SEEN_MAX = 500;

function noteRunSeen(run: Pick<PostAiRun, "run_id">): void {
  if (firstSeenAt.has(run.run_id)) return;
  if (firstSeenAt.size >= FIRST_SEEN_MAX) {
    const oldest = firstSeenAt.keys().next().value;
    if (oldest !== undefined) firstSeenAt.delete(oldest);
  }
  firstSeenAt.set(run.run_id, Date.now());
}

/**
 * How long a run has worked as far as this page can tell, at `now`: from the later of when the page first saw it
 * and its `created_at` (the server's clock, never later than `now`). A run created long before the page saw it (a
 * page opened a minute ago, a run started just now) counts from its own start, and a device clock ahead of the
 * server's never makes it look older than the page has watched it. Pure apart from the first-sight record.
 */
export function runElapsedMs(run: Pick<PostAiRun, "run_id" | "created_at">, now: number): number {
  const created = Date.parse(run.created_at);
  const seen = firstSeenAt.get(run.run_id);
  const starts = [seen, Number.isFinite(created) ? Math.min(created, now) : undefined].filter((value): value is number => value !== undefined);
  return starts.length ? Math.max(0, now - Math.max(...starts)) : 0;
}

/**
 * A working run's elapsed time (`runElapsedMs`), ticking every 5 s while it works, for the after-a-minute note
 * ("This can take a few minutes. You can leave this page."). Undefined for a finished run, or none.
 */
export function useRunElapsed(run: Pick<PostAiRun, "run_id" | "created_at" | "status"> | null | undefined): number | undefined {
  const active = runIsActive(run);
  const now = useNow(active ? 5_000 : 60_000);
  return run && active ? runElapsedMs(run, now) : undefined;
}

/** The signed-in user's id (the session's subject): tells one's own runs from a teammate's ("Sam is writing this post"). */
export function useViewerUserId(): string | null {
  return useSyncExternalStore(subscribeToAccessToken, getSessionSubject, () => null);
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * What a run's end can change: the location's posts (lists, counts, calendar, series, photos, topics), the
 * organization's posts (calendar, review queue) and the token balance.
 */
export function invalidateAfterRun(queryClient: QueryClient, locationId: string): void {
  void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
  void queryClient.invalidateQueries({ queryKey: ORGANIZATION_POSTS_KEY });
  void queryClient.invalidateQueries({ queryKey: ["billing"] });
}

/** Puts a run (a start's answer, a 409's `data.run`) in the cache `useAiRun` reads. */
export function primeAiRun(queryClient: QueryClient, run: PostAiRun): void {
  noteRunSeen(run);
  queryClient.setQueryData(postAiRunKey(run.location_id, run.run_id), run);
}

/**
 * After a start (or a 409 with a run): seeds the run's cache, refreshes the location's active runs (so
 * `useActivePostRuns` starts polling) and its posts (whose `ai_run` now shows the run). Null is ignored.
 */
export function useNoteRunStarted(): (run: PostAiRun | null | undefined) => void {
  const queryClient = useQueryClient();
  return (run) => {
    if (!run) return;
    primeAiRun(queryClient, run);
    void queryClient.invalidateQueries({ queryKey: [...postAiRunsKey(run.location_id), "active"] });
    void queryClient.invalidateQueries({ queryKey: postsKey(run.location_id) });
  };
}

/* -------------------------------------------------------------------------- */
/* One run                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One run's query: polls every 3 s while it is active (when `poll`), stops when it ends and on a 4xx (404
 * `run_not_found`). The first time it sees the run end, the location's posts queries are invalidated.
 */
export function aiRunQuery(queryClient: QueryClient, locationId: string, runId: string, poll = true) {
  const key = postAiRunKey(locationId, runId);
  return queryOptions({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<PostAiRun>(key);
      const run = await getPostAiRun(locationId, runId, signal);
      noteRunSeen(run);
      if (previous && runIsActive(previous) && !runIsActive(run)) invalidateAfterRun(queryClient, locationId);
      return run;
    },
    // A finished run never changes; an active one is always worth a fresh read.
    staleTime: (query) => (query.state.data && !runIsActive(query.state.data) ? Infinity : 0),
    refetchInterval: (query) => {
      if (!poll || stopsPolling(query.state.error)) return false;
      const run = query.state.data;
      return run && !runIsActive(run) ? false : RUN_POLL_MS;
    },
    retry: false,
  });
}

export type AiRunOptions = {
  /** The run as the start route (or a 409, or a list) gave it: shown at once, before the first poll. */
  initial?: PostAiRun | null;
  /** False when a list on the page already polls (`useActivePostRuns`): read the cache only. Default true. */
  poll?: boolean;
  enabled?: boolean;
};

/**
 * One run, polled every 3 s while it is queued or running. `runId` null: nothing to show (the hook stays idle).
 *
 * - `run`: the latest state (null before the first answer, or once `gone`);
 * - `active`: show "Creating…"; `progress`: what to say (`runProgress`);
 * - `error`: a failed run as an `ApiError` (`runErrorFrom`): say it as the same error at once and offer "Try again";
 * - `gone`: 404 `run_not_found` (kept 7 days): stop showing it, the post stays.
 */
export function useAiRun(locationId: string, runId: string | null | undefined, options: AiRunOptions = {}) {
  const queryClient = useQueryClient();
  const { initial, poll = true, enabled = true } = options;
  const seed = initial && runId && initial.run_id === runId ? initial : undefined;
  const query = useQuery({
    ...aiRunQuery(queryClient, locationId, runId ?? "", poll),
    enabled: enabled && Boolean(runId) && Boolean(locationId),
    ...(seed ? { initialData: seed } : {}),
  });
  const viewerUserId = useViewerUserId();
  const run = query.data ?? null;
  const active = runIsActive(run);
  // Ticks while the run works, so the after-a-minute note appears without reading the clock during render; counted
  // from when the page first saw this run (not when the hook mounted: a series card watches long before a click).
  const elapsedMs = useRunElapsed(run);
  return {
    query,
    run,
    active,
    gone: isRunGone(query.error),
    progress: run && active ? runProgress(run, { elapsedMs, viewerUserId }) : null,
    error: runErrorFrom(run),
  };
}

/* -------------------------------------------------------------------------- */
/* The location's runs                                                          */
/* -------------------------------------------------------------------------- */

export type ActivePostRuns = {
  /** Queued or running now, newest first. */
  runs: PostAiRun[];
  /** The runs that finished while this page watched (read once for their result), newest first. */
  ended: PostAiRun[];
};

async function readEndedRun(queryClient: QueryClient, locationId: string, runId: string, signal: AbortSignal): Promise<PostAiRun | null> {
  try {
    const run = await getPostAiRun(locationId, runId, signal);
    primeAiRun(queryClient, run);
    return run;
  } catch (error) {
    if (isRunGone(error)) return null;
    throw error;
  }
}

/**
 * The active runs' query (the location's, or one post's): polled every 3 s while it has runs, stopped on a 4xx.
 * Each run also lands in the single run's cache; a run that leaves the list is read once (its `result` or
 * `error`), lands in `ended`, and the location's posts queries are invalidated.
 */
export function activePostRunsQuery(queryClient: QueryClient, locationId: string, postId: string | null = null) {
  const key = activePostRunsKey(locationId, postId);
  return queryOptions({
    queryKey: key,
    queryFn: async ({ signal }): Promise<ActivePostRuns> => {
      const previous = queryClient.getQueryData<ActivePostRuns>(key);
      const list = await getPostAiRuns(locationId, { status: "active", ...(postId ? { post_id: postId } : {}) }, signal);
      for (const run of list.runs) primeAiRun(queryClient, run);
      const still = new Set(list.runs.map((run) => run.run_id));
      const left = (previous?.runs ?? []).filter((run) => !still.has(run.run_id));
      if (left.length === 0) return { runs: list.runs, ended: previous?.ended ?? [] };
      const finished = (await Promise.all(left.map((run) => readEndedRun(queryClient, locationId, run.run_id, signal)))).filter(
        (run): run is PostAiRun => run !== null,
      );
      invalidateAfterRun(queryClient, locationId);
      const leftIds = new Set(left.map((run) => run.run_id));
      return { runs: list.runs, ended: [...finished, ...(previous?.ended ?? []).filter((run) => !leftIds.has(run.run_id))].slice(0, MAX_ENDED) };
    },
    // Coming back to a page always reads the runs again.
    staleTime: 0,
    refetchInterval: (q) => (stopsPolling(q.state.error) || !q.state.data?.runs.length ? false : RUN_POLL_MS),
    retry: false,
  });
}

/**
 * The location's active runs (or one post's: `postId`), for "Creating…" on the cards and in the editor, and for
 * coming back to a page. Polled every 3 s while it has runs (refresh it after a start: `useNoteRunStarted`).
 * Each run also lands in `useAiRun`'s cache, so a card reads its own with `useAiRun(…, { poll: false })`; a run
 * that leaves the list lands in `ended` (newest first) with its `result` or `error`.
 */
export function useActivePostRuns(locationId: string, options: { postId?: string | null; enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { postId = null, enabled = true } = options;
  const query = useQuery({ ...activePostRunsQuery(queryClient, locationId, postId), enabled: enabled && Boolean(locationId) });
  return { query, runs: query.data?.runs ?? [], ended: query.data?.ended ?? [] };
}

/**
 * The runs finished in the last 24 h (`?status=recent`, newest first; `limit` ≤ 50), e.g. "Your post is ready" for
 * a draft that finished while the editor was closed. Not polled.
 */
export function useRecentPostRuns(locationId: string, options: { postId?: string | null; page?: number; limit?: number; enabled?: boolean } = {}) {
  const { postId = null, page = 1, limit = 20, enabled = true } = options;
  return useQuery<PostAiRunsList>({
    queryKey: recentPostRunsKey(locationId, { postId, page, limit }),
    queryFn: ({ signal }) => getPostAiRuns(locationId, { status: "recent", ...(postId ? { post_id: postId } : {}), page, limit }, signal),
    enabled: enabled && Boolean(locationId),
    retry: false,
  });
}
