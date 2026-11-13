import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
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
  aiRegeneratePost,
  approvePost,
  deletePost,
  rejectPost,
  runPostAction,
  type Post,
  type PostAction,
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
import { noteAiSuccess } from "@/lib/ai/ai-signal";
import { useAiStatus } from "@/lib/ai/ai-status";
import { POST_TYPE_LABEL, formatEventRange, formatPostMoment, formatRecurrence, postTimeline } from "@/lib/posts/post-format";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { CTA_LABEL, STATUS_ICON, STATUS_LABEL, STATUS_TONE, postFailureText, useInvalidatePosts } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";

/** Brings a card opened from a link (`?post=`) into view once, when it mounts. */
function revealOnMount(element: HTMLElement | null) {
  if (!element) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
}

/** One post: content, status, dates, Google link, problems and the actions its status allows. */
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
  const ai = useAiStatus(locationId);
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const image = post.media[0]?.url ?? post.google.media_url;
  const aiImage = post.media[0]?.kind === "ai";
  const missing = post.google.missing;
  const notOnGoogle = ["draft", "scheduled", "pending_approval", "failed"].includes(post.status);
  const StatusIcon = STATUS_ICON[post.status];
  const eventRange = post.event ? formatEventRange(post.event) : null;

  const run = async (key: string, action: () => Promise<unknown>, success: string, options: { ai?: boolean } = {}) => {
    setBusy(key);
    try {
      const result = (await action()) as Post | { post?: Post } | undefined;
      if (options.ai) noteAiSuccess();
      const updated = result && "status" in result ? result : result && "post" in result ? result.post : undefined;
      if (updated && (updated.status === "failed" || updated.status === "rejected")) {
        toast.error(postFailureText(updated.error) ?? "Google didn't accept the post.", { description: "The post is kept; fix it and try again." });
      } else {
        toast.success(success);
      }
    } catch (err) {
      toastError(err, "That didn't work. Try again.");
    } finally {
      setBusy(null);
      invalidate();
    }
  };
  const action = (name: PostAction, success: string) => () => void run(name, () => runPostAction(locationId, post.post_id, name), success);

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
        <div className="relative shrink-0 sm:w-44">
          <img src={image} alt="" loading="lazy" className="aspect-[16/9] w-full rounded-lg border border-border object-cover sm:aspect-[4/3]" />
          {aiImage ? (
            <StatusBadge tone="ai" size="sm" icon={Sparkles} className="absolute bottom-2 left-2 bg-card shadow-xs">
              AI image
            </StatusBadge>
          ) : null}
        </div>
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

        {post.summary ? (
          <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{post.summary}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No text yet</p>
        )}

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

        {post.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-critical/25 bg-critical-surface px-3 py-2 text-sm text-critical">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{postFailureText(post.error)}</span>
          </p>
        ) : null}
        {missing ? <p className="text-xs text-muted-foreground">This post was deleted on Google. It can only be deleted here.</p> : null}
        {post.issues.length > 0 && post.status === "draft" ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Not ready to publish yet: {post.issues.map((issue) => issue.message).join(" ")}</span>
          </p>
        ) : null}
        {post.approval?.decision ? (
          <p className="text-xs text-muted-foreground">
            {post.approval.decision === "approved" ? "Approved" : "Sent back"}
            {post.approval.on_behalf ? " on the client's behalf" : ""}
            {post.approval.decided_at ? ` ${formatPostMoment(post.approval.decided_at)}` : ""}
            {post.approval.note ? <>: <span className="text-foreground">“{post.approval.note}”</span></> : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {post.status === "pending_approval" && summary.you.can_approve ? (
            <>
              <Button size="sm" disabled={busy !== null} onClick={() => void run("approve", () => approvePost(locationId, post.post_id), "Approved.")}>
                {busy === "approve" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejecting(true)}>
                <X aria-hidden /> Send back
              </Button>
            </>
          ) : null}
          {canEdit && post.status === "failed" && !missing ? (
            <Button size="sm" disabled={busy !== null} onClick={action("retry", "Published on Google.")}>
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
              <DropdownMenuContent align="end" className="w-64">
                {!missing && (post.status === "draft" || post.status === "scheduled") ? (
                  <DropdownMenuItem onSelect={action("publish", summary.you.needs_approval ? "Sent for approval." : "Published on Google.")}>
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
                {notOnGoogle && !missing ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold text-ai">AI</DropdownMenuLabel>
                    <DropdownMenuItem
                      disabled={!ai.canRun}
                      onSelect={() =>
                        void run("regenerate", () => aiRegeneratePost(locationId, post.post_id, { text: true }), "New text written.", { ai: true })
                      }
                    >
                      <Sparkles aria-hidden className="text-ai" /> <span className="flex-1">Rewrite the text</span>
                      <AiCostChip item="regenerate" locationId={locationId} balance={ai.balance} />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!ai.canRun}
                      onSelect={() =>
                        void run("regenerate", () => aiRegeneratePost(locationId, post.post_id, { text: false, image: true }), "New image created.", { ai: true })
                      }
                    >
                      <ImagePlus aria-hidden className="text-ai" /> <span className="flex-1">New AI image</span>
                      <AiCostChip item="post_image" locationId={locationId} balance={ai.balance} />
                    </DropdownMenuItem>
                    {!ai.canRun && ai.reason ? <p className="px-2 pb-1.5 pt-0.5 text-xs text-muted-foreground">{ai.reason}</p> : null}
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
    </article>
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
