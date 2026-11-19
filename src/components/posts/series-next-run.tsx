import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Coins, LoaderCircle, RotateCw, X, XCircle } from "lucide-react";
import type { Post } from "@/api";
import { Button } from "@/components/ui/button";
import { locationPath } from "@/lib/mypageseo/section-links";
import { seriesErrorMessage } from "@/lib/posts/series-errors";
import { seriesNextResultWords, type SeriesNextRunState } from "@/lib/posts/series-run";
import { cn } from "@/lib/utils";

/**
 * "Write the next post now" on a series card, once started (2026-11-17 entry, section 1): "Writing the next post…"
 * with the step's detail and, after a minute, "This can take a few minutes. You can leave this page." (a teammate's
 * run: "Sam is writing the next post…"); then what happened to the post (written and waiting for review, scheduled,
 * held, or kept as a draft) with a way to open it, or why it wasn't written with "Try again" (a failed run costs
 * nothing). Nothing while no run is known.
 */
export function SeriesNextRunStatus({
  locationId,
  next,
  canRetry,
  canBuy,
  onBuyTokens,
  onOpenPost,
}: {
  locationId: string;
  next: SeriesNextRunState;
  /** The viewer may write the next post (owner or member, an active series, AI available). */
  canRetry: boolean;
  /** The viewer may buy tokens (owner). */
  canBuy: boolean;
  onBuyTokens: () => void;
  /** Opens the post in the editor (owners and members); without it, a link to the post on the Posts page. */
  onOpenPost?: ((post: Post) => void) | undefined;
}) {
  const { run, active, progress, error, gone, dismiss } = next;
  if (!run || gone) return null;

  if (active) {
    const title = progress?.teammate ? `${progress.teammate}…` : (progress?.title ?? "Writing the next post…");
    return (
      <div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-lg border border-ai/25 bg-ai-surface px-3 py-2.5 text-sm text-foreground">
        <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-ai" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {progress?.detail ? <p>{progress.detail}</p> : null}
          {progress?.note ? <p className="text-muted-foreground">{progress.note}</p> : null}
        </div>
      </div>
    );
  }

  const dismissButton = (
    <Button size="icon" variant="ghost" className="size-9 shrink-0 text-muted-foreground" aria-label="Dismiss" onClick={dismiss}>
      <X aria-hidden />
    </Button>
  );

  if (run.status === "failed") {
    const text = seriesErrorMessage(error, "The next post couldn't be written.");
    const short = error?.reason === "insufficient_tokens";
    return (
      <div role="alert" className="flex flex-col gap-2.5 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2.5 text-sm text-foreground sm:flex-row sm:items-start">
        <p className="flex min-w-0 flex-1 items-start gap-2">
          <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
          <span>
            <span className="font-semibold">The next post wasn't written.</span> {text.message}
            {/nothing was (spent|kept)|refunded/i.test(text.message) ? "" : " Nothing was spent."}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
          {short && canBuy ? (
            <Button size="sm" variant="outline" className="bg-card" onClick={onBuyTokens}>
              <Coins aria-hidden /> Buy tokens
            </Button>
          ) : null}
          {canRetry && !short ? (
            <Button size="sm" variant="outline" className="bg-card" disabled={next.starting} onClick={() => void next.start()}>
              <RotateCw aria-hidden /> Try again
            </Button>
          ) : null}
          {dismissButton}
        </div>
      </div>
    );
  }

  const words = seriesNextResultWords(run.result);
  const post = words.post;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-foreground sm:flex-row sm:items-start",
        words.tone === "warning" ? "border-warning/40 bg-warning-surface" : "border-success/30 bg-success-surface",
      )}
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        {words.tone === "warning" ? (
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        ) : (
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        )}
        <span>
          <span className="font-semibold">{words.title}.</span>
          {words.detail ? ` ${words.detail}` : ""}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
        {post ? (
          onOpenPost ? (
            <Button size="sm" variant="outline" className="bg-card" onClick={() => onOpenPost(post)}>
              Open the post
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link to={locationPath(locationId, "gbp/posts", `?post=${encodeURIComponent(post.post_id)}`)}>See the post</Link>
            </Button>
          )
        ) : null}
        {dismissButton}
      </div>
    </div>
  );
}
