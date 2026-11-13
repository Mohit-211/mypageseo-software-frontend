import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Eye, LoaderCircle, Lock, Send, Sparkles } from "lucide-react";
import { draftAllReviews, getReviews, sendReplies, type Review, type ReviewsSummary } from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { formatTokenCount } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import type { AiStatus } from "@/lib/ai/ai-status";
import { useToastAiError } from "@/lib/ai/toast-ai-error";
import { keywordsPath } from "@/lib/keywords/paths";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import { draftableCount } from "@/lib/reviews/review-metrics";
import { reviewsKey } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";

/** Reviews per `POST reviews/send` call (the API's limit). */
const SEND_BATCH = 100;

type SendFailure = { review_id: string; reviewer: string; reason: string };

const SEND_REASON: Record<string, string> = {
  no_draft: "No draft",
  already_replied: "Already replied",
  deleted_on_google: "No longer on Google",
  google_error: "Google refused it",
};

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

export type BulkRepliesProps = {
  locationId: string;
  summary: ReviewsSummary;
  /** `useAiStatus(locationId)`: whether "Draft all" can run, and why not. */
  ai: AiStatus;
  /**
   * "hero": the large card that leads AI Review Replies (the three steps, celebrates when all is done).
   * "bar": a slim strip above a list (the Reviews page); nothing when there's nothing to do.
   */
  variant?: "hero" | "bar";
  /** Shows the drafts in the list below ("Check the drafts"). */
  onShowDrafts?: () => void;
  className?: string;
};

/**
 * "Draft all": AI drafts a reply for every review without one (except those with suspicious
 * indicators), up to `ai.draft_all_max` per call, then "Continue (N left)". "Send all drafts"
 * publishes every waiting draft in batches after a confirmation. Sending is always the user's click.
 *
 * Never hidden because AI is off or paused: the button stays, disabled, with the reason, so people
 * can find the feature. Hidden only for a read-only client_user, who can't write replies. A read-only
 * or suspended account can't send either (`POST reviews/send` needs billing), so "Send all" is
 * disabled there with the reason.
 *
 * Counts always come from the summary (refetched after every draft, send or reply), never from an
 * older answer. Render it with `key={locationId}`: what it holds (a "Continue", send failures, the
 * confirmation) belongs to one location.
 */
export function BulkReplies({ locationId, summary, ai, variant = "bar", onShowDrafts, className }: BulkRepliesProps) {
  const queryClient = useQueryClient();
  const toastAiError = useToastAiError();
  const canEdit = useCanEdit();
  // A "Draft all" that left reviews for another round: for which location, how many its answer said
  // were left, and whether that answer is still newer than the summary (until the refetch lands).
  const [continued, setContinued] = useState<{ locationId: string; remaining: number; fresh: boolean } | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [failures, setFailures] = useState<SendFailure[]>([]);

  const ownContinue = continued?.locationId === locationId ? continued : null;
  // The live count, except between a "Draft all" answer and the refetch it starts: the answer's own
  // count saves a flash of the old number, and the summary takes over as soon as it's read again.
  const draftable = ownContinue?.fresh ? ownContinue.remaining : draftableCount(summary);
  const drafts = summary.stats?.drafts_pending ?? 0;
  const cost = summary.ai?.draft_all_cost;
  const perCall = summary.ai?.draft_all_max ?? 50;

  /** Reads the reviews (summary, lists, counts) and the balance again; resolves once the reviews are back. */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
    return queryClient.invalidateQueries({ queryKey: reviewsKey(locationId) });
  };

  const draftAll = useMutation({
    mutationFn: () => draftAllReviews(locationId),
    onSuccess: (result) => {
      noteAiSuccess();
      setContinued(result.remaining > 0 ? { locationId, remaining: result.remaining, fresh: true } : null);
      toast.success(`${plural(result.drafted, "reply", "replies")} drafted`, {
        description:
          result.remaining > 0
            ? `${result.remaining} still to draft: press Continue when you're ready.`
            : `Check the drafts, then send them. ${formatTokenCount(result.tokens_spent)} used.`,
      });
    },
    onError: (err) => toastAiError(err, { fallback: "The replies couldn't be drafted" }),
    // Once the summary has been read again, its own count takes over from the answer's. Not returned:
    // the mutation would wait for the refetch before it stops "Drafting…".
    onSettled: () => {
      void refresh().then(() => setContinued((current) => (current?.fresh ? { ...current, fresh: false } : current)));
    },
  });

  const sendAll = useMutation({
    mutationFn: async () => {
      // Every unreplied review with a draft, 100 per page.
      const pending: Review[] = [];
      for (let page = 1; ; page += 1) {
        const list = await getReviews(locationId, { has_draft: true, replied: false, page, limit: SEND_BATCH });
        pending.push(...list.reviews);
        if (pending.length >= list.total || list.reviews.length === 0) break;
      }
      let sent = 0;
      const failed: SendFailure[] = [];
      for (let index = 0; index < pending.length; index += SEND_BATCH) {
        setProgress(`Sending ${Math.min(index + SEND_BATCH, pending.length)} of ${pending.length}…`);
        const batch = pending.slice(index, index + SEND_BATCH);
        const result = await sendReplies(
          locationId,
          batch.map((review) => review.review_id),
        );
        sent += result.sent;
        for (const row of result.results) {
          if (row.status === "sent") continue;
          const review = batch.find((item) => item.review_id === row.review_id);
          failed.push({
            review_id: row.review_id,
            reviewer: review?.reviewer?.display_name ?? "A reviewer",
            reason: (row.reason && SEND_REASON[row.reason]) ?? row.reason ?? row.status,
          });
        }
      }
      return { sent, failed };
    },
    onMutate: () => setFailures([]),
    onSuccess: ({ sent, failed }) => {
      setFailures(failed);
      if (failed.length) toast.warning(`${sent} sent, ${failed.length} not sent`, { description: "The ones that weren't sent are listed on the page." });
      else toast.success(`${plural(sent, "reply", "replies")} published on Google`);
    },
    onError: (err) => toast.error(reviewErrorMessage(err, "The replies couldn't be sent.").message),
    onSettled: () => {
      setProgress(null);
      void refresh();
    },
  });

  if (!canEdit) return null;
  if (variant === "bar" && draftable === 0 && drafts === 0 && failures.length === 0) return null;

  const busy = draftAll.isPending || sendAll.isPending;
  const continuing = ownContinue !== null && draftable > 0;
  const allDone = draftable === 0 && drafts === 0;
  const blocked = !ai.canRun;
  // A read-only or suspended account: AI is off and the backend refuses sending too.
  const accountBlocked = ai.blockedBy === "subscription" || ai.blockedBy === "suspended";
  const sendBlockedReason = ai.blockedBy === "suspended" ? "This account is suspended." : "Sending replies needs an active subscription.";
  // One line about the account (not AI's own reason twice), only when there's something it stops.
  const accountNote = !accountBlocked
    ? null
    : ai.blockedBy === "suspended"
      ? "This account is suspended, so replies can't be drafted or sent."
      : drafts > 0
        ? draftable > 0
          ? "Drafting and sending replies need an active subscription."
          : "Sending replies needs an active subscription."
        : "Drafting replies with AI needs an active subscription.";

  const draftButton =
    draftable > 0 ? (
      <Button
        variant="ai"
        size={variant === "hero" ? "lg" : "sm"}
        aria-busy={draftAll.isPending || undefined}
        disabled={busy || blocked}
        title={blocked ? ai.reason : undefined}
        onClick={() => draftAll.mutate()}
        className={variant === "hero" ? "w-full sm:w-auto" : undefined}
      >
        {draftAll.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
        {draftAll.isPending ? "Drafting…" : continuing ? `Continue (${draftable.toLocaleString()} left)` : `Draft ${plural(draftable, "reply", "replies")}`}
        {cost !== undefined && !draftAll.isPending ? <AiCostChip tokens={cost} variant="inverse" /> : null}
      </Button>
    ) : null;

  const sendButton =
    drafts > 0 ? (
      <Button
        variant={draftable === 0 && variant === "hero" ? "default" : "outline"}
        size={variant === "hero" ? "lg" : "sm"}
        aria-busy={sendAll.isPending || undefined}
        disabled={busy || accountBlocked}
        title={accountBlocked ? sendBlockedReason : undefined}
        onClick={() => setConfirmSend(true)}
        className={variant === "hero" ? "w-full sm:w-auto" : undefined}
      >
        {sendAll.isPending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
        Send all {plural(drafts, "draft", "drafts")}
      </Button>
    ) : null;

  const notes = (
    <>
      {accountNote && (draftable > 0 || drafts > 0) ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>{accountNote}</span>
        </p>
      ) : blocked && draftable > 0 && ai.reason ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-ai" />
          <span>
            {ai.reason} {ai.blockedBy === "off" || ai.blockedBy === "paused" ? "You can still reply to each review yourself below." : null}
          </span>
        </p>
      ) : null}
      {draftAll.isPending ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin text-ai motion-reduce:animate-none" />
          Drafting up to {perCall} replies. It can take up to a minute; you can keep reading meanwhile.
        </p>
      ) : null}
      {progress ? (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
          {progress}
        </p>
      ) : null}
      {failures.length > 0 ? (
        <div role="alert" className="rounded-lg border border-critical/25 bg-critical-surface px-3 py-2.5 text-sm text-critical">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle aria-hidden className="size-4" /> {plural(failures.length, "reply wasn't", "replies weren't")} sent
          </p>
          <ul className="mt-1 space-y-0.5">
            {failures.map((failure) => (
              <li key={failure.review_id}>
                {failure.reviewer}: {failure.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  const confirm = (
    <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish {plural(drafts, "reply", "replies")} on Google?</AlertDialogTitle>
          <AlertDialogDescription>
            Every review with a waiting draft gets that draft published as its reply, exactly as written. If you haven't read them yet, check the drafts first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not yet</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmSend(false);
              sendAll.mutate();
            }}
          >
            Publish replies
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (variant === "bar") {
    return (
      <section aria-label="Reply in bulk" className={cn("space-y-2.5 rounded-xl border border-ai/20 bg-ai-surface/70 p-3 shadow-card sm:px-4", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-linear-to-br from-ai to-ai-hover text-ai-foreground shadow-xs">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-foreground">
                {draftable > 0
                  ? continuing
                    ? `${draftable.toLocaleString()} more ${draftable === 1 ? "reply" : "replies"} to draft with AI`
                    : blocked
                      ? `${plural(draftable, "review is", "reviews are")} waiting for an AI reply`
                      : `AI can draft replies to ${plural(draftable, "review", "reviews")} in one go`
                  : `${plural(drafts, "draft is", "drafts are")} ready to check`}
              </p>
              <p className="text-muted-foreground">
                {draftable > 0 ? "Each in the reviewer's language. Nothing is sent until you send it." : "Read them below, then send them to Google."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
            {draftButton}
            {sendButton}
          </div>
        </div>
        {notes}
        {confirm}
      </section>
    );
  }

  const step = allDone ? 4 : draftable > 0 ? 1 : 2;
  const headline = allDone
    ? "All caught up"
    : draftable > 0
      ? continuing
        ? `${draftable.toLocaleString()} more ${draftable === 1 ? "reply" : "replies"} to draft`
        : blocked
          ? `${plural(draftable, "review is", "reviews are")} waiting for an AI reply`
          : `AI can draft replies to ${plural(draftable, "review", "reviews")}`
      : `${plural(drafts, "draft is", "drafts are")} ready to check`;
  const description: ReactNode = allDone ? (
    "Every review has a reply. New reviews show up here after the next check with Google."
  ) : draftable > 0 ? (
    <>
      AI writes a reply to each one in the reviewer's language: two to four sentences, using your{" "}
      <Link
        to={keywordsPath(locationId)}
        className="rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        keywords
      </Link>{" "}
      where they fit. Reviews with suspicious indicators are skipped. Nothing is sent until you send it.
    </>
  ) : (
    "Read each draft below and change anything you like, then send them to Google. Sending is free."
  );

  return (
    <section
      aria-label="Draft replies with AI"
      className={cn("relative isolate overflow-hidden rounded-xl border border-ai/25 bg-card shadow-card", allDone && "border-success/30", className)}
    >
      {/* AI's colour as a soft wash, never as a block. */}
      <span aria-hidden className={cn("absolute inset-0 -z-10 bg-linear-to-br to-transparent to-60%", allDone ? "from-success-surface" : "from-ai-surface")} />
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", allDone ? "bg-success" : "bg-linear-to-r from-ai via-ai/70 to-primary")} />
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {allDone ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 aria-hidden className="size-4" /> Nothing waiting
              </span>
            ) : (
              <>
                <AiBadge />
                <span className="text-xs font-semibold text-ai">Draft all</span>
              </>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{headline}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
          <ol aria-label="How it works" className="mt-4 flex flex-wrap gap-2">
            {["AI drafts", "You check and edit", "You send"].map((label, index) => {
              const number = index + 1;
              const done = number < step;
              const current = number === step;
              return (
                <li
                  key={label}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium",
                    current ? "border-ai/35 bg-card text-foreground shadow-xs" : done ? "border-success/25 bg-success-surface text-success" : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-xs font-semibold",
                      current ? "bg-ai text-ai-foreground" : done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="size-3.5" /> : number}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
        </div>
        {draftButton || sendButton || onShowDrafts ? (
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch">
            {draftButton}
            {sendButton}
            {draftable === 0 && drafts > 0 && onShowDrafts ? (
              <Button variant="ghost" size="sm" onClick={onShowDrafts}>
                <Eye aria-hidden /> Show the drafts
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {notes ? <div className="space-y-2 px-5 pb-5 empty:hidden sm:px-6">{notes}</div> : null}
      {confirm}
    </section>
  );
}
