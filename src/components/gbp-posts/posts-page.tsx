import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  List,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Send,
  Settings2,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  apiErrorData,
  decidePost,
  deletePost,
  postAction,
  refreshPosts,
  updatePostSettings,
  type Post,
  type PostApprovalMode,
  type PostsSummary,
} from "@/api";
import { MetricCard, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton, MetricSkeletonGrid } from "@/components/layout/shared/feedback/states";
import { RowActions, TablePagination } from "@/components/layout/shared/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/datetime";
import {
  POST_CTA_LABEL,
  POST_FAILURE_COPY,
  POST_STATUS_LABEL,
  POST_STATUS_TONE,
  POST_TABS,
  POST_TYPE_LABEL,
  postDateText,
  postErrorMessage,
  postWhenText,
  type PostTabId,
} from "@/lib/posts/posts";
import { postsKey, usePostsList, usePostsSummary } from "@/lib/posts/use-posts";
import { cn } from "@/lib/utils";
import { PostsCalendar } from "./posts-calendar";
import { PostSeriesPanel } from "./post-series";
import { PostEditor } from "./post-editor";

const PAGE_SIZE = 20;

type Editing = { post: Post | null } | null;

/** The Posts page for one location: stats, tabs by status, list or calendar, editor and approval. */
type View = "list" | "calendar" | "auto";
const VIEWS: View[] = ["list", "calendar", "auto"];

/**
 * `?view=list|calendar|auto`, `?tab=<status tab>` and `?new=1` (open the editor) let the
 * dashboard's post actions link straight to the right place.
 */
export function PostsPageContent({ locationId, clientAssigned }: { locationId: string; clientAssigned: boolean }) {
  const summary = usePostsSummary(locationId);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Editing>(() => (params.get("new") === "1" ? { post: null } : null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const view: View = VIEWS.includes(params.get("view") as View) ? (params.get("view") as View) : "list";
  const tabParam = params.get("tab");
  const tab: PostTabId = POST_TABS.some((entry) => entry.id === tabParam) ? (tabParam as PostTabId) : "all";
  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === null) next.delete(key);
        else next.set(key, value);
        next.delete("new");
        return next;
      },
      { replace: true },
    );

  if (summary.isPending) {
    return (
      <div className="space-y-6">
        <MetricSkeletonGrid count={4} />
        <ListSkeleton rows={4} />
      </div>
    );
  }
  if (summary.isError) {
    return <ErrorState description={postErrorMessage(summary.error, "Posts couldn't be loaded.")} onRetry={() => void summary.refetch()} />;
  }

  const data = summary.data;
  const canPublish = data.connection.gbp_connected && data.connection.v4_enabled;

  return (
    <div className="space-y-6">
      <ConnectionBanner summary={data} locationId={locationId} />

      <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
        <MetricCard
          accent="green"
          label="Published (30 days)"
          value={data.stats.published_last_30_days}
          caption={data.stats.last_published_at ? `Last ${formatDateTime(data.stats.last_published_at)}` : "Nothing published yet"}
        />
        <MetricCard
          accent="brand"
          label="Scheduled"
          value={data.stats.scheduled}
          caption={data.stats.next_scheduled_at ? `Next ${formatDateTime(data.stats.next_scheduled_at)}` : "Nothing scheduled"}
        />
        <MetricCard accent="amber" label="Waiting for approval" value={data.stats.pending_approval} caption={`${data.stats.drafts} draft${data.stats.drafts === 1 ? "" : "s"}`} />
        <MetricCard accent="red" label="Failed or rejected" value={data.stats.failed + data.stats.rejected} caption="Need your attention" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="View" className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {VIEWS.map((value) => {
            const Icon = value === "list" ? List : value === "calendar" ? CalendarDays : Repeat;
            const problems = value === "auto" ? (data.stats.series_problems ?? 0) : 0;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setParam("view", value === "list" ? null : value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium",
                  view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {value === "list" ? "List" : value === "calendar" ? "Calendar" : "Auto-posts"}
                {problems > 0 ? (
                  <span className="rounded-full bg-warning px-1.5 text-[10px] font-semibold text-warning-foreground" aria-label={`${problems} with problems`}>{problems}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {data.you.role === "owner" ? (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 aria-hidden /> Approval
            </Button>
          ) : null}
          <RefreshButton locationId={locationId} summary={data} />
          <Button size="sm" disabled={!canPublish} onClick={() => setEditing({ post: null })}>
            <Plus aria-hidden /> New post
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <PostsList
          locationId={locationId}
          summary={data}
          tab={tab}
          onTab={(next) => setParam("tab", next === "all" ? null : next)}
          onEdit={(post) => setEditing({ post })}
          onNew={() => setEditing({ post: null })}
        />
      ) : view === "calendar" ? (
        <PostsCalendar locationId={locationId} />
      ) : (
        <PostSeriesPanel locationId={locationId} summary={data} onOpenPost={(post) => setEditing({ post })} />
      )}

      {editing ? <PostEditor locationId={locationId} post={editing.post} summary={data} onClose={() => setEditing(null)} /> : null}
      {settingsOpen ? (
        <ApprovalSettings locationId={locationId} summary={data} clientAssigned={clientAssigned} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}

function ConnectionBanner({ summary, locationId }: { summary: PostsSummary; locationId: string }) {
  if (!summary.connection.gbp_connected) {
    return (
      <Alert>
        <AlertTriangle aria-hidden />
        <AlertTitle>Connect the Business Profile to post</AlertTitle>
        <AlertDescription>
          <p>Posts are published to this location's Google Business Profile, which isn't connected.</p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to={`/locations/${locationId}/gbp`}>Open GBP</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!summary.connection.v4_enabled) {
    return (
      <Alert>
        <AlertTriangle aria-hidden />
        <AlertTitle>Posting isn't available yet</AlertTitle>
        <AlertDescription>Google hasn't granted posting access for this server yet. Drafts are kept until it does.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

function RefreshButton({ locationId, summary }: { locationId: string; summary: PostsSummary }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  /** Disables the button until `until`, then re-enables it. */
  const block = (until: string | null) => {
    if (!until) return;
    const wait = new Date(until).getTime() - Date.now();
    if (!(wait > 0)) return;
    setBlockedUntil(until);
    window.setTimeout(() => setBlockedUntil(null), wait);
  };
  const refresh = async () => {
    setBusy(true);
    try {
      const result = await refreshPosts(locationId);
      block(result.next_allowed_at);
      toast.success("Posts refreshed from Google", {
        description: `${result.updated} updated, ${result.imported} imported${result.missing ? `, ${result.missing} deleted on Google` : ""}.`,
      });
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
    } catch (err) {
      const next = apiErrorData(err).next_allowed_at;
      if (typeof next === "string") block(next);
      toast.error(postErrorMessage(err, "Posts couldn't be refreshed."), typeof next === "string" ? { description: `Try again after ${formatDateTime(next)}.` } : undefined);
    } finally {
      setBusy(false);
    }
  };
  const cooling = blockedUntil !== null;
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || cooling || !summary.connection.gbp_connected}
      title={
        cooling
          ? `You can refresh again after ${formatDateTime(blockedUntil)}`
          : summary.settings.refreshed_at
            ? `Last refreshed ${formatDateTime(summary.settings.refreshed_at)}`
            : undefined
      }
      onClick={() => void refresh()}
    >
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} Refresh posts
    </Button>
  );
}

function PostsList({
  locationId,
  summary,
  tab,
  onTab,
  onEdit,
  onNew,
}: {
  locationId: string;
  summary: PostsSummary;
  tab: PostTabId;
  onTab: (tab: PostTabId) => void;
  onEdit: (post: Post) => void;
  onNew: () => void;
}) {
  const [page, setPage] = useState(1);
  const status = POST_TABS.find((entry) => entry.id === tab)?.status;
  const list = usePostsList(locationId, { ...(status ? { status } : {}), page, limit: PAGE_SIZE });
  const counts: Record<PostTabId, number | null> = {
    all: null,
    draft: summary.stats.drafts,
    pending_approval: summary.stats.pending_approval,
    scheduled: summary.stats.scheduled,
    published: summary.stats.published,
    problems: summary.stats.failed + summary.stats.rejected,
  };

  return (
    <Panel>
      <div role="tablist" aria-label="Post status" className="-mt-1 mb-4 flex flex-wrap gap-2">
        {POST_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => { onTab(entry.id); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              tab === entry.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {entry.label}
            {counts[entry.id] !== null ? <span className="tabular">{counts[entry.id]}</span> : null}
          </button>
        ))}
      </div>

      {list.isPending ? (
        <ListSkeleton rows={4} />
      ) : list.isError ? (
        <ErrorState description={postErrorMessage(list.error, "Posts couldn't be loaded.")} onRetry={() => void list.refetch()} />
      ) : list.data.posts.length === 0 ? (
        <EmptyState
          compact
          title={tab === "all" ? "No posts yet" : "No posts here"}
          description={tab === "all" ? "Write your first post, or refresh to import posts made on Google." : "Posts with this status show here."}
          {...(tab === "all" && summary.connection.gbp_connected ? { action: <Button size="sm" onClick={onNew}><Plus aria-hidden /> New post</Button> } : {})}
        />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {list.data.posts.map((post) => (
              <PostRow key={post.post_id} locationId={locationId} post={post} summary={summary} onEdit={() => onEdit(post)} />
            ))}
          </ul>
          <TablePagination
            page={list.data.page}
            pageCount={Math.ceil(list.data.total / list.data.limit)}
            totalItems={list.data.total}
            pageSize={list.data.limit}
            itemLabel="posts"
            onPageChange={setPage}
            className="-mx-4 -mb-4 mt-4"
          />
        </>
      )}
    </Panel>
  );
}

type RowAction = "publish" | "retry" | "unschedule" | "duplicate" | "approve" | "reject" | "delete";

function PostRow({ locationId, post, summary, onEdit }: { locationId: string; post: Post; summary: PostsSummary; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<RowAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const run = async (action: RowAction, note?: string) => {
    setBusy(action);
    try {
      if (action === "delete") {
        const result = await deletePost(locationId, post.post_id);
        toast.success(result.deleted_on_google ? "Post deleted here and on Google" : "Post deleted");
      } else if (action === "approve" || action === "reject") {
        await decidePost(locationId, post.post_id, action, note);
        toast.success(action === "approve" ? "Post approved" : "Post sent back to draft");
      } else {
        const result = await postAction(locationId, post.post_id, action);
        const message: Record<typeof action, string> = {
          publish: result.status === "pending_approval" ? "Sent for approval" : result.status === "failed" ? "The post couldn't be published" : "Post published",
          retry: result.status === "failed" ? "Publishing failed again" : "Post published",
          unschedule: "Moved back to drafts",
          duplicate: "Copy saved as a draft",
        };
        toast[result.status === "failed" ? "error" : "success"](message[action], result.error ? { description: result.error.message } : undefined);
      }
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
    } catch (err) {
      toast.error(postErrorMessage(err, "That didn't work. Try again."));
    } finally {
      setBusy(null);
      setConfirmDelete(false);
      setRejecting(false);
    }
  };

  const photo = post.media[0]?.url ?? post.google?.media_url ?? null;
  const dated = post.event ?? post.offer;
  const missing = post.google?.missing === true;
  const canApprove = !missing && summary.you.can_approve && post.status === "pending_approval";
  const editable = post.can_edit && !post.google?.missing && post.status !== "publishing";
  const failure = post.error ? (post.error.code === "google_rejected_request" ? post.error.message : (POST_FAILURE_COPY[post.error.code] ?? post.error.message)) : null;

  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      {photo ? <img src={photo} alt="" className="hidden h-20 w-28 shrink-0 rounded-md border border-border object-cover sm:block" /> : null}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={POST_STATUS_TONE[post.status]}>{POST_STATUS_LABEL[post.status]}</StatusBadge>
          <span className="text-xs font-medium text-muted-foreground">{POST_TYPE_LABEL[post.type]}</span>
          {post.source === "google" ? <StatusBadge tone="neutral">From Google</StatusBadge> : null}
          {post.source === "ai" ? <StatusBadge tone="brand">{post.series_id ? "AI · Auto-post" : "AI"}</StatusBadge> : null}
          {post.recurrence ? <span className="text-xs text-muted-foreground">· Repeats {post.recurrence.pattern}</span> : null}
          {post.google?.missing ? <StatusBadge tone="neutral">Deleted on Google</StatusBadge> : null}
        </div>
        {dated?.title ? (
          <p className="text-sm font-semibold text-foreground">
            {dated.title}
            {postDateText(dated.start) ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {postDateText(dated.start)}{postDateText(dated.end) ? ` – ${postDateText(dated.end)}` : ""}
              </span>
            ) : null}
          </p>
        ) : null}
        {post.summary ? <p className="line-clamp-3 text-sm text-foreground">{post.summary}</p> : <p className="text-sm italic text-muted-foreground">No text yet</p>}
        <p className="text-xs text-muted-foreground">
          {postWhenText(post)}
          {post.cta ? ` · Button: ${POST_CTA_LABEL[post.cta.type]}` : ""}
          {post.approval?.decision === "rejected" && post.approval.note ? ` · Sent back: "${post.approval.note}"` : ""}
          {post.approval?.decision === "approved"
            ? ` · Approved${post.approval.on_behalf ? " on the client's behalf" : ""}${post.approval.note ? `: "${post.approval.note}"` : ""}`
            : ""}
        </p>
        {failure ? <p className="text-xs text-critical">{failure}</p> : null}
        {post.issues.length > 0 && post.status === "draft" ? (
          <p className="text-xs text-muted-foreground">Still needed: {post.issues.map((issue) => issue.message).join(" · ")}</p>
        ) : null}
        {canApprove ? (
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={busy !== null} onClick={() => void run("approve")}>
              {busy === "approve" ? <LoaderCircle aria-hidden className="animate-spin" /> : <Check aria-hidden />} Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setRejecting(true)}>
              <X aria-hidden /> Send back
            </Button>
          </div>
        ) : null}
      </div>

      <div className="shrink-0">
        <RowActions label={`Actions for this ${POST_TYPE_LABEL[post.type].toLowerCase()} post`}>
          {editable ? (
            <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden /> Edit</DropdownMenuItem>
          ) : null}
          {missing ? null : post.status === "draft" && post.issues.length === 0 ? (
            <DropdownMenuItem onSelect={() => void run("publish")}>
              <Send aria-hidden /> {summary.you.needs_approval ? "Send for approval" : "Publish now"}
            </DropdownMenuItem>
          ) : null}
          {!missing && post.status === "scheduled" && !summary.you.needs_approval ? (
            <DropdownMenuItem onSelect={() => void run("publish")}><Send aria-hidden /> Publish now</DropdownMenuItem>
          ) : null}
          {!missing && post.status === "failed" ? (
            <DropdownMenuItem onSelect={() => void run("retry")}><RefreshCw aria-hidden /> Retry</DropdownMenuItem>
          ) : null}
          {!missing && (post.status === "scheduled" || post.status === "pending_approval") ? (
            <DropdownMenuItem onSelect={() => void run("unschedule")}><Undo2 aria-hidden /> Move back to drafts</DropdownMenuItem>
          ) : null}
          {!missing ? <DropdownMenuItem onSelect={() => void run("duplicate")}><Copy aria-hidden /> Duplicate</DropdownMenuItem> : null}
          {!missing && post.google?.search_url ? (
            <DropdownMenuItem asChild>
              <a href={post.google.search_url} target="_blank" rel="noreferrer"><ExternalLink aria-hidden /> View on Google</a>
            </DropdownMenuItem>
          ) : null}
          {!missing ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem className="text-critical focus:text-critical" onSelect={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden /> Delete
          </DropdownMenuItem>
        </RowActions>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              {post.status === "published" && !post.google?.missing
                ? "It's also removed from your Google Business Profile. This can't be undone."
                : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "delete"}
              className="bg-critical text-white hover:bg-critical/90"
              onClick={(event) => { event.preventDefault(); void run("delete"); }}
            >
              {busy === "delete" ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {rejecting ? <RejectDialog busy={busy === "reject"} onCancel={() => setRejecting(false)} onReject={(note) => void run("reject", note)} /> : null}
    </li>
  );
}

function RejectDialog({ busy, onCancel, onReject }: { busy: boolean; onCancel: () => void; onReject: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send this post back</DialogTitle>
          <DialogDescription>It goes back to drafts. Say what should change.</DialogDescription>
        </DialogHeader>
        <Textarea rows={3} value={note} placeholder="Change the wording of the second sentence" onChange={(event) => setNote(event.target.value)} />
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button disabled={busy} onClick={() => onReject(note.trim())}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const APPROVAL_OPTIONS: { value: PostApprovalMode; label: string; description: string }[] = [
  { value: "off", label: "No approval", description: "Everyone who can edit posts publishes directly." },
  { value: "team", label: "Team approval", description: "Members' posts wait until the owner approves them. The owner's own posts don't wait." },
  { value: "client", label: "Client approval", description: "Every post waits until a user of this location's client approves it. You can approve on the client's behalf." },
];

function ApprovalSettings({
  locationId,
  summary,
  clientAssigned,
  onClose,
}: {
  locationId: string;
  summary: PostsSummary;
  clientAssigned: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<PostApprovalMode>(summary.settings.approval);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await updatePostSettings(locationId, { approval: value });
      toast.success("Approval setting saved");
      void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
      onClose();
    } catch (err) {
      toast.error(postErrorMessage(err, "The setting couldn't be saved."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post approval</DialogTitle>
          <DialogDescription>Who has to approve a post before it's published for this location.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={value} onValueChange={(next) => setValue(next as PostApprovalMode)} className="space-y-2">
          {APPROVAL_OPTIONS.map((option) => {
            const disabled = option.value === "client" && !clientAssigned;
            return (
              <label
                key={option.value}
                className={cn("flex gap-3 rounded-md border border-border p-3", disabled ? "opacity-60" : "cursor-pointer hover:bg-secondary/40")}
              >
                <RadioGroupItem value={option.value} disabled={disabled} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {disabled ? "Assign this location to a client first." : option.description}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || value === summary.settings.approval} onClick={() => void save()}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
