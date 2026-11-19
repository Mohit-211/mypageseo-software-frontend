import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  ExternalLink,
  ImagePlus,
  LifeBuoy,
  LoaderCircle,
  MoreHorizontal,
  MousePointerClick,
  OctagonX,
  PenLine,
  Pencil,
  PlugZap,
  Repeat,
  RotateCw,
  Send,
  Sparkles,
  Ticket,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  aiDraftPost,
  aiPostImage,
  aiRevisePost,
  approvePost,
  deletePost,
  rejectPost,
  runPostAction,
  updatePost,
  type AiReviseInput,
  type ApiError,
  type Post,
  type PostAction,
  type PostAiFinding,
  type PostAiRun,
  type PostAiRunStart,
  type PostMediaDetails,
  type PostsSummary,
} from "@/api";
import { AiCostChip } from "@/components/ai/ai-cost-chip";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useCanEdit } from "@/hooks/use-access";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { markerIsActive, markerRunId, runIsActive, useActivePostRuns, useAiRun } from "@/lib/posts/ai-runs";
import { approvalReasonLabel, heldLabels, postProblemWords, type PostProblemAction } from "@/lib/posts/approval-labels";
import { STICKY_TOAST, forgetPostToasts, toastPost } from "@/lib/posts/open-post";
import { usePostAiState } from "@/lib/posts/post-ai-state";
import {
  findingsInText,
  mediaLabel,
  messageQuotesText,
  postStandingContext,
  shownSeverity,
  standingHardFindings,
  type StandingContext,
} from "@/lib/posts/post-findings";
import { POST_TYPE_LABEL, formatEventRange, formatPostMoment, formatRecurrence, formatReviewBy, postTimeline } from "@/lib/posts/post-format";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { UNSCHEDULED_TEXT, UNSCHEDULED_TITLE, retryStartOf, runNotes, useOnRunEnd, usePostRunStart, type RunStartOutcome } from "@/lib/posts/use-post-runs";
import { CTA_LABEL, STATUS_ICON, STATUS_LABEL, STATUS_TONE, useInvalidatePosts } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { InstructionsField } from "./ai-writer";
import { LabelLine } from "./label-line";
import { ChangePictureOption } from "./post-editor-ai";
import { PostFindingsList, PostFindingsText } from "./post-findings";
import { DeclinedNotice, DismissButton, PictureOutcome, RunFailure, RunNotes, RunProgress, SeriesSlotProgress } from "./run-status";

/** Brings a card opened from a link (`?post=`) into view once, when it mounts. */
function revealOnMount(element: HTMLElement | null) {
  if (!element) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
}

/** Posts not on Google yet: the AI may write, change or picture them. */
const NOT_ON_GOOGLE: ReadonlySet<Post["status"]> = new Set(["draft", "scheduled", "pending_approval", "failed"]);

/**
 * One post: content, status, dates, Google link, problems and the actions its status allows.
 *
 * - While an AI run works on it (`ai_run`): "Creating…" with the run's progress (a teammate's by name), or "Its
 *   series is writing this post". The page polls the location's active runs; the card reads its run from them.
 * - On a post not on Google yet: "Write it with AI" (an empty draft), "Change it with AI…" and "Create a picture",
 *   as background runs whose outcome shows on the card.
 * - The AI text's findings are highlighted; a hard one that still stands (the backend's rule: `standingHardFindings`)
 *   blocks Approve, Publish and Retry until the words change; the others are listed under "notes to look at".
 * - Approve / Send back from the post's own `can_approve`, with why it waits, why an automatic post was held and
 *   its review time ("Review by …").
 * - A failed or rejected post's problem in the shared words, with what to do about it.
 */
export function PostCard({
  locationId,
  post,
  summary,
  onEdit,
  highlighted = false,
}: {
  locationId: string;
  post: Post;
  summary: PostsSummary;
  onEdit: (post: Post) => void;
  /** Opened from a link: outlined and scrolled into view. */
  highlighted?: boolean;
}) {
  const canEdit = useCanEdit() && post.can_edit;
  const ai = usePostAiState(locationId, summary);
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const starter = usePostRunStart();
  const { connect } = useGbpConnect();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [changing, setChanging] = useState(false);
  const [ownRunId, setOwnRunId] = useState<string | null>(null);
  const [ended, setEnded] = useState<PostAiRun | null>(null);
  // The ended "Change it" that sent the post back to drafts, once the card shows it as a draft.
  const [draftSeenFor, setDraftSeenFor] = useState<string | null>(null);
  const [usingPicture, setUsingPicture] = useState(false);
  const media = post.media[0];
  const image = media?.url ?? post.google.media_url;
  const imageLabel = mediaLabel(media);
  const missing = post.google.missing;
  const notOnGoogle = NOT_ON_GOOGLE.has(post.status);
  const text = post.summary ?? "";
  const hasText = text.trim().length > 0;
  const StatusIcon = STATUS_ICON[post.status];
  const eventRange = post.event ? formatEventRange(post.event) : null;

  // "Review it, then schedule it again" goes once the post leaves drafts again (scheduled, sent for approval,
  // published): the list keeps this card by post id, so the note would stay on the scheduled post.
  if (ended?.status === "done" && ended.kind === "revise" && ended.result?.unscheduled) {
    if (post.status === "draft") {
      if (draftSeenFor !== ended.run_id) setDraftSeenFor(ended.run_id);
    } else if (draftSeenFor === ended.run_id) setEnded(null);
  }

  // What works on the post now: its `ai_run`, or a run started here. The page polls the location's active runs;
  // the card reads its run from that list and polls it itself only when it isn't there.
  const marker = post.ai_run ?? null;
  const seriesSlot = marker?.kind === "series_slot";
  const pageRuns = useActivePostRuns(locationId, { enabled: false });
  const followId = ownRunId ?? markerRunId(marker);
  const inList = followId ? pageRuns.runs.some((entry) => entry.run_id === followId) : false;
  const followed = useAiRun(locationId, followId, { poll: !inList });
  const activeRun = followed.run && runIsActive(followed.run) ? followed.run : null;
  // The marker says a run holds the post until the run itself has been read.
  const working = Boolean(activeRun) || seriesSlot || (markerIsActive(marker) && !followed.run && !followed.gone);

  useOnRunEnd(locationId, [ownRunId], (finished) => {
    setOwnRunId(null);
    setEnded(finished);
    if (finished.status !== "done") return;
    if (finished.kind === "revise" && finished.result?.unscheduled) {
      // The post goes back to drafts, so on a filtered list its card (and the notes on it) may go: the toast stays.
      // "Open it" is the one guarded open (open-post.ts): read again, never over a post being edited, from any page.
      const changedId = finished.result.post?.post_id ?? finished.post_id;
      toastPost(
        "warning",
        UNSCHEDULED_TITLE,
        { id: `post-run-end:${finished.run_id}`, ...STICKY_TOAST, description: UNSCHEDULED_TEXT },
        changedId && canEdit ? { locationId, postId: changedId, run: finished } : null,
      );
      return;
    }
    toast.success(finished.kind === "image" ? "Your picture is ready" : finished.kind === "revise" ? "Your post is changed" : "Your post is written");
  });

  // Post writer v2: the checks' findings still in the text. A hard one that still stands (the backend's rule) must
  // change before the post goes out; the rest (warnings, and hard ones a person may go ahead with) are notes.
  const standing = postStandingContext(post);
  const findings = findingsInText(post.ai?.findings, text);
  const hardLeft = standingHardFindings(post.ai, standing);
  // Every other finding still in the text (warnings, writing notes, hard ones a person may go ahead with), so each
  // highlight's words are in a list too, not only in its tooltip.
  const notesLeft = (post.ai?.findings ?? []).filter((finding) => shownSeverity(finding, standing) !== "hard" && (!finding.text || text.includes(finding.text)));
  const blockedByChecks = hardLeft.length > 0;

  // Approvals (Phase 25c): why it waits, why an automatic post was held, and the review time.
  const waiting = post.status === "pending_approval";
  const reason = waiting ? approvalReasonLabel(post.approval?.reason) : null;
  const held = waiting ? heldLabels(post.approval?.held).filter((label, index, all) => all.findIndex((entry) => entry.text === label.text) === index) : [];
  const reviewBy = waiting ? formatReviewBy(post.approval?.expires_at) : null;
  // Each post says whether the viewer may approve it; older answers only have the summary's flag.
  const canApprove = waiting && (post.can_approve ?? summary.you.can_approve);
  const problem = postProblemWords(post);
  const problemCritical = post.status === "failed" || post.status === "rejected";

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      const result = (await action()) as Post | undefined;
      // Dealt with here: a toast about this post ("Open it", "back in drafts") would be stale.
      if (key === "delete" || key === "publish" || key === "retry" || key === "approve") forgetPostToasts(post.post_id);
      const updated = result && typeof result === "object" && "status" in result ? result : undefined;
      if (updated && (updated.status === "failed" || updated.status === "rejected")) {
        toast.error(postProblemWords(updated)?.text ?? "Google didn't accept the post.", { description: "The post is kept; fix it and try again." });
      } else {
        toast.success(success);
      }
    } catch (err) {
      toastError(err, "That didn't work. Try again.", { onReload: invalidate });
    } finally {
      setBusy(null);
      invalidate();
    }
  };
  const action = (name: PostAction, success: string) => () => void run(name, () => runPostAction(locationId, post.post_id, name), success);

  // AI on a post not on Google yet: background runs, followed on the card until they end.
  const aiActions = canEdit && notOnGoogle && !missing;
  const aiDisabled = !ai.canRun || working || busy !== null;
  const startRun = async (key: string, start: () => Promise<PostAiRunStart>, fallback: string): Promise<RunStartOutcome> => {
    setBusy(key);
    setEnded(null);
    const outcome = await starter.mutateAsync({ start, fallback, onReload: invalidate });
    setBusy(null);
    if (outcome.kind === "started" || outcome.kind === "busy") setOwnRunId(outcome.run.run_id);
    if (outcome.kind === "started" && outcome.existing) toast.info("This is already running", { description: "It shows on the post until it's done." });
    return outcome;
  };
  const writeIt = () => void startRun("write", () => aiDraftPost(locationId, { post_id: post.post_id }), "The post couldn't be started");
  const createPicture = () => void startRun("picture", () => aiPostImage(locationId, { post_id: post.post_id }), "The picture couldn't be started");
  const changeIt = (input: AiReviseInput) => startRun("change", () => aiRevisePost(locationId, post.post_id, input), "The change couldn't be started");
  const restart = ended?.status === "failed" ? retryStartOf(locationId, ended) : null;

  /** "Use this picture": a picture that came back unattached (the post changed meanwhile). */
  const usePicture = async (picture: PostMediaDetails) => {
    setUsingPicture(true);
    try {
      await updatePost(locationId, post.post_id, { media_ids: [picture.media_id] });
      toast.success("The picture is on the post.");
      setEnded(null);
    } catch (err) {
      toastError(err, "The picture couldn't be added.", { onReload: invalidate });
    } finally {
      setUsingPicture(false);
      invalidate();
    }
  };

  return (
    <article
      ref={highlighted ? revealOnMount : undefined}
      aria-busy={busy !== null || undefined}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] sm:flex-row sm:p-5",
        highlighted && "border-primary/50 ring-2 ring-primary/25",
      )}
    >
      {image ? (
        <figure className="shrink-0 sm:w-44">
          <img src={image} alt="" loading="lazy" className="aspect-[16/9] w-full rounded-lg border border-border object-cover sm:aspect-[4/3]" />
          {imageLabel ? (
            <figcaption className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
              <Sparkles aria-hidden className="mt-px size-3 shrink-0 text-ai" /> {imageLabel}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <StatusBadge tone={STATUS_TONE[post.status]} icon={StatusIcon} className={post.status === "publishing" ? "[&_svg]:animate-spin" : undefined}>
            {STATUS_LABEL[post.status]}
          </StatusBadge>
          <StatusBadge tone="neutral">{POST_TYPE_LABEL[post.type]}</StatusBadge>
          {post.source === "ai" ? (
            <StatusBadge tone="ai" icon={Sparkles}>
              {post.series_id ? "AI · Auto-post" : "Written with AI"}
            </StatusBadge>
          ) : null}
          {post.source === "google" ? <StatusBadge tone="info">Made on Google</StatusBadge> : null}
          {missing ? <StatusBadge tone="critical">Deleted on Google</StatusBadge> : null}
          <span className="text-xs font-medium text-muted-foreground">{postTimeline(post)}</span>
        </div>

        {activeRun ? (
          <RunProgress run={activeRun} variant="line" />
        ) : seriesSlot ? (
          <SeriesSlotProgress />
        ) : working ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-ai">
            <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" /> Creating…
          </p>
        ) : null}

        {post.event?.title || eventRange ? (
          <div className="space-y-1">
            {post.event?.title ? <h3 className="text-base font-semibold leading-snug text-foreground">{post.event.title}</h3> : null}
            {eventRange ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4 shrink-0 text-chart-2" />
                  <span className="font-medium text-foreground">{eventRange}</span>
                </span>
                {post.recurrence ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Repeat aria-hidden className="size-3.5 shrink-0" />
                    {formatRecurrence(post.recurrence, post.event?.start)}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasText ? (
          findings.some((finding) => finding.text) ? (
            <PostFindingsText text={text} findings={findings} context={standing} clamp />
          ) : (
            <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{text}</p>
          )
        ) : working ? null : (
          <p className="text-sm italic text-muted-foreground">No text yet</p>
        )}

        {blockedByChecks ? (
          <div role="note" className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2 text-sm">
            <OctagonX aria-hidden className="mt-0.5 size-4 shrink-0 text-critical" />
            <div className="min-w-0">
              <p className="font-medium text-critical">
                {hardLeft.length === 1 ? "1 thing must change" : `${hardLeft.length} things must change`} before this post can go out
              </p>
              <ul className="mt-0.5 space-y-0.5 text-foreground">
                {hardLeft.slice(0, 2).map((finding, index) => (
                  <li key={`${finding.rule}-${index}`} className="break-words [overflow-wrap:anywhere]">
                    {/* The backend's grounding messages quote the words themselves: say them once. */}
                    {finding.text && !messageQuotesText(finding) ? <span className="font-medium">“{finding.text}”: </span> : null}
                    {finding.message}
                  </li>
                ))}
                {hardLeft.length > 2 ? <li className="text-muted-foreground">and {hardLeft.length - 2} more</li> : null}
              </ul>
            </div>
          </div>
        ) : null}
        {notesLeft.length ? <CheckNotes findings={notesLeft} text={text} context={standing} /> : null}

        {post.cta || post.offer?.coupon_code ? (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {post.cta ? (
              <span className="inline-flex items-center gap-1.5">
                <MousePointerClick aria-hidden className="size-3.5" /> Button: <span className="font-medium text-foreground">{CTA_LABEL[post.cta.type]}</span>
              </span>
            ) : null}
            {post.offer?.coupon_code ? (
              <span className="inline-flex items-center gap-1.5">
                <Ticket aria-hidden className="size-3.5" /> Coupon: <span className="font-mono font-medium text-foreground">{post.offer.coupon_code}</span>
              </span>
            ) : null}
          </p>
        ) : null}

        {problem ? (
          <div
            role={problemCritical ? "alert" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center",
              problemCritical ? "border-critical/25 bg-critical-surface text-critical" : "border-warning/35 bg-warning-surface text-warning-foreground",
            )}
          >
            <p className="flex min-w-0 flex-1 items-start gap-2">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{problem.text}</span>
            </p>
            {canEdit ? <ProblemAction action={problem.action} onReconnect={() => connect()} /> : null}
          </div>
        ) : null}
        {missing ? <p className="text-xs text-muted-foreground">This post was deleted on Google. It can only be deleted here.</p> : null}
        {post.issues.length > 0 && post.status === "draft" && hasText ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Not ready to publish yet: {post.issues.map((issue) => issue.message).join(" ")}</span>
          </p>
        ) : null}
        {waiting && (reason || held.length || reviewBy) ? (
          <div className="space-y-1 rounded-lg bg-surface-strong px-3 py-2">
            {reason ? <LabelLine label={reason} /> : null}
            {held.map((label) => (
              <LabelLine key={label.text} label={label} />
            ))}
            {reviewBy ? (
              <p className="flex items-start gap-2 text-sm text-foreground">
                <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  <span className="font-medium">{reviewBy}.</span> If nobody reviews it by then, it goes back to drafts.
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
        {post.approval?.decision ? (
          <p className="text-xs text-muted-foreground">
            {post.approval.decision === "approved" ? "Approved" : "Sent back"}
            {post.approval.on_behalf ? " on the client's behalf" : ""}
            {post.approval.decided_at ? ` ${formatPostMoment(post.approval.decided_at)}` : ""}
            {post.approval.note ? <>: <span className="text-foreground">“{post.approval.note}”</span></> : null}
          </p>
        ) : null}

        {ended ? (
          <EndedRun
            locationId={locationId}
            run={ended}
            onRetry={restart && canEdit ? () => void startRun("retry-ai", restart, "That couldn't be started") : undefined}
            onReload={invalidate}
            onDismiss={() => setEnded(null)}
            onUsePicture={canEdit ? (picture) => void usePicture(picture) : undefined}
            usingPicture={usingPicture}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canApprove ? (
            <>
              <Button
                size="sm"
                disabled={busy !== null || blockedByChecks}
                title={blockedByChecks ? "Change the words that must change first" : undefined}
                onClick={() => void run("approve", () => approvePost(locationId, post.post_id), "Approved.")}
              >
                {busy === "approve" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejecting(true)}>
                <X aria-hidden /> Send back
              </Button>
            </>
          ) : null}
          {canEdit && post.status === "failed" && !missing ? (
            <Button
              size="sm"
              disabled={busy !== null || blockedByChecks || working}
              title={blockedByChecks ? "Change the words that must change first" : undefined}
              onClick={action("retry", "Published on Google.")}
            >
              {busy === "retry" ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCw aria-hidden />} Retry
            </Button>
          ) : null}
          {canEdit && !missing && post.status !== "publishing" ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => onEdit(post)}>
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          {post.google.search_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={post.google.search_url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden /> View on Google<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          ) : null}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-9" aria-label="More actions" disabled={busy !== null}>
                  {busy && !["approve", "retry"].includes(busy) ? <LoaderCircle aria-hidden className="animate-spin" /> : <MoreHorizontal aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {!missing && (post.status === "draft" || post.status === "scheduled") ? (
                  <DropdownMenuItem
                    disabled={blockedByChecks || working}
                    onSelect={action("publish", summary.you.needs_approval ? "Sent for approval." : "Published on Google.")}
                  >
                    <Send aria-hidden /> {summary.you.needs_approval ? "Send for approval now" : "Publish now"}
                  </DropdownMenuItem>
                ) : null}
                {post.status === "draft" && !missing ? (
                  <DropdownMenuItem onSelect={() => onEdit(post)}>
                    <CalendarClock aria-hidden /> Schedule…
                  </DropdownMenuItem>
                ) : null}
                {!missing && (post.status === "scheduled" || post.status === "pending_approval") ? (
                  <DropdownMenuItem onSelect={action("unschedule", "Moved back to Drafts.")}>
                    <Undo2 aria-hidden /> {post.status === "scheduled" ? "Unschedule" : "Withdraw"}
                  </DropdownMenuItem>
                ) : null}
                {!missing ? (
                  <DropdownMenuItem onSelect={action("duplicate", "Copied to Drafts.")}>
                    <Copy aria-hidden /> Duplicate
                  </DropdownMenuItem>
                ) : null}
                {aiActions && (hasText || post.status === "draft") ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold text-ai">AI</DropdownMenuLabel>
                    {!hasText ? (
                      <DropdownMenuItem disabled={aiDisabled} onSelect={writeIt}>
                        <Sparkles aria-hidden className="text-ai" /> <span className="flex-1">Write it with AI</span>
                        <AiCostChip tokens={ai.draftCost} balance={ai.balance} />
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem disabled={aiDisabled} onSelect={() => setChanging(true)}>
                          <PenLine aria-hidden className="text-ai" /> <span className="flex-1">Change it with AI…</span>
                          <AiCostChip tokens={ai.draftCost} balance={ai.balance} />
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={aiDisabled} onSelect={createPicture}>
                          <ImagePlus aria-hidden className="text-ai" /> <span className="flex-1">Create a picture</span>
                          <AiCostChip tokens={ai.imageCost} balance={ai.balance} />
                        </DropdownMenuItem>
                      </>
                    )}
                    {working ? (
                      <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">The AI is working on this post. Wait for it to finish.</p>
                    ) : !ai.canRun && ai.reason ? (
                      <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">{ai.reason}</p>
                    ) : hasText ? (
                      <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">A picture from your photo library is free; an AI image costs the price shown.</p>
                    ) : null}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {canApprove && blockedByChecks ? (
          <p className="text-xs text-critical">
            {canEdit ? "Change the words that must change, then approve it." : "Send it back with a note so the words that must change get changed."}
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this post?"
        description={post.status === "published" && !missing ? "It's also deleted from your Google Business Profile." : "The post is deleted here. This can't be undone."}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          // Confirmed: its toasts ("back in drafts", "Open it") go now, so none comes back while it is being deleted.
          forgetPostToasts(post.post_id);
          void run("delete", () => deletePost(locationId, post.post_id), "Post deleted.");
        }}
      />
      {rejecting ? (
        <RejectDialog
          onClose={() => setRejecting(false)}
          onReject={(note) => {
            setRejecting(false);
            void run("reject", () => rejectPost(locationId, post.post_id, note), "Sent back to Drafts with your note.");
          }}
        />
      ) : null}
      {changing ? (
        <ChangeItDialog
          locationId={locationId}
          scheduled={post.status === "scheduled" || post.status === "pending_approval"}
          draftCost={ai.draftCost}
          imageCost={ai.imageCost}
          onClose={() => setChanging(false)}
          onSubmit={changeIt}
        />
      ) : null}
    </article>
  );
}

/**
 * The checks' notes on a card (warnings, writing notes, and hard findings a person may go ahead with): a count that
 * opens the list, so the words are there for everyone, not only in the highlights' tooltips.
 */
function CheckNotes({ findings, text, context }: { findings: readonly PostAiFinding[]; text: string; context: StandingContext }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const toCheck = findings.filter((finding) => shownSeverity(finding, context) === "warn").length;
  const Icon = toCheck ? AlertTriangle : PenLine;
  const count = findings.length;
  const label = toCheck
    ? count === 1
      ? "1 note from our checks to look at"
      : `${count} notes from our checks to look at`
    : count === 1
      ? "1 writing note from our checks"
      : `${count} writing notes from our checks`;
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex cursor-pointer items-start gap-1.5 rounded-sm text-left text-xs font-medium outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-9 pointer-coarse:items-center",
          toCheck ? "text-warning-foreground" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden className={cn("mt-px size-3.5 shrink-0", toCheck ? "text-warning" : "text-muted-foreground")} />
        <span>
          {label}
          {findings.some((finding) => finding.text) ? ", marked in the text" : ""}
        </span>
        <ChevronDown aria-hidden className={cn("mt-px size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={listId} className="rounded-lg border border-border bg-surface-strong px-3 py-2.5">
          <PostFindingsList findings={findings} text={text} context={context} />
        </div>
      ) : null}
    </div>
  );
}

/** What to do about a post's problem, besides the card's own Retry and Edit. */
function ProblemAction({ action, onReconnect }: { action: PostProblemAction; onReconnect: () => void }) {
  if (action === "reconnect") {
    return (
      <Button size="sm" variant="outline" className="shrink-0 self-start bg-card sm:self-center" onClick={onReconnect}>
        <PlugZap aria-hidden /> Reconnect Google
      </Button>
    );
  }
  if (action === "billing") {
    return (
      <Button asChild size="sm" variant="outline" className="shrink-0 self-start bg-card sm:self-center">
        <Link to="/settings/billing">
          <CreditCard aria-hidden /> Billing
        </Link>
      </Button>
    );
  }
  if (action === "support") {
    return (
      <Button asChild size="sm" variant="outline" className="shrink-0 self-start bg-card sm:self-center">
        <Link to="/support">
          <LifeBuoy aria-hidden /> Contact support
        </Link>
      </Button>
    );
  }
  return null;
}

/** The outcome of an AI run started from the card: a failure, the picture, or what "Change it" left out. */
function EndedRun({
  locationId,
  run,
  onRetry,
  onReload,
  onDismiss,
  onUsePicture,
  usingPicture,
}: {
  locationId: string;
  run: PostAiRun;
  onRetry: (() => void) | undefined;
  onReload: () => void;
  onDismiss: () => void;
  onUsePicture: ((media: PostMediaDetails) => void) | undefined;
  usingPicture: boolean;
}) {
  if (run.status === "failed") {
    const fallback = run.kind === "image" ? "The picture couldn't be made" : run.kind === "revise" ? "The post couldn't be changed" : "The post couldn't be written";
    return <RunFailure run={run} locationId={locationId} fallback={fallback} onRetry={onRetry} onReload={onReload} onDismiss={onDismiss} />;
  }
  if (run.status !== "done") return null;
  const picture = run.kind === "image" ? run.result : null;
  if (!picture && !runNotes(run)) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-ai/25 bg-ai-surface/50 px-3 py-2.5">
      {picture ? (
        <PictureOutcome image={picture} onUse={onUsePicture} using={usingPicture} className="min-w-0 flex-1" />
      ) : (
        <RunNotes locationId={locationId} run={run} onUsePicture={onUsePicture} usingPicture={usingPicture} className="min-w-0 flex-1" />
      )}
      <DismissButton onDismiss={onDismiss} />
    </div>
  );
}

/** "Change it with AI…": as asked, or a clearly different version on the same topic, optionally with a new picture. */
function ChangeItDialog({
  locationId,
  scheduled,
  draftCost,
  imageCost,
  onClose,
  onSubmit,
}: {
  locationId: string;
  /** Scheduled or waiting: it goes back to drafts when the new text doesn't pass every check. */
  scheduled: boolean;
  draftCost: number;
  imageCost: number;
  onClose: () => void;
  onSubmit: (input: AiReviseInput) => Promise<RunStartOutcome>;
}) {
  const [instructions, setInstructions] = useState("");
  const [picture, setPicture] = useState(false);
  const [sending, setSending] = useState(false);
  const [declined, setDeclined] = useState<ApiError | null>(null);
  const submit = async () => {
    setSending(true);
    setDeclined(null);
    const outcome = await onSubmit({ ...(instructions.trim() ? { instructions: instructions.trim() } : {}), image: picture ? "new" : "keep" });
    setSending(false);
    if (outcome.kind === "inline") setDeclined(outcome.error);
    else if (outcome.kind !== "failed") onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => (open || sending ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change this post with AI</DialogTitle>
          <DialogDescription>
            AI rewrites it as you ask or, with nothing asked, writes a clearly different version on the same topic. It works in the background and can
            take a few minutes.
            {scheduled ? " If the new text doesn't pass every check, the post goes back to drafts for you to review." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <InstructionsField
            value={instructions}
            onChange={setInstructions}
            label="What should change? (optional)"
            placeholder="e.g. Shorter, and mention the free parking"
            disabled={sending}
          />
          <ChangePictureOption checked={picture} onChange={setPicture} imageCost={imageCost} />
          {declined ? <DeclinedNotice error={declined} locationId={locationId} title="Nothing was changed, and nothing was spent." /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="ai" disabled={sending} onClick={() => void submit()}>
            {sending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />} Change it
            <AiCostChip tokens={draftCost} variant="inverse" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ onClose, onReject }: { onClose: () => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this post back?</DialogTitle>
          <DialogDescription>It goes back to Drafts with your note, so the author can change it.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} aria-label="What should change?" placeholder="What should change?" value={note} onChange={(event) => setNote(event.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!note.trim()} onClick={() => onReject(note.trim())}>Send back</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
