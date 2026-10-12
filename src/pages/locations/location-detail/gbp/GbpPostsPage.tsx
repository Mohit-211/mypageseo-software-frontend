import { useState } from "react";
import { useNow } from "@/hooks/use-now";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LoaderCircle, Megaphone, Plus, RefreshCw, Settings2 } from "lucide-react";
import {
  apiErrorData,
  getPost,
  isApiError,
  refreshPosts,
  updatePostSettings,
  type ApprovalMode,
  type Post,
  type PostsSummary,
} from "@/api";
import { PageHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { GbpNavigation } from "@/components/location/location-workspace";
import { AutoPosts } from "@/components/posts/auto-posts";
import { PostCard } from "@/components/posts/post-card";
import { PostEditor } from "@/components/posts/post-editor";
import { PostsCalendar } from "@/components/posts/posts-calendar";
import { useMonth } from "@/lib/posts/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { formatDateTime } from "@/lib/datetime";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import {
  POST_TABS,
  postErrorText,
  useInvalidatePosts,
  usePostsCalendar,
  usePostsList,
  usePostsSummary,
  type PostTabId,
} from "@/lib/posts/use-posts";

const PAGE_SIZE = 20;
const TAB_IDS: PostTabId[] = ["drafts", "waiting", "scheduled", "published", "problems", "calendar", "auto"];

/**
 * GBP posts for one location (Phase 9 / 9.1): tabs by status, the calendar and
 * auto-posts. `?tab=` deep-links from the dashboard actions; `?compose=1` opens the editor.
 */
function LocationGbpPostsPage() {
  const { location } = useGbpContext();
  const locationId = location.location_id;
  const [params, setParams] = useSearchParams();
  const summary = usePostsSummary(locationId);
  const canEdit = useCanEdit();
  const { connect } = useGbpConnect();
  const [editing, setEditing] = useState<Post | "new" | null>(params.get("compose") ? "new" : null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabParam = params.get("tab") as PostTabId | null;
  const tab: PostTabId = tabParam && TAB_IDS.includes(tabParam) ? tabParam : "drafts";
  const setTab = (next: PostTabId) => setParams((current) => {
    const updated = new URLSearchParams(current);
    updated.set("tab", next);
    updated.delete("compose");
    return updated;
  }, { replace: true });

  const header = (
    <PageHeader
      title="GBP Posts"
      description="Write, schedule and publish Google Business Profile posts, or let AI keep the profile active."
      meta={summary.data ? <SummaryMeta summary={summary.data} /> : undefined}
      actions={
        summary.data ? (
          <div className="flex flex-wrap gap-2">
            {canEdit ? <RefreshPostsButton locationId={locationId} disabled={!summary.data.connection.gbp_connected} /> : null}
            {canEdit ? <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 aria-hidden /> Approval</Button> : null}
            {canEdit ? <Button size="sm" onClick={() => setEditing("new")}><Plus aria-hidden /> New post</Button> : null}
          </div>
        ) : undefined
      }
    />
  );

  if (summary.isPending) return <><GbpNavigation locationId={locationId} activeView="posts" />{header}<PageSkeleton /></>;
  if (summary.isError) {
    return (
      <>
        <GbpNavigation locationId={locationId} activeView="posts" />
        {header}
        <ErrorState description={postErrorText(summary.error, "Posts couldn't be loaded.").message} onRetry={() => void summary.refetch()} />
      </>
    );
  }
  const data = summary.data;
  const counts: Record<string, number> = {
    drafts: data.stats.drafts,
    waiting: data.stats.pending_approval,
    scheduled: data.stats.scheduled,
    published: data.stats.published,
    problems: data.stats.failed + data.stats.rejected,
    auto: data.stats.series_problems ?? 0,
  };

  return (
    <>
      <GbpNavigation locationId={locationId} activeView="posts" />
      {header}
      {!data.connection.gbp_connected ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-surface/40 p-3 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-warning-foreground">Connect this location to Google to publish. Drafts can still be written.</p>
          {canEdit ? <Button size="sm" variant="outline" onClick={() => connect()}>Connect Google</Button> : null}
        </div>
      ) : !data.connection.v4_enabled ? (
        <p className="rounded-lg border border-warning/40 bg-warning-surface/40 p-3 text-sm text-warning-foreground">
          Publishing needs a Google approval that is still pending. Drafts and schedules are kept until then.
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as PostTabId)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-10 w-max">
            {POST_TABS.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id} className="h-8 gap-1.5 px-3">
                {entry.label}
                {counts[entry.id] ? <span className="rounded bg-muted px-1.5 text-[11px] tabular">{counts[entry.id]}</span> : null}
              </TabsTrigger>
            ))}
            <TabsTrigger value="calendar" className="h-8 px-3">Calendar</TabsTrigger>
            <TabsTrigger value="auto" className="h-8 gap-1.5 px-3">
              Auto-posts
              {counts.auto ? <StatusBadge tone="warning" className="px-1 py-0 text-[10px]">{counts.auto}</StatusBadge> : null}
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {tab === "calendar" ? (
        <LocationCalendar locationId={locationId} onOpen={setEditing} />
      ) : tab === "auto" ? (
        <AutoPosts locationId={locationId} gbpConnected={data.connection.gbp_connected} onOpenPost={setEditing} />
      ) : (
        <PostList key={tab} locationId={locationId} status={POST_TABS.find((entry) => entry.id === tab)?.status ?? "draft"} summary={data} onEdit={setEditing} onNew={canEdit ? () => setEditing("new") : undefined} />
      )}

      {editing ? <PostEditor locationId={locationId} post={editing === "new" ? null : editing} summary={data} onClose={() => setEditing(null)} /> : null}
      {settingsOpen ? <PostingSettingsDialog locationId={locationId} summary={data} hasClient={Boolean(location.client)} onClose={() => setSettingsOpen(false)} /> : null}
    </>
  );
}

function SummaryMeta({ summary }: { summary: PostsSummary }) {
  const { stats } = summary;
  return (
    <p className="text-xs text-muted-foreground">
      {stats.published_last_30_days} published in the last 30 days
      {stats.last_published_at ? ` · last ${formatDateTime(stats.last_published_at)}` : ""}
      {stats.next_scheduled_at ? ` · next ${formatDateTime(stats.next_scheduled_at)}` : ""}
      {summary.settings.approval !== "off" ? ` · approval: ${summary.settings.approval === "team" ? "owner approves" : "client approves"}` : ""}
    </p>
  );
}

function PostList({
  locationId,
  status,
  summary,
  onEdit,
  onNew,
}: {
  locationId: string;
  status: string;
  summary: PostsSummary;
  onEdit: (post: Post) => void;
  onNew: (() => void) | undefined;
}) {
  const [page, setPage] = useState(1);
  const list = usePostsList(locationId, { status, page, limit: PAGE_SIZE });

  if (list.isPending) return <ListSkeleton rows={3} />;
  if (list.isError) return <ErrorState description={postErrorText(list.error, "Posts couldn't be loaded.").message} onRetry={() => void list.refetch()} />;
  if (list.data.posts.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Nothing here"
        description={status === "draft" ? "Write a post to keep the profile active. Posts of 150–300 characters with a photo usually do best." : "No posts in this list."}
        action={onNew && status === "draft" ? <Button size="sm" onClick={onNew}><Plus aria-hidden /> New post</Button> : undefined}
      />
    );
  }
  const pages = Math.max(1, Math.ceil(list.data.total / PAGE_SIZE));
  return (
    <div className="space-y-3">
      {list.data.posts.map((post) => (
        <PostCard key={post.post_id} locationId={locationId} post={post} summary={summary} onEdit={onEdit} />
      ))}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="tabular text-muted-foreground">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  );
}

function LocationCalendar({ locationId, onOpen }: { locationId: string; onOpen: (post: Post) => void }) {
  const { month, shift, from, to } = useMonth();
  const calendar = usePostsCalendar(locationId, from, to);
  const canEdit = useCanEdit();
  if (calendar.isError) return <ErrorState description={postErrorText(calendar.error, "The calendar couldn't be loaded.").message} onRetry={() => void calendar.refetch()} />;
  return (
    <PostsCalendar
      month={month}
      onShift={shift}
      items={calendar.data?.items}
      loading={calendar.isPending}
      onOpen={
        canEdit
          ? (item) =>
              void getPost(locationId, item.post_id)
                .then(onOpen)
                .catch(() => toast.error("That post couldn't be opened."))
          : undefined
      }
    />
  );
}

function RefreshPostsButton({ locationId, disabled }: { locationId: string; disabled: boolean }) {
  const invalidate = useInvalidatePosts(locationId);
  const [busy, setBusy] = useState(false);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);
  const now = useNow(15_000);
  const waiting = nextAllowed !== null && new Date(nextAllowed).getTime() > now;

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await refreshPosts(locationId);
      setNextAllowed(result.next_allowed_at);
      toast.success(`Posts refreshed: ${result.updated} updated, ${result.imported} imported from Google${result.missing ? `, ${result.missing} deleted on Google` : ""}.`);
    } catch (err) {
      if (isApiError(err) && err.reason === "refresh_too_soon") {
        const next = apiErrorData(err).next_allowed_at;
        setNextAllowed(typeof next === "string" ? next : null);
      }
      toast.error(postErrorText(err, "Posts couldn't be refreshed.").message);
    } finally {
      setBusy(false);
      invalidate();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy || waiting || disabled}
      title={waiting && nextAllowed ? `Available ${formatDateTime(nextAllowed)}` : "Read post states back from Google and import posts made there"}
      onClick={() => void refresh()}
    >
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} {waiting ? "Refreshed recently" : "Refresh posts"}
    </Button>
  );
}

function PostingSettingsDialog({ locationId, summary, hasClient, onClose }: { locationId: string; summary: PostsSummary; hasClient: boolean; onClose: () => void }) {
  const access = useAccess();
  const isOwner = access.role === "owner";
  const invalidate = useInvalidatePosts(locationId);
  const [approval, setApproval] = useState<ApprovalMode>(summary.settings.approval);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updatePostSettings(locationId, { approval });
      invalidate();
      toast.success("Approval setting saved.");
      onClose();
    } catch (err) {
      toast.error(postErrorText(err, "The setting couldn't be saved.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post approval</DialogTitle>
          <DialogDescription>
            {isOwner ? "Choose who must approve posts before they go out." : "Only the account owner can change this."} There are no approval emails yet; waiting posts show in the Waiting tab and on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={approval} onValueChange={(value) => setApproval(value as ApprovalMode)} disabled={!isOwner} className="space-y-2">
          {([
            ["off", "No approval", "Posts go out when scheduled or published."],
            ["team", "Owner approves", "Posts written by team members wait for the owner."],
            ["client", "Client approves", hasClient ? "Every post waits for the client's user." : "Needs the location to belong to a client."],
          ] as const).map(([value, title, description]) => (
            <Label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 font-normal">
              <RadioGroupItem value={value} disabled={!isOwner || (value === "client" && !hasClient)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Close</Button>
          {isOwner ? (
            <Button disabled={saving || approval === summary.settings.approval} onClick={() => void save()}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : null} Save
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LocationGbpPostsPage;
