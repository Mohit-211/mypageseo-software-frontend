import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CirclePause,
  Clock,
  Coins,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  PlugZap,
  Repeat,
  Sparkles,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { deletePostSeries, previewPostSeries, setPostSeriesActive, type Post, type PostSeries } from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { BuyTokensDialog } from "@/components/layout/shared/token-balance";
import { SeriesAutoConsent } from "@/components/posts/series-auto-consent";
import { SeriesNextRunStatus } from "@/components/posts/series-next-run";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import type { AiStatus } from "@/lib/ai/ai-status";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationPath } from "@/lib/mypageseo/section-links";
import { autoPublishSwitchText, seriesPauseLabel, type LabelTone } from "@/lib/posts/approval-labels";
import { formatPostMoment } from "@/lib/posts/post-format";
import { reviewQueuePath } from "@/lib/posts/review-queue";
import { useToastSeriesError } from "@/lib/posts/series-errors";
import { scheduleText, seriesPublishMode, seriesTopicMode } from "@/lib/posts/series-form";
import {
  PLANNER_PAUSED_TITLE,
  WRITE_NEXT_POST_LABEL,
  plannerPausedText,
  seriesHistoryWords,
  seriesNeedsAttention,
  seriesPlanner,
  seriesProblem,
  seriesProblemCopy,
  type PausedPlanner,
} from "@/lib/posts/series-planner";
import { useSeriesNextRun, type SeriesNextRuns } from "@/lib/posts/series-run";
import { CTA_LABEL, TONE_LABEL, postsKey, useInvalidatePosts } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

/** A post of this location on its Posts page (read by id when it isn't on the list's page). */
const postPath = (locationId: string, postId: string) => locationPath(locationId, "gbp/posts", `?post=${encodeURIComponent(postId)}`);

/**
 * One auto-post series (Phase 25c): its schedule, where its topics come from, how its posts go out (review first by
 * default; on their own once automatic publishing is switched on and, for an agency, the client approved it), what
 * needs a person (a pause the series made itself, posts waiting for review, a failed slot), "Write the next post now"
 * as a background run, its recent results and the next topics. Owners and members get the actions; a client user
 * reads it and may give its consent.
 */
export function SeriesCard({
  locationId,
  locationName,
  clientName,
  series,
  ai,
  gbpConnected,
  runs,
  onEdit,
  onOpenPost,
}: {
  locationId: string;
  locationName: string;
  clientName?: string | null | undefined;
  series: PostSeries;
  ai: AiStatus;
  gbpConnected: boolean;
  /** The location's active runs and the ones that ended while the page watched (`useActivePostRuns`). */
  runs: SeriesNextRuns;
  onEdit: () => void;
  onOpenPost: (post: Post) => void;
}) {
  const canEdit = useCanEdit();
  const access = useAccess();
  const canBuy = access.can("billing.manage");
  const { connect } = useGbpConnect();
  const now = useNow();
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastSeriesError();
  const next = useSeriesNextRun(locationId, series.series_id, runs);
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useQuery({
    queryKey: [...postsKey(locationId), "series", series.series_id, "preview"],
    queryFn: ({ signal }) => previewPostSeries(locationId, series.series_id, 5, signal),
    enabled: showPreview,
    retry: false,
  });
  const perPost = ai.costs.post_draft + (series.include_image ? ai.costs.post_image : 0);
  const planner = seriesPlanner(series);
  const plannerOn = planner === "on";
  const problem = seriesProblem(series);
  const attention = seriesNeedsAttention(series);
  const waiting = series.waiting_for_review ?? 0;
  const writing = next.starting || next.active;

  const act = async (key: "toggle" | "delete", action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toastError(err, "That didn't work. Try again.", { onReload: invalidate });
    } finally {
      setBusy(null);
      invalidate();
    }
  };

  return (
    <article aria-label={series.name} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Repeat} tone="ai" className="mt-0.5" />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              {series.name}
              <StatusBadge tone={series.active ? "success" : "neutral"} dot size="sm">
                {series.active ? "Active" : "Paused"}
              </StatusBadge>
              {attention ? (
                <StatusBadge tone="warning" icon={AlertTriangle} size="sm">
                  Needs attention
                </StatusBadge>
              ) : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              {scheduleText(series.cadence, series.time_of_day)} · {series.time_zone}
              {series.time_zone_source === "default" ? " (no time zone set)" : ""}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground" title={series.include_image ? "The picture costs tokens only when it is an AI image." : undefined}>
          {series.include_image ? "Per post, up to" : "Per post"} <AiCostChip tokens={perPost} balance={ai.balance} />
        </p>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {planner !== "on" ? <PlannerNotice planner={planner} canWriteNow={canEdit && series.active} /> : null}
        {series.paused ? <SelfPauseNote locationId={locationId} paused={series.paused} canResume={canEdit} /> : null}
        {problem ? (
          <SeriesProblem
            error={problem}
            active={series.active}
            now={now}
            action={
              problem.code === "insufficient_tokens" && canBuy ? (
                <Button size="sm" variant="outline" className="bg-card" onClick={() => setBuying(true)}>
                  <Coins aria-hidden /> Buy tokens
                </Button>
              ) : problem.code === "gbp_not_connected" && canEdit && !gbpConnected ? (
                <Button size="sm" variant="outline" className="bg-card" onClick={() => connect()}>
                  <PlugZap aria-hidden /> Connect Google
                </Button>
              ) : undefined
            }
            askOwner={problem.code === "insufficient_tokens" && !canBuy}
          />
        ) : null}
        <SeriesNextRunStatus
          locationId={locationId}
          next={next}
          canRetry={canEdit && series.active && ai.canRun}
          canBuy={canBuy}
          onBuyTokens={() => setBuying(true)}
          onOpenPost={canEdit ? onOpenPost : undefined}
        />
        {waiting > 0 ? (
          <div className="flex flex-col gap-2.5 rounded-lg border border-info/25 bg-info-surface px-3 py-2.5 text-sm text-foreground sm:flex-row sm:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                {waiting === 1 ? "1 post of this series waits for review." : `${waiting} posts of this series wait for review.`}
                {waiting >= 2 && plannerOn && series.active ? " The series writes no new post until one is reviewed." : ""}
              </span>
            </p>
            <Button asChild size="sm" variant="outline" className="shrink-0 self-start bg-card max-sm:ml-6 sm:self-center">
              <Link to={reviewQueuePath(locationId)}>{waiting === 1 ? "Review it" : "Review them"}</Link>
            </Button>
          </div>
        ) : null}
        <SeriesAutoConsent locationId={locationId} series={series} locationName={locationName} clientName={clientName} />

        <dl className="grid gap-4 pt-1 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            {/* While the planner is paused nothing is written for these times: never "coming up". */}
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {plannerOn || !series.active ? "Coming up" : "Planned slots (paused)"}
            </dt>
            <dd className="mt-1.5">
              {series.active && series.next_slots.length > 0 ? (
                <ul className="space-y-1">
                  {series.next_slots.slice(0, 3).map((slot) => (
                    <li key={slot} className={cn("flex items-center gap-1.5", plannerOn ? "text-foreground" : "text-muted-foreground")}>
                      <CalendarClock aria-hidden className={cn("size-3.5 shrink-0", plannerOn ? "text-ai" : "text-muted-foreground")} />
                      {formatPostMoment(slot, { weekday: true })}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">{series.active ? "Nothing scheduled" : "Paused: no new posts"}</span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Topics</dt>
            <dd className="mt-1.5 space-y-1.5">
              <TopicsText series={series} />
              <p className="text-muted-foreground">
                {series.keywords?.length ? `Keywords: ${series.keywords.join(", ")}` : "Keywords: all your tracked keywords"}
              </p>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before it goes out</dt>
            <dd className="mt-1.5 space-y-0.5">
              <PublishingText series={series} clientUser={access.role === "client_user"} />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</dt>
            <dd className="mt-1.5 space-y-0.5 text-foreground">
              <p>{TONE_LABEL[series.tone]} tone</p>
              <p>{series.include_image ? "Text and a picture" : "Text only"}</p>
              <p className="text-muted-foreground">Button: {series.cta ? CTA_LABEL[series.cta.type] : "chosen for each post"}</p>
            </dd>
          </div>
        </dl>

        {/* Top-aligned, so the row stays put while "Recent results" is open. */}
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 text-sm">
          <span className="font-medium text-foreground">
            {series.posts_generated} post{series.posts_generated === 1 ? "" : "s"} written so far
          </span>
          {series.history.length > 0 ? (
            <details className="group text-sm">
              <summary className="relative cursor-pointer rounded-sm font-medium text-primary outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1.5 pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:content-['']">
                Recent results
              </summary>
              <ul className="mt-2 space-y-1">
                {series.history.slice(0, 8).map((entry, index) => {
                  const words = seriesHistoryWords(entry);
                  const Icon = HISTORY_ICON[words.tone];
                  return (
                    // Two entries can share a slot and a moment (an expired post and the pause it caused): key by position.
                    <li key={`${index}-${entry.outcome}`} className="flex items-start gap-1.5">
                      <Icon aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", HISTORY_ICON_CLASS[words.tone])} />
                      <span className={words.tone === "critical" ? "text-critical" : "text-muted-foreground"}>
                        {formatPostMoment(entry.slot_at)}: {words.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
          <button
            type="button"
            aria-expanded={showPreview}
            className="relative cursor-pointer rounded-sm font-medium text-primary outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1.5 pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:content-['']"
            onClick={() => setShowPreview((value) => !value)}
          >
            {showPreview ? "Hide the next topics" : "See the next topics"}
          </button>
        </div>
        {showPreview ? (
          preview.isPending ? (
            <LoaderCircle aria-label="Loading" className="size-4 animate-spin text-muted-foreground" />
          ) : preview.data ? (
            preview.data.slots.length > 0 ? (
              <ul className="space-y-1 rounded-lg bg-surface-strong px-3 py-2.5 text-sm">
                {preview.data.slots.map((slot) => (
                  <li key={slot.slot_at} className="text-foreground">
                    <span className="font-medium">{formatPostMoment(slot.slot_at, { weekday: true })}</span>:{" "}
                    {slot.topic ? `“${slot.topic}”` : <span className="text-muted-foreground">AI plans the topic when it writes the post</span>}
                    {/* Nothing is written on its own while the planner is paused. */}
                    {plannerOn ? <span className="text-muted-foreground"> (written {formatPostMoment(slot.generates_at)})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-sm text-muted-foreground">No dates left in this series.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">The next topics couldn't be loaded.</p>
          )
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-strong/60 px-4 py-3 sm:px-5">
          {series.active ? (
            <Button
              size="sm"
              variant="outline"
              className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
              disabled={busy !== null || writing || !ai.canRun}
              title={ai.reason}
              aria-busy={writing || undefined}
              onClick={() => void next.start()}
            >
              {writing ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} {writing ? "Writing the next post…" : WRITE_NEXT_POST_LABEL}
              <AiCostChip tokens={perPost} balance={ai.balance} />
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={onEdit}>
            <Pencil aria-hidden /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void act(
                "toggle",
                () => setPostSeriesActive(locationId, series.series_id, !series.active),
                series.active ? "Paused. No new posts are written until you resume it." : "Resumed.",
              )
            }
          >
            {busy === "toggle" ? <LoaderCircle aria-hidden className="animate-spin" /> : series.active ? <Pause aria-hidden /> : <Play aria-hidden />}{" "}
            {series.active ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="ghost" className="text-critical hover:text-critical" disabled={busy !== null} onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden /> Delete
          </Button>
        </div>
      ) : null}
      {deleting ? (
        <DeleteSeriesDialog
          name={series.name}
          onClose={() => setDeleting(false)}
          onDelete={(keepScheduled) => {
            setDeleting(false);
            void act("delete", () => deletePostSeries(locationId, series.series_id, keepScheduled), "Series deleted.");
          }}
        />
      ) : null}
      {buying ? <BuyTokensDialog onClose={() => setBuying(false)} /> : null}
    </article>
  );
}

const HISTORY_ICON: Record<LabelTone | "success", LucideIcon> = {
  success: CheckCircle2,
  critical: XCircle,
  warning: AlertTriangle,
  ai: Clock,
  info: Clock,
  neutral: Clock,
};

const HISTORY_ICON_CLASS: Record<LabelTone | "success", string> = {
  success: "text-success",
  critical: "text-critical",
  warning: "text-warning",
  ai: "text-ai",
  info: "text-info",
  neutral: "text-muted-foreground",
};

/** Where the series' topics come from: planned by AI (Phase 25c `topic_mode: auto`) or its own list, in turn. */
function TopicsText({ series }: { series: PostSeries }) {
  if (seriesTopicMode(series) === "auto") {
    return (
      <p className="text-foreground">
        Planned by AI
        <span className="block text-muted-foreground">A fresh topic for each post, never repeated.</span>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1" aria-label="Its topics, used in turn">
      {series.topics.map((topic) => (
        <StatusBadge key={topic} tone="neutral" size="sm">
          {topic}
        </StatusBadge>
      ))}
    </div>
  );
}

/**
 * How the series' posts go out: each waits for review (the default), or they publish on their own unless a safety
 * check holds one; automatic publishing isn't switched on yet (`auto_publish.switch`), an agency client hasn't
 * approved it yet (`clientUser`: the viewer is that client), and an automatic series' first posts still wait for
 * review (`first_posts_left`).
 */
function PublishingText({ series, clientUser }: { series: PostSeries; clientUser: boolean }) {
  if (seriesPublishMode(series) === "review") {
    return (
      <>
        <p className="text-foreground">Each post waits for review</p>
        <p className="text-muted-foreground">A post nobody reviews in time goes back to drafts.</p>
      </>
    );
  }
  const off = autoPublishSwitchText(series.auto_publish?.switch);
  const firstLeft = series.auto_publish?.first_posts_left ?? 0;
  const consent = series.auto_publish?.consent;
  return (
    <>
      <p className="text-foreground">Publishes on its own</p>
      <p className="text-muted-foreground">
        {off
          ? `${off}, so each post waits for review for now.`
          : consent?.required && !consent.granted
            ? `Each post waits for review until ${clientUser ? "you approve" : "your client approves"} automatic posts.`
            : firstLeft > 0
              ? firstLeft === 1
                ? "The first post still waits for review."
                : `The first ${firstLeft} posts still wait for review.`
              : "Unless a safety check holds a post for a person."}
      </p>
    </>
  );
}

/** A pause the series made itself (Phase 25c `paused`): why, and what to do; resuming clears it. */
function SelfPauseNote({ locationId, paused, canResume }: { locationId: string; paused: NonNullable<PostSeries["paused"]>; canResume: boolean }) {
  const label = seriesPauseLabel(paused.reason);
  const critical = label?.tone === "critical";
  const advice =
    paused.reason === "google_rejected"
      ? "Check the post Google rejected"
      : paused.reason === "needs_review"
        ? "Read what the checks found in its posts"
        : "Make sure someone can review its posts in time";
  return (
    <div
      role="note"
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border px-3 py-2.5 text-sm sm:flex-row sm:items-center",
        critical ? "border-critical/25 bg-critical-surface text-foreground" : "border-warning/35 bg-warning-surface text-warning-foreground",
      )}
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <CirclePause aria-hidden className={cn("mt-0.5 size-4 shrink-0", critical ? "text-critical" : "text-warning")} />
        <span>
          <span className="font-semibold">{label?.text ?? "The series paused itself"}.</span> {advice}
          {canResume ? ", then resume the series." : ". The series stays paused until someone resumes it."}
        </span>
      </p>
      {paused.post_id ? (
        <Button asChild size="sm" variant="outline" className="shrink-0 self-start bg-card max-sm:ml-6 sm:self-center">
          <Link to={postPath(locationId, paused.post_id)}>See the post</Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Automatic AI posts are paused for this account (Phase 25a `planner` isn't `on`): a calm notice, not an error. The
 * series is kept and "Write the next post now" still works.
 */
function PlannerNotice({ planner, canWriteNow }: { planner: PausedPlanner; canWriteNow: boolean }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-surface px-3 py-2.5 text-sm text-foreground">
      <CirclePause aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="min-w-0">
        <p className="font-semibold">{PLANNER_PAUSED_TITLE}</p>
        <p>{plannerPausedText(planner, canWriteNow)}</p>
      </div>
    </div>
  );
}

/**
 * Why the last slot's post wasn't written, and what happens next. Shown only while the planner is on (2026-11-17,
 * G10: as the dashboard counts it): the hourly planner retries active series, for slots still ahead; a slot whose
 * time has passed is skipped and the next one is written about 2 days before its time; resuming a paused series
 * clears the error. `action` fixes the cause where the app can (buy tokens, connect Google).
 */
function SeriesProblem({
  error,
  active,
  now,
  action,
  askOwner,
}: {
  error: NonNullable<PostSeries["last_error"]>;
  active: boolean;
  now: number;
  action: ReactNode;
  /** Not enough tokens and this person can't buy them. */
  askOwner: boolean;
}) {
  const copy = seriesProblemCopy(error, now);
  // The backend's model allows an error without a slot time.
  const slotAt: string | null = error.slot_at ?? null;
  const retrying = active && slotAt !== null && Date.parse(slotAt) > now;
  const next = !active
    ? "Resume the series to try again. Resuming clears this message."
    : retrying
      ? "It's tried again every hour until then."
      : `${slotAt ? "That time has passed. " : ""}The next post is written about 2 days before its time.`;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2.5 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2.5 text-sm text-warning-foreground sm:flex-row sm:items-center"
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">{copy.title}.</span>
          {copy.detail ? ` ${copy.detail}` : ""} {slotAt ? `The post for ${formatPostMoment(slotAt, { weekday: true })} wasn't written.` : "A post wasn't written."} {next}
          {askOwner ? " Need more? Ask the account owner to add tokens." : ""}
        </span>
      </p>
      {action ? <div className="shrink-0 pl-6 sm:pl-0">{action}</div> : null}
    </div>
  );
}

function DeleteSeriesDialog({ name, onClose, onDelete }: { name: string; onClose: () => void; onDelete: (keepScheduled: boolean) => void }) {
  const [cancelScheduled, setCancelScheduled] = useState(true);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>No new posts are written. Published posts stay on Google.</DialogDescription>
        </DialogHeader>
        <label className="flex min-h-9 cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox checked={cancelScheduled} onCheckedChange={(value) => setCancelScheduled(value === true)} className="mt-0.5" />
          <span>
            Also cancel its scheduled posts (they move to Drafts)
            {cancelScheduled ? null : (
              <span className="mt-1 block text-muted-foreground">Kept posts go out at their times, as if you had approved them.</span>
            )}
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onDelete(!cancelScheduled)}>
            Delete series
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
