import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, Check, Copy, ExternalLink, LoaderCircle, MoreHorizontal, Pencil, RotateCw, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
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
import { StatusBadge } from "@/components/layout/shared/data-display";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useCanEdit } from "@/hooks/use-access";
import { formatDateTime } from "@/lib/datetime";
import { CTA_LABEL, STATUS_LABEL, STATUS_TONE, postErrorText, tokens, useAiCosts, useInvalidatePosts } from "@/lib/posts/use-posts";

const TYPE_LABEL = { standard: "Update", event: "Event", offer: "Offer" } as const;

function eventDates(post: Post): string | null {
  if (!post.event) return null;
  const part = (value: { date: string; time?: string | null }) => `${value.date}${value.time ? ` ${value.time}` : ""}`;
  return `${part(post.event.start)} – ${part(post.event.end)}${post.recurrence ? ` · repeats ${post.recurrence.pattern} until ${post.recurrence.ends_on}` : ""}`;
}

/** One post: content, status, Google link, problems and the actions its status allows. */
export function PostCard({
  locationId,
  post,
  summary,
  onEdit,
}: {
  locationId: string;
  post: Post;
  summary: PostsSummary;
  onEdit: (post: Post) => void;
}) {
  const navigate = useNavigate();
  const canEdit = useCanEdit() && post.can_edit;
  const costs = useAiCosts();
  const invalidate = useInvalidatePosts(locationId);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const image = post.media[0]?.url ?? post.google.media_url;
  const missing = post.google.missing;
  const notOnGoogle = ["draft", "scheduled", "pending_approval", "failed"].includes(post.status);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      const result = (await action()) as Post | { post?: Post } | undefined;
      const updated = result && "status" in result ? result : result && "post" in result ? result.post : undefined;
      if (updated && (updated.status === "failed" || updated.status === "rejected")) {
        toast.error(updated.error?.message ?? "Google didn't accept the post.", { description: "The post is kept; fix it and try again." });
      } else {
        toast.success(success);
      }
    } catch (err) {
      const { message, buyTokens } = postErrorText(err, "That didn't work. Try again.");
      toast.error(message, buyTokens ? { action: { label: "Buy tokens", onClick: () => navigate("/settings/billing") } } : undefined);
    } finally {
      setBusy(null);
      invalidate();
    }
  };
  const action = (name: PostAction, success: string) => () => void run(name, () => runPostAction(locationId, post.post_id, name), success);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:flex-row">
      {image ? <img src={image} alt="" className="aspect-[4/3] w-full shrink-0 rounded-md object-cover sm:w-40" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <StatusBadge tone={STATUS_TONE[post.status]}>{STATUS_LABEL[post.status]}</StatusBadge>
          <StatusBadge>{TYPE_LABEL[post.type]}</StatusBadge>
          {post.source === "ai" ? <StatusBadge tone="brand">{post.series_id ? "AI · Auto-post" : "AI"}</StatusBadge> : null}
          {post.source === "google" ? <StatusBadge tone="info">From Google</StatusBadge> : null}
          {missing ? <StatusBadge tone="critical">Deleted on Google</StatusBadge> : null}
          <span className="text-muted-foreground">
            {post.published_at
              ? `Published ${formatDateTime(post.published_at)}`
              : post.scheduled_at
                ? `For ${formatDateTime(post.scheduled_at)}`
                : `Edited ${formatDateTime(post.updated_at)}`}
          </span>
        </div>
        {post.event?.title ? <p className="font-semibold text-foreground">{post.event.title}</p> : null}
        {eventDates(post) ? <p className="text-xs text-muted-foreground">{eventDates(post)}</p> : null}
        <p className="line-clamp-4 whitespace-pre-line text-sm text-foreground">{post.summary || <span className="text-muted-foreground">No text yet</span>}</p>
        {post.cta ? <p className="text-xs text-muted-foreground">Button: {CTA_LABEL[post.cta.type]}</p> : null}
        {post.offer?.coupon_code ? <p className="text-xs text-muted-foreground">Coupon: {post.offer.coupon_code}</p> : null}
        {post.error ? <p role="alert" className="text-sm text-critical">{post.error.message}</p> : null}
        {post.issues.length > 0 && post.status === "draft" ? (
          <p className="text-xs text-warning-foreground">Not ready to publish: {post.issues.map((issue) => issue.message).join(" ")}</p>
        ) : null}
        {post.approval?.decision ? (
          <p className="text-xs text-muted-foreground">
            {post.approval.decision === "approved" ? "Approved" : "Rejected"}
            {post.approval.on_behalf ? " on the client's behalf" : ""}
            {post.approval.decided_at ? ` ${formatDateTime(post.approval.decided_at)}` : ""}
            {post.approval.note ? `: “${post.approval.note}”` : ""}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {post.status === "pending_approval" && summary.you.can_approve ? (
            <>
              <Button size="sm" disabled={busy !== null} onClick={() => void run("approve", () => approvePost(locationId, post.post_id), "Approved.")}>
                {busy === "approve" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
              </Button>
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejecting(true)}>
                <X aria-hidden /> Reject
              </Button>
            </>
          ) : null}
          {post.google.search_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={post.google.search_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View on Google</a>
            </Button>
          ) : null}
          {canEdit && !missing && post.status !== "publishing" ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => onEdit(post)}>
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          {canEdit && post.status === "failed" ? (
            <Button size="sm" disabled={busy !== null} onClick={action("retry", "Published on Google.")}>
              {busy === "retry" ? <LoaderCircle aria-hidden className="animate-spin" /> : <RotateCw aria-hidden />} Retry
            </Button>
          ) : null}
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8" aria-label="More actions" disabled={busy !== null}>
                  {busy && !["approve", "retry"].includes(busy) ? <LoaderCircle aria-hidden className="animate-spin" /> : <MoreHorizontal aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!missing && (post.status === "draft" || post.status === "scheduled") ? (
                  <DropdownMenuItem onSelect={action("publish", summary.you.needs_approval ? "Sent for approval." : "Published on Google.")}>
                    <Send aria-hidden /> {summary.you.needs_approval ? "Send for approval now" : "Publish now"}
                  </DropdownMenuItem>
                ) : null}
                {post.status === "scheduled" || post.status === "pending_approval" ? (
                  <DropdownMenuItem onSelect={action("unschedule", "Moved back to Drafts.")}>
                    <Undo2 aria-hidden /> {post.status === "scheduled" ? "Unschedule" : "Withdraw"}
                  </DropdownMenuItem>
                ) : null}
                {notOnGoogle && !missing ? (
                  <DropdownMenuItem
                    onSelect={() => void run("regenerate", () => aiRegeneratePost(locationId, post.post_id, { text: true }), "New text written.")}
                  >
                    <Sparkles aria-hidden /> Regenerate text ({tokens(costs.draft)})
                  </DropdownMenuItem>
                ) : null}
                {notOnGoogle && !missing ? (
                  <DropdownMenuItem
                    onSelect={() => void run("regenerate", () => aiRegeneratePost(locationId, post.post_id, { text: false, image: true }), "New image created.")}
                  >
                    <Sparkles aria-hidden /> New AI image ({tokens(costs.image)})
                  </DropdownMenuItem>
                ) : null}
                {!missing ? (
                  <DropdownMenuItem onSelect={action("duplicate", "Copied to Drafts.")}>
                    <Copy aria-hidden /> Duplicate
                  </DropdownMenuItem>
                ) : null}
                {post.status === "draft" && !missing ? (
                  <DropdownMenuItem onSelect={() => onEdit(post)}>
                    <CalendarClock aria-hidden /> Schedule…
                  </DropdownMenuItem>
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
          <DialogTitle>Reject this post?</DialogTitle>
          <DialogDescription>It goes back to Drafts with your note, so the author can change it.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} placeholder="What should change?" value={note} onChange={(event) => setNote(event.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!note.trim()} onClick={() => onReject(note.trim())}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
