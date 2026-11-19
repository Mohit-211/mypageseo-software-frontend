/**
 * "Write the next post now" (`POST …/post-series/:id/generate-next`) as a background run (2026-11-17 entry, sections
 * 1 and 5 item 11). The request claims the series' next free slot with an empty post and answers 202 `{ run,
 * existing }` (`kind: series_next`); the post is written in a job (minutes) and handed over as the series' mode
 * says. The card shows "Writing the next post…" while it works, polled every 3 s, then the outcome:
 * - `generated`: handed over (review mode: it waits for its approver; auto mode: scheduled); `reason: image_failed`
 *   when no picture could be made;
 * - `held`: an automatic post a safety rule holds for a person (`reason` is its first hold);
 * - `not_handed_over`: written, but it stayed a draft with its `error` (charged): a person decides.
 * Failures come at once (404 `series_not_found`, 409 `series_paused` / `no_slots`, 402, 503 incl. `run_not_queued`) or
 * on the run (the slot's own error, `series_changed`, the codes every run can end with), worded by `series-errors.ts`.
 * Leaving the page never cancels it: coming back finds it in the location's active runs.
 */
import { useState } from "react";
import { toast } from "sonner";
import { generateNextSeriesPost, type Post, type PostAiRun, type PostAiSeriesNextRun, type SeriesNextResult } from "@/api";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { runFromConflict, useAiRun, useNoteRunStarted } from "./ai-runs";
import { heldLabel, postProblemWords } from "./approval-labels";
import { formatPostMoment } from "./post-format";
import { useToastSeriesError } from "./series-errors";
import { useInvalidatePosts } from "./use-posts";

const isSeriesNextRun = (run: PostAiRun | null | undefined): run is PostAiSeriesNextRun => run?.kind === "series_next";

export type SeriesNextWords = {
  title: string;
  detail: string | null;
  /** `success`: handed over as planned; `warning`: a person has to look at it. */
  tone: "success" | "warning";
  /** The post to open (null when it was deleted since). */
  post: Post | null;
};

/** Why a post written by Generate next stayed a draft, without the server's own words. */
const NOT_HANDED_OVER: Record<string, string> = {
  interrupted: "It was interrupted before it was handed over. Check it, then schedule it.",
  gbp_unbound: "The location's Google profile was unlinked meanwhile. Link it again, then schedule the post.",
  gbp_not_connected: "The location isn't connected to Google any more. Connect it, then schedule the post.",
  reconnect_required: "Google access needs to be restored. Reconnect Google, then schedule the post.",
  v4_access_pending: "Google hasn't granted access to this profile's posts yet. Schedule the post once it has.",
};

function notHandedOverText(post: Post | null): string {
  const code = post?.error?.code;
  if (code && Object.hasOwn(NOT_HANDED_OVER, code)) return NOT_HANDED_OVER[code] ?? "";
  const words = post ? postProblemWords(post) : null;
  if (words && !/server/i.test(words.text)) return `${words.text} Check it, then schedule it.`;
  return "Check it, then schedule it yourself.";
}

/** "Approve it by Sat, Nov 21 · 3:00 PM, or it goes back to drafts." for a post that waits for review. */
function reviewByText(post: Post): string | null {
  const by = post.approval?.expires_at;
  return by ? `Approve it by ${formatPostMoment(by, { weekday: true })}, or it goes back to drafts.` : null;
}

/** A finished Generate next in words: what happened to the post, from `outcome` and `post.status`. Pure. */
export function seriesNextResultWords(result: SeriesNextResult | null | undefined): SeriesNextWords {
  const post = result?.post ?? null;
  const noPicture = result?.reason === "image_failed" ? "No picture could be made, so it's text only." : null;
  if (result?.outcome === "not_handed_over") {
    return { title: "The next post is written, but it stayed a draft", detail: notHandedOverText(post), tone: "warning", post };
  }
  if (result?.outcome === "held") {
    const hold = result.reason ? heldLabel(result.reason).text : null;
    return {
      title: "The next post is written and waits for review",
      detail: [hold ? `${hold}.` : null, post ? reviewByText(post) : null].filter(Boolean).join(" ") || null,
      tone: "warning",
      post,
    };
  }
  if (!post) return { title: "The next post was written", detail: "It was deleted since.", tone: "success", post: null };
  switch (post.status) {
    case "pending_approval":
      return {
        title: "The next post is written and waits for review",
        detail: [reviewByText(post), noPicture].filter(Boolean).join(" ") || null,
        tone: "success",
        post,
      };
    case "scheduled":
    case "publishing":
      return {
        title: post.scheduled_at ? `The next post is written and goes out ${formatPostMoment(post.scheduled_at, { weekday: true })}` : "The next post is written and scheduled",
        detail: noPicture,
        tone: "success",
        post,
      };
    case "published":
      return { title: "The next post is written and published", detail: noPicture, tone: "success", post };
    case "failed":
    case "rejected":
      return { title: "The next post is written, but it didn't publish", detail: postProblemWords(post)?.text ?? null, tone: "warning", post };
    default:
      return { title: "The next post is written as a draft", detail: noPicture ?? "Check it, then schedule it.", tone: "success", post };
  }
}

export type SeriesNextRuns = {
  /** The location's active runs (`useActivePostRuns`). */
  active: readonly PostAiRun[];
  /** Runs that finished while the page watched them. */
  ended: readonly PostAiRun[];
};

const newest = (a: PostAiRun | null, b: PostAiRun | null) => (!a ? b : !b ? a : Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a);

/**
 * A series' "Write the next post now": `start()`, and the run to show (one started here, one still running from
 * before, or one that finished while the page watched), polled every 3 s while it works (by the location's runs
 * list when it lists it, else on its own). `dismiss()` hides a finished run's outcome.
 */
export function useSeriesNextRun(locationId: string, seriesId: string, runs: SeriesNextRuns) {
  const noteRun = useNoteRunStarted();
  const toastError = useToastSeriesError();
  const invalidate = useInvalidatePosts(locationId);
  const [started, setStarted] = useState<PostAiRun | null>(null);
  const [starting, setStarting] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const mine = (run: PostAiRun) => run.kind === "series_next" && run.series_id === seriesId;
  const listed = runs.active.find(mine) ?? null;
  const ended = runs.ended.find(mine) ?? null;
  const current = listed ?? newest(started, ended);
  const watchId = current && current.run_id !== dismissed ? current.run_id : null;
  // While the location's list polls this run, read it from the cache the list fills; else poll it here.
  const watched = useAiRun(locationId, watchId, { initial: current, poll: !listed });
  const run = isSeriesNextRun(watched.run) ? watched.run : null;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const answer = await generateNextSeriesPost(locationId, seriesId);
      noteAiSuccess();
      noteRun(answer.run);
      setStarted(answer.run);
      setDismissed(null);
      if (answer.existing) toast.info("The next post is already being written.");
    } catch (error) {
      const holder = runFromConflict(error);
      if (holder) {
        noteRun(holder);
        setStarted(holder);
        setDismissed(null);
        return;
      }
      toastError(error, "The next post couldn't be started. Try again.", { onReload: invalidate });
    } finally {
      setStarting(false);
    }
  };

  return {
    start,
    /** The start request is on its way. */
    starting,
    run,
    /** Queued or running: show the progress. */
    active: watched.active,
    progress: watched.progress,
    /** A failed run as an `ApiError` (the same words as that error at once). */
    error: watched.error,
    /** The run is gone (kept 7 days): nothing to show. */
    gone: watched.gone,
    dismiss: () => setDismissed(run?.run_id ?? watchId),
  };
}

export type SeriesNextRunState = ReturnType<typeof useSeriesNextRun>;
