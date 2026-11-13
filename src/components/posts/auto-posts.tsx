import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CirclePause,
  Coins,
  Hourglass,
  ImageIcon,
  LoaderCircle,
  Pause,
  Pencil,
  Play,
  PlugZap,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  createPostSeries,
  deletePostSeries,
  generateNextSeriesPost,
  previewPostSeries,
  setPostSeriesActive,
  updatePostSeries,
  type CtaType,
  type Post,
  type PostSeries,
  type PostSeriesInput,
  type PostTone,
  type SeriesCadence,
  type Weekday,
} from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/layout/shared/feedback/states";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { BuyTokensDialog } from "@/components/layout/shared/token-balance";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { formatTokens } from "@/lib/ai/ai-costs";
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useAiStatus, type AiStatus } from "@/lib/ai/ai-status";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { formatPostMoment } from "@/lib/posts/post-format";
import { sortSeries } from "@/lib/posts/post-order";
import { useToastPostError } from "@/lib/posts/post-toasts";
import {
  PLANNER_PAUSED_TITLE,
  WRITE_NEXT_POST_LABEL,
  pausedPlannerOf,
  plannerPausedReason,
  plannerPausedText,
  seriesErrorText,
  seriesPlanner,
  seriesProblem,
  seriesProblemCopy,
  type PausedPlanner,
} from "@/lib/posts/series-planner";
import { CTA_LABEL, TONE_LABEL, WEEKDAYS, postErrorText, postsKey, useInvalidatePosts, usePostSeries } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

const TIME_OF_DAY = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "09:00" (a series' local time of day) → "9:00 AM" in the viewer's format. */
function formatTimeOfDay(value: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  return TIME_OF_DAY.format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
}

function cadenceText(cadence: SeriesCadence): string {
  if (cadence.kind === "weekly") {
    const days = WEEKDAYS.filter((day) => cadence.days_of_week.includes(day.id)).map((day) => day.short);
    return `Every ${days.join(", ") || "week"}`;
  }
  if (cadence.kind === "every_n_days") return cadence.n === 1 ? "Every day" : `Every ${cadence.n} days`;
  return `Monthly on day ${cadence.day_of_month}`;
}

/** Why "New auto-post series" can't be used right now, or null when it can. */
function createBlocker({ ai, gbpConnected, full }: { ai: AiStatus; gbpConnected: boolean; full: boolean }): string | null {
  if (ai.blockedBy === "checking") return "Checking whether AI is available…";
  if (!ai.canRun) return ai.state === "off" ? "Auto-posts need AI, which isn't switched on yet." : (ai.reason ?? "AI isn't available right now.");
  if (!gbpConnected) return "Connect this location to Google first.";
  if (full) return "Up to 3 series can run at once. Pause or delete one first.";
  return null;
}

/**
 * Auto-posts (AI series): the server writes each post about 48 h before its slot and publishes it on
 * time unless someone changes it. Creating a series is consent to its token spend.
 *
 * New series need AI that can run (`useAiStatus`): while AI is off, a series would skip every slot,
 * so the button stays visible but disabled, with the reason. `photosPublishable: false` turns AI
 * images off by default and warns, since posts with a photo can't publish yet.
 *
 * Phase 25a: each series says whether the server's planner writes its posts (`planner`). While it
 * doesn't, each card says so calmly ("Automatic AI posts are paused"), its slots read "Planned slots
 * (paused)" rather than "Coming up", and "Write the next post now" still works.
 */
export function AutoPosts({
  locationId,
  timeZone,
  gbpConnected,
  onOpenPost,
  photosPublishable = true,
  startNew = false,
}: {
  locationId: string;
  /** The location's IANA time zone (series times are in it); null when unknown (the server then uses UTC). */
  timeZone: string | null;
  gbpConnected: boolean;
  onOpenPost: (post: Post) => void;
  photosPublishable?: boolean;
  /** Opens the "New auto-post series" dialog straight away when a series can be created (`?new=series`). */
  startNew?: boolean;
}) {
  const canEdit = useCanEdit();
  const ai = useAiStatus(locationId);
  const list = usePostSeries(locationId);
  const [editing, setEditing] = useState<PostSeries | "new" | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  const series = list.data ? sortSeries(list.data.series) : [];
  const limit = list.data?.limit ?? 3;
  const active = series.filter((entry) => entry.active).length;
  const blocker = createBlocker({ ai, gbpConnected, full: active >= limit });
  // `?new=series` opens the dialog once, as soon as the list and AI status say a series can be created.
  const showNew = editing === "new" || (startNew && !autoOpened && canEdit && list.isSuccess && blocker === null);
  const openSeries = editing === "new" ? null : editing;
  const imagesOn = series.some((entry) => entry.active && entry.include_image);
  // The planner is switched per account, so any series tells a new one's fate too.
  const pausedPlanner = pausedPlannerOf(series);

  const header = (
    <SectionHeader
      icon={Repeat}
      tone="ai"
      title="Auto-posts"
      description={`AI writes each post about 2 days before its time and publishes it on schedule unless you change it. Up to ${limit} series at once.`}
      actions={
        canEdit ? (
          <Button variant="ai" disabled={blocker !== null} title={blocker ?? undefined} onClick={() => setEditing("new")}>
            <Plus aria-hidden /> New auto-post series
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div>
      {header}
      <div className="space-y-4">
        {/* Not connected and no series yet: the empty state below already says so. */}
        {canEdit && blocker && list.isSuccess && ai.blockedBy !== "checking" && (!ai.canRun || series.length > 0) ? (
          <Note icon={ai.state === "paused" ? Hourglass : Sparkles} tone={ai.canRun ? "neutral" : "ai"}>
            {!ai.canRun && ai.state === "off"
              ? "Auto-posts need AI, which isn't switched on yet, so new series can't start. A series created now would skip every post. Existing series keep their schedule."
              : !ai.canRun && ai.state === "paused"
                ? `AI is paused for today${ai.resumesAt ? ` (back at ${ai.resumesAt})` : ""}. Auto-posts retry every hour until each post's time passes.`
                : blocker}
          </Note>
        ) : null}
        {!photosPublishable && imagesOn ? (
          <Note icon={ImageIcon} tone="warning">
            Posts with a photo can't be published to Google yet. Turn off "Add an AI image" in your series until then, so their posts go out as text.
          </Note>
        ) : null}

        {list.isPending ? (
          <ListSkeleton rows={2} />
        ) : list.isError ? (
          <ErrorState description={postErrorText(list.error, "Auto-posts couldn't be loaded.").message} onRetry={() => void list.refetch()} />
        ) : series.length === 0 ? (
          <EmptyState
            icon={Repeat}
            tone="ai"
            title="Keep your profile active on autopilot"
            description={
              gbpConnected
                ? "Pick days, a time and a few topics. AI writes each post in your voice and publishes it on time, so your Google profile never goes quiet."
                : "Connect this location to Google to let AI post for you on a schedule."
            }
            action={
              canEdit && gbpConnected ? (
                <Button variant="ai" disabled={blocker !== null} title={blocker ?? undefined} onClick={() => setEditing("new")}>
                  <Plus aria-hidden /> Set up auto-posts
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-4">
            {series.map((entry) => (
              <li key={entry.series_id}>
                <SeriesCard
                  locationId={locationId}
                  series={entry}
                  ai={ai}
                  gbpConnected={gbpConnected}
                  onEdit={() => setEditing(entry)}
                  onOpenPost={onOpenPost}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {showNew || openSeries ? (
        <SeriesDialog
          locationId={locationId}
          timeZone={timeZone}
          series={openSeries}
          ai={ai}
          photosPublishable={photosPublishable}
          pausedPlanner={openSeries ? pausedPlannerOf([openSeries]) : pausedPlanner}
          onClose={() => {
            setEditing(null);
            setAutoOpened(true);
          }}
        />
      ) : null}
    </div>
  );
}

function Note({ icon: Icon, tone, children }: { icon: typeof Sparkles; tone: "ai" | "warning" | "neutral"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        tone === "ai" && "border-ai/20 bg-ai-surface text-foreground",
        tone === "warning" && "border-warning/35 bg-warning-surface text-warning-foreground",
        tone === "neutral" && "border-border bg-surface-strong text-foreground",
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "ai" ? "text-ai" : tone === "warning" ? "text-warning" : "text-muted-foreground")} />
      <span>{children}</span>
    </p>
  );
}

function SeriesCard({
  locationId,
  series,
  ai,
  gbpConnected,
  onEdit,
  onOpenPost,
}: {
  locationId: string;
  series: PostSeries;
  ai: AiStatus;
  gbpConnected: boolean;
  onEdit: () => void;
  onOpenPost: (post: Post) => void;
}) {
  const canEdit = useCanEdit();
  const canBuy = useAccess().can("billing.manage");
  const { connect } = useGbpConnect();
  const now = useNow();
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useQuery({
    queryKey: [...postsKey(locationId), "series", series.series_id, "preview"],
    queryFn: ({ signal }) => previewPostSeries(locationId, series.series_id, 5, signal),
    enabled: showPreview,
  });
  const perPost = ai.costs.post_draft + (series.include_image ? ai.costs.post_image : 0);
  const planner = seriesPlanner(series);
  const plannerOn = planner === "on";
  // While the planner is paused, an old "AI couldn't run" error says nothing the notice doesn't.
  const problem = seriesProblem(series);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      const result = await action();
      if (key === "generate") noteAiSuccess();
      toast.success(success);
      if (key === "generate" && result && typeof result === "object" && "post" in result) onOpenPost((result as { post: Post }).post);
    } catch (err) {
      toastError(err, "That didn't work. Try again.");
    } finally {
      setBusy(null);
      invalidate();
    }
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Repeat} tone="ai" className="mt-0.5" />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              {series.name}
              <StatusBadge tone={series.active ? "success" : "neutral"} dot size="sm">
                {series.active ? "Active" : "Paused"}
              </StatusBadge>
              {problem ? (
                <StatusBadge tone="warning" icon={AlertTriangle} size="sm">
                  Needs attention
                </StatusBadge>
              ) : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              {cadenceText(series.cadence)} at {formatTimeOfDay(series.time_of_day)} · {series.time_zone}
              {series.time_zone_source === "default" ? " (no time zone set)" : ""}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Per post <AiCostChip tokens={perPost} balance={ai.balance} />
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {planner !== "on" ? <PlannerNotice planner={planner} canWriteNow={canEdit && series.active} /> : null}
        {problem ? (
          <SeriesProblem
            error={problem}
            active={series.active}
            plannerOn={plannerOn}
            now={now}
            action={
              problem.code === "insufficient_tokens" && canBuy ? (
                <Button size="sm" variant="outline" onClick={() => setBuying(true)}>
                  <Coins aria-hidden /> Buy tokens
                </Button>
              ) : problem.code === "gbp_not_connected" && canEdit && !gbpConnected ? (
                <Button size="sm" variant="outline" onClick={() => connect()}>
                  <PlugZap aria-hidden /> Connect Google
                </Button>
              ) : undefined
            }
            askOwner={problem.code === "insufficient_tokens" && !canBuy}
          />
        ) : null}

        <dl className="grid gap-4 text-sm sm:grid-cols-3">
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
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Topics, in turn</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1">
              {series.topics.map((topic) => (
                <StatusBadge key={topic} tone="neutral" size="sm">
                  {topic}
                </StatusBadge>
              ))}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Style</dt>
            <dd className="mt-1.5 space-y-0.5 text-foreground">
              <p>{TONE_LABEL[series.tone]} tone</p>
              <p>{series.include_image ? "Text and an AI image" : "Text only"}</p>
              <p className="text-muted-foreground">Button: {series.cta ? CTA_LABEL[series.cta.type] : "the AI chooses"}</p>
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-medium text-foreground">
            {series.posts_generated} post{series.posts_generated === 1 ? "" : "s"} written so far
          </span>
          {series.history.length > 0 ? (
            <details className="group text-sm">
              <summary className="cursor-pointer rounded-sm font-medium text-primary outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                Recent results
              </summary>
              <ul className="mt-2 space-y-1">
                {series.history.slice(0, 8).map((entry) => (
                  <li key={`${entry.slot_at}-${entry.at}`} className="flex items-start gap-1.5">
                    {entry.outcome === "generated" ? (
                      <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-success" />
                    ) : (
                      <XCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-critical" />
                    )}
                    <span className={entry.outcome === "failed" ? "text-critical" : "text-muted-foreground"}>
                      {formatPostMoment(entry.slot_at)}:{" "}
                      {entry.outcome === "generated"
                        ? entry.reason === "image_failed"
                          ? "written (text only: the image failed)"
                          : "written"
                        : `skipped (${seriesErrorText(entry.reason ?? "")})`}
                    </span>
                  </li>
                ))}
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
            <ul className="space-y-1 rounded-lg bg-surface-strong px-3 py-2.5 text-sm">
              {preview.data.slots.map((slot) => (
                <li key={slot.slot_at} className="text-foreground">
                  <span className="font-medium">{formatPostMoment(slot.slot_at, { weekday: true })}</span>: “{slot.topic}”
                  {/* Nothing is written on its own while the planner is paused. */}
                  {plannerOn ? <span className="text-muted-foreground"> (written {formatPostMoment(slot.generates_at)})</span> : null}
                </li>
              ))}
            </ul>
          ) : null
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-strong/60 px-4 py-3 sm:px-5">
          {series.active ? (
            <Button
              size="sm"
              variant="outline"
              className="text-ai hover:border-ai/40 hover:bg-ai-surface hover:text-ai"
              disabled={busy !== null || !ai.canRun}
              title={ai.reason}
              onClick={() => void run("generate", () => generateNextSeriesPost(locationId, series.series_id), "The next post is written.")}
            >
              {busy === "generate" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} {WRITE_NEXT_POST_LABEL}
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
            onClick={() => void run("toggle", () => setPostSeriesActive(locationId, series.series_id, !series.active), series.active ? "Paused." : "Resumed.")}
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
            void run("delete", () => deletePostSeries(locationId, series.series_id, keepScheduled), "Series deleted.");
          }}
        />
      ) : null}
      {buying ? <BuyTokensDialog onClose={() => setBuying(false)} /> : null}
    </article>
  );
}

/**
 * Automatic AI posts are paused for this account (Phase 25a `planner` isn't `on`): a calm notice, not
 * an error. The series is kept and "Write the next post now" still works.
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
 * Why the last slot's post wasn't written, and what happens next, from the backend's rules: the
 * hourly planner retries only ACTIVE series, only for slots still ahead, and only while it runs for
 * the account (`planner: on`); a slot whose time has passed is skipped and the next one is written
 * about 2 days before its time; resuming a paused series clears the error. `action` fixes the cause
 * where the app can (buy tokens, connect Google).
 */
function SeriesProblem({
  error,
  active,
  plannerOn,
  now,
  action,
  askOwner,
}: {
  error: NonNullable<PostSeries["last_error"]>;
  active: boolean;
  /** The server's planner writes this series' posts (Phase 25a `planner`). */
  plannerOn: boolean;
  now: number;
  action: ReactNode;
  /** Not enough tokens and this person can't buy them. */
  askOwner: boolean;
}) {
  const copy = seriesProblemCopy(error, now);
  // The backend's model allows an error without a slot time.
  const slotAt: string | null = error.slot_at ?? null;
  const retrying = active && plannerOn && slotAt !== null && Date.parse(slotAt) > now;
  const next = !active
    ? plannerOn
      ? "Resume the series to try again. Resuming clears this message."
      : "Resuming the series clears this message."
    : !plannerOn
      ? "It isn't tried again while automatic AI posts are paused."
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
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={cancelScheduled} onCheckedChange={(value) => setCancelScheduled(value === true)} className="mt-0.5" />
          Also cancel its scheduled posts (they move to Drafts)
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

const today = () => new Date().toISOString().slice(0, 10);

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function SeriesDialog({
  locationId,
  timeZone,
  series,
  ai,
  photosPublishable,
  pausedPlanner,
  onClose,
}: {
  locationId: string;
  timeZone: string | null;
  series: PostSeries | null;
  ai: AiStatus;
  photosPublishable: boolean;
  /** Automatic AI posts are paused for the account (from the series' `planner`), or null. */
  pausedPlanner: PausedPlanner | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [name, setName] = useState(series?.name ?? "");
  const [kind, setKind] = useState<SeriesCadence["kind"]>(series?.cadence.kind ?? "weekly");
  const [days, setDays] = useState<Weekday[]>(series?.cadence.kind === "weekly" ? series.cadence.days_of_week : ["MONDAY", "THURSDAY"]);
  const [everyN, setEveryN] = useState(series?.cadence.kind === "every_n_days" ? String(series.cadence.n) : "3");
  const [dayOfMonth, setDayOfMonth] = useState(series?.cadence.kind === "monthly" ? String(series.cadence.day_of_month) : "1");
  const [time, setTime] = useState(series?.time_of_day ?? "09:00");
  // Mohit (2026-10-12): series times are in the user's own zone unless they pick another.
  const [userZone] = useState(browserTimeZone);
  const [zone, setZone] = useState(series ? series.time_zone : userZone);
  const zoneOptions = Array.from(new Set([userZone, ...(timeZone ? [timeZone] : []), ...(series ? [series.time_zone] : [])]));
  const [customZone, setCustomZone] = useState(false);
  const [startsOn, setStartsOn] = useState(series?.starts_on ?? today());
  const [endsOn, setEndsOn] = useState(series?.ends_on ?? "");
  const [topics, setTopics] = useState((series?.topics ?? []).join("\n"));
  const [tone, setTone] = useState<PostTone>(series?.tone ?? "friendly");
  const [cta, setCta] = useState<CtaType | "none">(series?.cta?.type ?? "CALL");
  const [ctaUrl, setCtaUrl] = useState(series?.cta?.url ?? "");
  // Photos can't publish yet on some servers: start new series as text only there.
  const [includeImage, setIncludeImage] = useState(series?.include_image ?? photosPublishable);
  const [instructions, setInstructions] = useState(series?.instructions ?? "");
  const [saving, setSaving] = useState(false);
  const perPost = ai.costs.post_draft + (includeImage ? ai.costs.post_image : 0);
  const topicList = topics
    .split("\n")
    .map((topic) => topic.trim())
    .filter(Boolean);
  // A new series must be able to post: never let one start while AI can't run.
  const createBlocked = !series && !ai.canRun;

  const cadence: SeriesCadence =
    kind === "weekly" ? { kind, days_of_week: days } : kind === "every_n_days" ? { kind, n: Number(everyN) } : { kind, day_of_month: Number(dayOfMonth) };

  const save = async () => {
    setSaving(true);
    const input: PostSeriesInput = {
      name: name.trim(),
      cadence,
      time_of_day: time,
      starts_on: startsOn,
      ends_on: endsOn || null,
      topics: topicList,
      tone,
      cta: cta === "none" ? null : { type: cta, url: cta === "CALL" ? null : ctaUrl.trim() || null },
      include_image: includeImage,
      instructions: instructions.trim() || null,
      // Sent on create, and on edit only when it changed.
      ...(!series || zone !== series.time_zone ? { time_zone: zone.trim() } : {}),
    };
    try {
      const saved = series ? await updatePostSeries(locationId, series.series_id, input) : await createPostSeries(locationId, input);
      invalidate();
      toast.success(
        series
          ? "Series updated. Changes apply to posts not written yet."
          : seriesPlanner(saved) === "on"
            ? "Auto-posts are on. The first post is written about 2 days before its time."
            : "Series saved. Automatic AI posts are paused for now, so nothing is written on its own yet.",
      );
      onClose();
    } catch (err) {
      toastError(err, "The series couldn't be saved.");
    } finally {
      setSaving(false);
    }
  };

  const valid = name.trim() && topicList.length > 0 && time && zone.trim() && startsOn && (kind !== "weekly" || days.length > 0);

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{series ? "Edit auto-posts" : "New auto-post series"}</DialogTitle>
          <DialogDescription>AI writes each post about 2 days ahead and publishes it on time unless you change it.</DialogDescription>
        </DialogHeader>
        {createBlocked ? (
          <p className="flex items-start gap-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2 text-sm text-foreground">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-ai" />
            {ai.state === "off" ? "Auto-posts need AI, which isn't switched on yet. You can start a series as soon as it is." : (ai.reason ?? "AI isn't available right now.")}
          </p>
        ) : null}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="series-name">Name</Label>
            <Input id="series-name" placeholder="Weekly tips" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>How often</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={kind} onValueChange={(value) => setKind(value as SeriesCadence["kind"])}>
                <SelectTrigger className="w-44" aria-label="How often">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">On weekdays</SelectItem>
                  <SelectItem value="every_n_days">Every few days</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              {kind === "every_n_days" ? (
                <span className="flex items-center gap-2 text-sm">
                  every <Input type="number" min={1} max={30} className="w-20" aria-label="Number of days" value={everyN} onChange={(event) => setEveryN(event.target.value)} /> days
                </span>
              ) : kind === "monthly" ? (
                <span className="flex items-center gap-2 text-sm">
                  on day{" "}
                  <Input type="number" min={1} max={28} className="w-20" aria-label="Day of the month" value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
                </span>
              ) : null}
              <span className="flex items-center gap-2 text-sm">
                at <Input type="time" className="w-32" aria-label="Time of day" value={time} onChange={(event) => setTime(event.target.value)} />
              </span>
            </div>
            {kind === "weekly" ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {WEEKDAYS.map((day) => {
                  const on = days.includes(day.id);
                  return (
                    <Button
                      key={day.id}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      aria-pressed={on}
                      className="min-w-12"
                      onClick={() => setDays(on ? days.filter((d) => d !== day.id) : [...days, day.id])}
                    >
                      {day.short}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="text-muted-foreground">Time zone</span>
              {customZone ? (
                <Input className="w-56" aria-label="Time zone" placeholder="e.g. America/Toronto" value={zone} onChange={(event) => setZone(event.target.value)} />
              ) : (
                <Select value={zone} onValueChange={(value) => (value === "__other__" ? setCustomZone(true) : setZone(value))}>
                  <SelectTrigger className="w-64" aria-label="Time zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {zoneOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                        {option === userZone ? " (yours)" : option === timeZone ? " (the location's)" : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">Another time zone…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="series-starts">Starts</Label>
              <Input id="series-starts" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-ends">Ends (optional)</Label>
              <Input id="series-ends" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="series-topics">Topics, one per line (used in turn)</Label>
            <Textarea id="series-topics" rows={4} value={topics} onChange={(event) => setTopics(event.target.value)} placeholder={"Seasonal tips\nMeet the team\nWhy customers choose us"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(value) => setTone(value as PostTone)}>
                <SelectTrigger aria-label="Tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TONE_LABEL) as PostTone[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {TONE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Button</Label>
              <Select value={cta} onValueChange={(value) => setCta(value as CtaType | "none")}>
                <SelectTrigger aria-label="Button">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Let the AI choose</SelectItem>
                  {(Object.keys(CTA_LABEL) as CtaType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {CTA_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {cta !== "none" && cta !== "CALL" ? (
            <div className="space-y-1.5">
              <Label htmlFor="series-cta-url">Button link (https)</Label>
              <Input id="series-cta-url" type="url" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} />
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeImage} onCheckedChange={(value) => setIncludeImage(value === true)} /> Add an AI image to each post
          </label>
          {includeImage && !photosPublishable ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-xs text-warning-foreground">
              <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
              Posts with a photo can't be published to Google yet, so these posts would fail. Leave images off for now.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="series-rules">House rules (optional)</Label>
            <Textarea
              id="series-rules"
              rows={2}
              maxLength={500}
              placeholder="e.g. Never mention prices."
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-ai/20 bg-ai-surface px-3 py-2.5 text-sm text-foreground">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-ai" />
            <span>
              Each post spends <AiCostChip tokens={perPost} balance={ai.balance} className="mx-0.5 align-middle" /> automatically ({formatTokens(ai.costs.post_draft)} for the text
              {includeImage ? ` + ${formatTokens(ai.costs.post_image)} for the image` : ""}) and publishes on its own unless you change it.
              {series ? "" : " Turning this on is your consent to that spend."}
            </span>
          </p>
          {pausedPlanner ? (
            <p className="flex items-start gap-2 rounded-lg border border-info/25 bg-info-surface px-3 py-2.5 text-sm text-foreground">
              <CirclePause aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              <span>
                {plannerPausedReason(pausedPlanner)} Until they start, the series is saved but writes and spends nothing on its own.
              </span>
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="ai" disabled={saving || !valid || createBlocked} title={createBlocked ? ai.reason : undefined} onClick={() => void save()}>
            {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} {series ? "Save changes" : "Turn on auto-posts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
