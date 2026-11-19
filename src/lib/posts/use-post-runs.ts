/**
 * Starting AI runs on posts and reacting to their end, on top of `ai-runs.ts` (2026-11-17 entry, section 1).
 *
 * - `usePostRunStart()`: one mutation for every start route ("Write with AI", "Change it", "Create image",
 *   "Plan more", "Post ideas"). It never throws: it resolves to what happened, so the caller shows the run.
 *   A 202 notes the run (`useNoteRunStarted`: the run's cache, the active list, the posts' `ai_run`); a 409
 *   `generation_in_progress` notes the run holding the post or action (shown and polled like one's own); a
 *   400 `instructions_declined` comes back for the caller to show inline (nothing was spent); any other error
 *   is toasted with the posts' words.
 * - `useOnRunEnd(locationId, runIds, onEnd)`: calls `onEnd(run)` once per watched run when the cache sees it
 *   end (`done` or `failed`), e.g. to open a finished draft in the editor or put a new picture in the form.
 * - `useReadyRuns(locationId)`: "Your post is ready" after coming back: the viewer's own "Write with AI" runs
 *   that finished in the last 24 hours (`?status=recent`) and weren't dismissed in this browser.
 * - `useRunOutcomeNotices(locationId, { skip })`: on a page that polls the location's runs, tells the viewer how
 *   their own runs ended when nothing on screen did (the card or the editor that started one is gone). Its "Open it"
 *   is `openPost` (open-post.ts): it works from any page and never replaces a post being edited.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hashKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  aiDraftPost,
  aiPostImage,
  aiRevisePost,
  getSessionSubject,
  isApiError,
  updatePost,
  type AiDraftInput,
  type AiImageStyle,
  type AiPictureResult,
  type ApiError,
  type CtaType,
  type PostAiRun,
  type PostAiRunStart,
  type PostDeclinedInstruction,
  type PostTone,
  type PostType,
} from "@/api";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import {
  activePostRunsKey,
  postAiRunKey,
  runErrorFrom,
  runFromConflict,
  runHasEnded,
  runProgress,
  useNoteRunStarted,
  useRecentPostRuns,
  useViewerUserId,
  type ActivePostRuns,
} from "./ai-runs";
import { STICKY_TOAST, toastPost, type PostToOpen } from "./open-post";
import { declinedFromError, declinedText, noPictureText, unattachedText } from "./post-findings";
import { useToastPostError } from "./post-toasts";
import { isAiRoutedError, postErrorText, useInvalidatePosts } from "./use-posts";

/** The signed-in user's id; one implementation, in `ai-runs.ts` (re-exported for older imports). */
export { useViewerUserId };

/* -------------------------------------------------------------------------- */
/* Starting a run                                                               */
/* -------------------------------------------------------------------------- */

export type RunStartOutcome =
  /** 202: the run started (`existing`: the same request was already running; this is that run). */
  | { kind: "started"; run: PostAiRun; existing: boolean }
  /** 409 `generation_in_progress`: another AI action holds the post or action; this is its run (poll it). */
  | { kind: "busy"; run: PostAiRun }
  /** 409 `generation_in_progress` without a run: the post's series is writing it (reload the post later). */
  | { kind: "series" }
  /** An error the caller shows inline (by default 400 `instructions_declined`: nothing was spent). */
  | { kind: "inline"; error: ApiError }
  /** Any other error, already toasted. */
  | { kind: "failed"; error: unknown };

export type RunStartRequest = {
  start: () => Promise<PostAiRunStart>;
  /** The toast title when it fails for a reason without words of its own. */
  fallback: string;
  /** Reasons the caller shows inline instead of a toast (default: `instructions_declined`). */
  inline?: readonly string[];
  /** "Try again" on a retryable failure. */
  onRetry?: () => void;
  /** The post changed meanwhile (409 `post_changed` / `invalid_status`): reload it. */
  onReload?: () => void;
};

const INLINE_DEFAULT = ["instructions_declined"] as const;

/** Starts an AI run (see the file comment). `mutateAsync` resolves to a `RunStartOutcome`, never rejects. */
export function usePostRunStart() {
  const noteRun = useNoteRunStarted();
  const toastError = useToastPostError();
  const viewerUserId = useViewerUserId();
  return useMutation({
    mutationFn: async (request: RunStartRequest): Promise<RunStartOutcome> => {
      try {
        const answer = await request.start();
        noteRun(answer.run);
        // The start passed AI's own checks (switched on, under today's budget): AI buttons may show as ready.
        noteAiSuccess();
        return { kind: "started", run: answer.run, existing: Boolean(answer.existing) };
      } catch (error) {
        if (isApiError(error) && error.reason === "generation_in_progress") {
          const held = runFromConflict(error);
          if (!held) {
            toast.info("Its series is writing this post", { id: "post-run-series", description: "Open it again in a minute or two." });
            return { kind: "series" };
          }
          noteRun(held);
          const teammate = runProgress(held, { viewerUserId }).teammate;
          toast.info("Another AI action is already working on this", {
            id: `post-run-busy:${held.run_id}`,
            description: teammate ? `${teammate}. Wait for it to finish.` : "Wait for it to finish, then try again.",
          });
          return { kind: "busy", run: held };
        }
        const inline = request.inline ?? INLINE_DEFAULT;
        if (isApiError(error) && error.reason && inline.includes(error.reason)) return { kind: "inline", error };
        toastError(error, request.fallback, {
          ...(request.onRetry ? { onRetry: request.onRetry } : {}),
          ...(request.onReload ? { onReload: request.onReload } : {}),
        });
        return { kind: "failed", error };
      }
    },
  });
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

/** A "Write with AI" request rebuilt from a run's accepted `input` (null for a client user's slim run). */
export function draftInputOf(run: Pick<PostAiRun, "input">): AiDraftInput | null {
  const input = run.input;
  if (!input) return null;
  const topic = text(input.topic);
  const topicId = topic ? null : text(input.topic_id);
  const keywords = strings(input.keywords);
  return {
    ...(topic ? { topic } : {}),
    ...(topicId ? { topic_id: topicId } : {}),
    ...(text(input.tone) ? { tone: input.tone as PostTone } : {}),
    ...(text(input.type) ? { type: input.type as PostType } : {}),
    ...(text(input.cta_type) ? { cta_type: input.cta_type as CtaType } : {}),
    ...(text(input.language_code) ? { language_code: input.language_code as string } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(text(input.instructions) ? { instructions: input.instructions as string } : {}),
    ...(input.image === true ? { image: true } : {}),
  };
}

/**
 * "Try again" for a failed run of the viewer's: the same request, rebuilt from the run (`input`, `post_id`).
 * Null when it can't be rebuilt (a slim run, a plan, Generate next: those have their own buttons).
 */
export function retryStartOf(locationId: string, run: PostAiRun): (() => Promise<PostAiRunStart>) | null {
  if (!run.input) return null;
  const input = run.input;
  switch (run.kind) {
    case "draft": {
      const draft = draftInputOf(run);
      return draft ? () => aiDraftPost(locationId, draft) : null;
    }
    case "revise": {
      const postId = run.post_id;
      if (!postId) return null;
      return () => aiRevisePost(locationId, postId, { ...(text(input.instructions) ? { instructions: input.instructions as string } : {}), image: input.image === "new" ? "new" : "keep" });
    }
    case "image": {
      const style = text(input.style) as AiImageStyle | null;
      const hint = text(input.prompt_hint);
      if (run.post_id) return () => aiPostImage(locationId, { post_id: run.post_id as string, ...(hint ? { prompt_hint: hint } : {}), ...(style ? { style } : {}) });
      return hint ? () => aiPostImage(locationId, { prompt_hint: hint, ...(style ? { style } : {}) }) : null;
    }
    default:
      return null;
  }
}

/** What a finished "Write with AI" or "Change it" says beyond its post. */
export type RunNotesData = {
  /** The parts left out, at once and by the AI. */
  declined: PostDeclinedInstruction[];
  /** Statements the AI couldn't use because no fact says so ("Add as a fact"). */
  facts: string[];
  /** The picture made in the same run (`image: true` / `"new"`). */
  image: AiPictureResult | null;
  /** "Change it" took a scheduled post back to drafts: "Review it, then schedule it again". */
  unscheduled: boolean;
};

/** A done "Write with AI" or "Change it" run's notes, or null when it has nothing to add (or isn't one). Pure. */
export function runNotes(run: PostAiRun): RunNotesData | null {
  if (run.status !== "done" || (run.kind !== "draft" && run.kind !== "revise") || !run.result) return null;
  const result = run.result;
  const declined = [...run.declined_instructions, ...(result.declined_instructions ?? [])];
  const facts = (result.proposed_facts ?? []).filter((fact) => fact.trim());
  const unscheduled = "unscheduled" in result && result.unscheduled === true;
  if (declined.length === 0 && facts.length === 0 && !result.image && !unscheduled) return null;
  return { declined, facts, image: result.image, unscheduled };
}

/* -------------------------------------------------------------------------- */
/* A run's end                                                                  */
/* -------------------------------------------------------------------------- */

/** How many run ids the session remembers per set below (ids never repeat; the oldest go first). */
const RUN_END_MEMORY = 300;

/** Runs whose end a mounted card, editor, writer or list reported (`useOnRunEnd`): they showed it themselves. */
const shownRunEnds = new Set<string>();
/** Runs `useRunOutcomeNotices` already looked at (told or left alone), so a run is never told twice. */
const noticedRunEnds = new Set<string>();

function remember(set: Set<string>, id: string): void {
  if (set.has(id)) return;
  if (set.size >= RUN_END_MEMORY) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
  set.add(id);
}

/**
 * Calls `onEnd(run)` once for each watched run when the query cache sees it `done` or `failed` (a run already
 * ended when it is first watched is reported at once). The runs must be read by someone (`useAiRun`, or the
 * active list), as the cache only knows what was fetched. `onEnd` may set state and show toasts: it runs from
 * the cache's subscription, never during render. A reported run counts as shown, so the page's
 * `useRunOutcomeNotices` doesn't tell it again.
 */
export function useOnRunEnd(locationId: string, runIds: readonly (string | null | undefined)[], onEnd: (run: PostAiRun) => void): void {
  const queryClient = useQueryClient();
  const handler = useRef(onEnd);
  const reported = useRef(new Set<string>());
  useLayoutEffect(() => {
    handler.current = onEnd;
  });
  const ids = runIds.filter((id): id is string => Boolean(id)).join(",");
  useEffect(() => {
    if (!ids || !locationId) return undefined;
    const watched = ids.split(",");
    const check = () => {
      for (const id of watched) {
        if (reported.current.has(id)) continue;
        const run = queryClient.getQueryData<PostAiRun>(postAiRunKey(locationId, id));
        if (run && runHasEnded(run)) {
          reported.current.add(id);
          remember(shownRunEnds, id);
          handler.current(run);
        }
      }
    };
    check();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.query.queryKey[2] === "post-ai-runs") check();
    });
  }, [queryClient, locationId, ids]);
}

/* -------------------------------------------------------------------------- */
/* A run's end nobody on screen showed                                          */
/* -------------------------------------------------------------------------- */

/**
 * How long a toast that asks for something stays (back to drafts, a failure with "Try again", "Use this picture"):
 * long enough to read and act on, where the default 4 s isn't. Hovering it pauses the clock.
 */
export const ACTION_TOAST_MS = 15_000;

/** "Change it" took a scheduled post back to drafts (`unscheduled: true`): the guide's "Review it, then schedule it again". */
export const UNSCHEDULED_TITLE = "Your post is changed and back in drafts";
export const UNSCHEDULED_TEXT = "Review it, then schedule it again. The new text didn't pass every check, so it didn't keep its time.";

/**
 * A failed run's words when the AI copy deck has none for its error (`isAiRoutedError` is false): the posts' words
 * for the same error at once; for a code they don't know, the run's own message when it is plain words.
 */
export function runFailureText(error: ApiError | null): string {
  if (!error) return "Nothing was spent. Try again.";
  if (error.reason === "post_changed") return "Someone saved this post while the AI worked, so their version is kept. Nothing was spent.";
  return postErrorText(error, "Nothing was spent. Try again.").message;
}

type NoticeKind = "draft" | "revise" | "image";

const NOTICE_FAILED_TITLE: Readonly<Record<NoticeKind, string>> = {
  draft: "Your post couldn't be written",
  revise: "Your post couldn't be changed",
  image: "The picture couldn't be made",
};

export type RunOutcomeNoticeOptions = {
  /** Runs the page already shows by itself (AI Posts' writer lists its drafts): not told again. */
  skip?: (run: PostAiRun) => boolean;
};

/**
 * Tells the viewer how their own "Write with AI", "Change it" and "Create a picture" runs ended when nothing on
 * screen did: the card or the editor that started one may be gone by then (the editor closed, the post moved to
 * another list), and the guide asks for every end ("Review it, then schedule it again", a failure with "Try
 * again", "Use this picture"). Mount it on a page that polls the location's runs (`useActivePostRuns(locationId)`):
 * it reads the runs that list saw end (`ended`), and leaves out those a mounted `useOnRunEnd` reported, a
 * teammate's (each person hears of their own) and those `skip` names. Each run is told at most once a session.
 * "Open it" (the post a run wrote or changed) is `openPost`: read again, never over a post being edited, from any page.
 */
export function useRunOutcomeNotices(locationId: string, options: RunOutcomeNoticeOptions = {}): void {
  const queryClient = useQueryClient();
  const starter = usePostRunStart();
  const toastAiError = useToastAiError();
  const toastError = useToastPostError();
  const invalidate = useInvalidatePosts(locationId);
  const latest = useRef({ options, starter, toastAiError, toastError, invalidate });
  useLayoutEffect(() => {
    latest.current = { options, starter, toastAiError, toastError, invalidate };
  });

  useEffect(() => {
    if (!locationId) return undefined;
    const key = activePostRunsKey(locationId);
    const hash = hashKey(key);

    /** "Open it" on the toast: the post the run wrote or changed. */
    const target = (postId: string | null | undefined, run: PostAiRun): PostToOpen | null => (postId ? { locationId, postId, run } : null);

    const attachPicture = async (postId: string, mediaId: string) => {
      try {
        await updatePost(locationId, postId, { media_ids: [mediaId] });
        toast.success("The picture is on the post.");
      } catch (err) {
        latest.current.toastError(err, "The picture couldn't be added.");
      } finally {
        latest.current.invalidate();
      }
    };

    const tellFailure = (run: PostAiRun, kind: NoticeKind, id: string) => {
      const title = NOTICE_FAILED_TITLE[kind];
      const error = runErrorFrom(run);
      const changed = error?.reason === "post_changed";
      const declinedAll = error?.reason === "instructions_declined";
      const restart = changed || declinedAll ? null : retryStartOf(locationId, run);
      const retry = restart ? () => void latest.current.starter.mutateAsync({ start: restart, fallback: "That couldn't be started" }) : undefined;
      if (error && isAiRoutedError(error)) {
        latest.current.toastAiError(error, { fallback: title, id, ...(retry ? { onRetry: retry } : {}) });
        return;
      }
      const declined = declinedAll ? declinedText(declinedFromError(error)) : null;
      toastPost(
        "error",
        title,
        { id, duration: ACTION_TOAST_MS, description: declined ?? runFailureText(error), ...(retry ? { action: { label: "Try again", onClick: retry } } : {}) },
        !retry && changed ? target(run.post_id, run) : null,
      );
    };

    const tell = (run: PostAiRun) => {
      if (run.kind !== "draft" && run.kind !== "revise" && run.kind !== "image") return;
      const id = `post-run-end:${run.run_id}`;
      if (run.status === "failed") {
        tellFailure(run, run.kind, id);
        return;
      }
      if (run.status !== "done" || !run.result) return;
      if (run.kind === "draft") {
        const post = run.result.post;
        // Deleted since: nothing to open.
        if (!post) return;
        const left = declinedText([...run.declined_instructions, ...(run.result.declined_instructions ?? [])]);
        toastPost("success", "Your post is written", { id, description: left ?? "It's in your drafts." }, target(post.post_id, run));
        return;
      }
      if (run.kind === "revise") {
        const postId = run.result.post?.post_id ?? run.post_id;
        if (run.result.unscheduled) toastPost("warning", UNSCHEDULED_TITLE, { id, ...STICKY_TOAST, description: UNSCHEDULED_TEXT }, target(postId, run));
        else toastPost("success", "Your post is changed", { id }, target(postId, run));
        return;
      }
      const result = run.result;
      const media = result.media;
      if (!media) {
        toast.info(noPictureText(result.reasons), { id });
      } else if (result.attached) {
        toastPost("success", "Your picture is on the post", { id }, target(run.post_id, run));
      } else if (!run.post_id) {
        // Asked from a description: never attached; it waits among the location's photos.
        toast.success("Your picture is ready", { id, description: "Pick it under “From gallery” when you edit a post." });
      } else {
        const postId = run.post_id;
        toast.info("Your picture is ready", {
          id,
          duration: ACTION_TOAST_MS,
          description: `${unattachedText(result.attach_error)}${media.kind === "ai" ? " It was charged, so you can still use it." : ""}`,
          action: { label: "Use this picture", onClick: () => void attachPicture(postId, media.media_id) },
        });
      }
    };

    const check = () => {
      const ended = queryClient.getQueryData<ActivePostRuns>(key)?.ended ?? [];
      const viewer = getSessionSubject();
      // Oldest first, so the newest toast ends up on top.
      for (const run of [...ended].reverse()) {
        if (noticedRunEnds.has(run.run_id)) continue;
        remember(noticedRunEnds, run.run_id);
        if (shownRunEnds.has(run.run_id) || !viewer || run.requested_by?.user_id !== viewer) continue;
        if (latest.current.options.skip?.(run)) continue;
        tell(run);
      }
    };

    check();
    // The runs a poll found ended are read (and reported by any `useOnRunEnd` on screen) before the list updates.
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.query.queryHash === hash) check();
    });
  }, [queryClient, locationId]);
}

/* -------------------------------------------------------------------------- */
/* "Your post is ready"                                                         */
/* -------------------------------------------------------------------------- */

const DISMISSED_KEY = "mypageseo.posts.dismissed-runs";
const DISMISSED_MAX = 60;

function readDismissed(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-DISMISSED_MAX)));
  } catch {
    /* storage blocked: it is only a convenience */
  }
}

/** Run ids dismissed from "Your post is ready" in this browser (a per-viewer convenience). */
export function useDismissedRuns(): { dismissed: ReadonlySet<string>; dismiss: (runId: string) => void } {
  const [ids, setIds] = useState<string[]>(readDismissed);
  const dismiss = (runId: string) => {
    setIds((current) => {
      if (current.includes(runId)) return current;
      const next = [...current, runId].slice(-DISMISSED_MAX);
      writeDismissed(next);
      return next;
    });
  };
  return { dismissed: new Set(ids), dismiss };
}

/** One of the viewer's own "Write with AI" runs worth telling about after coming back. */
export function isReadyRun(run: PostAiRun, viewerUserId: string | null): boolean {
  if (run.kind !== "draft" || !viewerUserId || run.requested_by?.user_id !== viewerUserId) return false;
  if (run.status === "failed") return true;
  // A draft someone already scheduled, published or deleted needs no notice.
  return run.status === "done" && run.kind === "draft" && run.result?.post?.status === "draft";
}

/**
 * The viewer's "Write with AI" runs that finished in the last 24 hours (`?status=recent`), ready ones and failed
 * ones, minus those dismissed in this browser. Not polled: runs that end while a page watches come from the
 * active list (`useActivePostRuns(…).ended`).
 */
export function useReadyRuns(locationId: string, options: { enabled?: boolean } = {}) {
  const viewer = useViewerUserId();
  const recent = useRecentPostRuns(locationId, { limit: 10, enabled: (options.enabled ?? true) && Boolean(viewer) });
  const { dismissed, dismiss } = useDismissedRuns();
  const runs = (recent.data?.runs ?? []).filter((run) => isReadyRun(run, viewer) && !dismissed.has(run.run_id));
  return { runs, dismissed, dismiss, viewer };
}
