import { useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  List,
  LoaderCircle,
  Newspaper,
  PlugZap,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiErrorData, getPost, isApiError, refreshPosts, updatePostSettings, type ApprovalMode, type Post, type PostsSummary } from "@/api";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { AutoPostsPromo } from "@/components/posts/auto-posts-promo";
import { PostEditor } from "@/components/posts/post-editor";
import { PostList } from "@/components/posts/post-list";
import { PostsCalendar } from "@/components/posts/posts-calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatRelative } from "@/lib/datetime";
import { useGbpContext } from "@/lib/gbp/gbp-context";
import { useAiStatus } from "@/lib/ai/ai-status";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { useMonth } from "@/lib/posts/calendar";
import { formatPostMoment } from "@/lib/posts/post-format";
import { POST_FILTERS, POST_GROUP_OF, countPosts, isPostFilterId, postGroup, sortPosts, type PostFilterId } from "@/lib/posts/post-order";
import type { PostEditorTarget } from "@/lib/posts/post-seed";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { ALL_POSTS_MAX_PAGES, ALL_POSTS_PAGE_SIZE, postErrorText, useAllPosts, useInvalidatePosts, usePostsCalendar, usePostsSummary } from "@/lib/posts/use-posts";
import { useSearchUpdater } from "@/lib/url-state";

type View = "list" | "calendar";

const VIEW_OPTIONS = [
  { value: "list", label: "List", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

const APPROVAL_LABEL: Record<ApprovalMode, string> = {
  off: "No approval needed",
  team: "Owner approves team posts",
  client: "Client approves every post",
};

/**
 * Posts for one location: what needs a fix, what's coming up, drafts, and everything published,
 * newest first, as a list or a month calendar.
 *
 * Addresses (deep links from the dashboard, the calendar and AI Posts):
 * - `?tab=published|scheduled|waiting|drafts|problems` filters the list (no `tab` = All);
 * - `?view=calendar` (or the older `?tab=calendar`) shows the calendar;
 * - `?post=<id>` opens the page holding that post and outlines it;
 * - `?compose=1` opens the editor; the older `?tab=auto` goes to AI Posts › Auto-posts.
 *
 * The API can't sort posts, so the page loads every post once (`useAllPosts`) and filters, orders
 * and pages them here (`sortPosts`): switching filters needs no new call.
 */
function LocationGbpPostsPage() {
  const { location } = useGbpContext();
  // Switching location may keep this route mounted: start fresh, so an open editor, a page number
  // or a focused post never carries over to another location.
  return <PostsView key={location.location_id} />;
}

function PostsView() {
  const { location } = useGbpContext();
  const locationId = location.location_id;
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const summary = usePostsSummary(locationId);
  const all = useAllPosts(locationId);
  const canEdit = useCanEdit();
  const ai = useAiStatus(locationId);
  const now = useNow();
  const [editing, setEditing] = useState<PostEditorTarget | null>(() => (params.get("compose") ? { kind: "new" } : null));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tab = params.get("tab");
  const view: View = params.get("view") === "calendar" || tab === "calendar" ? "calendar" : "list";
  const filter: PostFilterId = isPostFilterId(tab) ? tab : "all";
  const focusPostId = params.get("post");
  const posts = all.data?.posts;
  const sorted = useMemo(() => (posts ? sortPosts(posts, filter) : []), [posts, filter]);
  const counts = useMemo(() => (posts ? countPosts(posts) : null), [posts]);

  // Auto-posts moved to AI Posts; old links (the dashboard's "series problem" action) still work.
  // The skeleton fills the frame before the redirect lands, so the link never flashes blank.
  if (tab === "auto") {
    return (
      <>
        <Navigate to={locationPath(locationId, "ai/posts", "#auto")} replace />
        <PageSkeleton />
      </>
    );
  }

  // Replaces the history entry and keeps the page where it is (a `#section` included).
  const update = (change: (next: URLSearchParams) => void) => updateSearch(change);
  const setFilter = (next: PostFilterId) =>
    update((search) => {
      if (next === "all") search.delete("tab");
      else search.set("tab", next);
      search.delete("post");
      search.delete("view");
    });
  const setView = (next: View) =>
    update((search) => {
      if (search.get("tab") === "calendar") search.delete("tab");
      if (next === "calendar") search.set("view", "calendar");
      else search.delete("view");
    });
  /** Shows one post in the list (from the calendar, for people who can't edit). */
  const focusPost = (postId: string, status: Post["status"]) =>
    update((search) => {
      search.set("tab", POST_GROUP_OF[status]);
      search.set("post", postId);
      search.delete("view");
    });
  const closeEditor = () => {
    setEditing(null);
    if (params.get("compose")) update((search) => search.delete("compose"));
  };
  const newPost = (aiOpen = false) => setEditing({ kind: "new", aiOpen });

  const header = (
    <PageHeader
      icon={Newspaper}
      tone="posts"
      title="Posts"
      description="Write, schedule and publish posts on your Google Business Profile. Regular posts keep the profile active in Google Search and Maps."
      meta={summary.data ? <HeaderMeta summary={summary.data} now={now} onChangeApproval={canEdit ? () => setSettingsOpen(true) : undefined} /> : undefined}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to={locationPath(locationId, "ai/posts")}>
              <Sparkles aria-hidden className="text-ai" /> AI Posts
            </Link>
          </Button>
          {canEdit && summary.data ? <SyncPostsButton locationId={locationId} disabled={!summary.data.connection.gbp_connected} /> : null}
          {canEdit ? (
            // Phones: the primary action comes first, not on a row of its own below the others.
            <Button className="max-sm:order-first" onClick={() => newPost()} disabled={!summary.data}>
              <Plus aria-hidden /> New post
            </Button>
          ) : null}
        </>
      }
    />
  );

  if (summary.isPending) {
    return (
      <>
        {header}
        <PageSkeleton header={false} metrics={4} rows={4} />
      </>
    );
  }
  if (summary.isError) {
    return (
      <>
        {header}
        <ErrorState description={postErrorText(summary.error, "Posts couldn't be loaded.").message} onRetry={() => void summary.refetch()} />
      </>
    );
  }

  const data = summary.data;
  const { stats } = data;
  const attention = stats.failed + stats.rejected + stats.pending_approval;
  const chipCounts = counts ?? {
    all: stats.drafts + stats.pending_approval + stats.scheduled + stats.published + stats.failed + stats.rejected,
    published: stats.published,
    scheduled: stats.scheduled,
    drafts: stats.drafts,
    waiting: stats.pending_approval,
    problems: stats.failed + stats.rejected,
  };

  return (
    <>
      {header}

      {!data.connection.gbp_connected ? (
        <ConnectNotice canEdit={canEdit} />
      ) : !data.connection.v4_enabled ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-info/25 bg-info-surface px-4 py-3 text-sm text-foreground">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
          Publishing needs an approval from Google that is still pending. Drafts and schedules are kept until then.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile
          label="Published, last 30 days"
          value={stats.published_last_30_days}
          icon={CheckCircle2}
          statusTone="success"
          onClick={() => setFilter("published")}
          hint={
            stats.last_published_at ? (
              `Last post ${formatRelative(stats.last_published_at, now)}`
            ) : (
              <span className="text-warning-foreground">No post yet. Profiles that post weekly stay fresher on Google.</span>
            )
          }
        />
        <KpiTile
          label="Scheduled"
          value={stats.scheduled}
          icon={CalendarClock}
          statusTone="info"
          onClick={() => setFilter("scheduled")}
          hint={stats.next_scheduled_at ? `Next: ${formatPostMoment(stats.next_scheduled_at, { weekday: true })}` : "Nothing scheduled yet"}
        />
        <KpiTile
          label="Drafts"
          value={stats.drafts}
          icon={FileText}
          statusTone="neutral"
          onClick={() => setFilter("drafts")}
          hint={stats.drafts ? "Finish and schedule them" : "No drafts waiting"}
        />
        <KpiTile
          label="Needs attention"
          value={attention}
          icon={attention ? AlertTriangle : ShieldCheck}
          statusTone={attention ? "warning" : "success"}
          onClick={() => setFilter(stats.failed + stats.rejected ? "problems" : "waiting")}
          hint={
            attention ? (
              <span className="text-warning-foreground">
                {[
                  stats.failed + stats.rejected ? `${stats.failed + stats.rejected} didn't publish` : null,
                  stats.pending_approval ? `${stats.pending_approval} waiting for approval` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : (
              "All clear"
            )
          }
        />
      </div>

      <AutoPostsPromo locationId={locationId} gbpConnected={data.connection.gbp_connected} />

      <section aria-label="Your posts" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {view === "list" ? (
            <FilterChips
              aria-label="Show posts"
              value={filter}
              onChange={setFilter}
              options={POST_FILTERS.map((entry) => ({
                id: entry.id,
                label: entry.label,
                count: chipCounts[entry.id],
                ...(entry.id === "problems" ? { attention: "critical" as const } : entry.id === "waiting" ? { attention: "warning" as const } : {}),
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Every dated post this month: published, scheduled and waiting. Drafts have no date yet. <AllLocationsCalendarLink />
            </p>
          )}
          <SegmentedControl size="sm" aria-label="View" value={view} onValueChange={setView} options={VIEW_OPTIONS} />
        </div>

        {view === "calendar" ? (
          <div className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
            <LocationCalendar
              locationId={locationId}
              onOpen={(post) => setEditing({ kind: "edit", post })}
              onFocus={focusPost}
              emptyAction={
                canEdit ? (
                  <Button size="sm" onClick={() => newPost()}>
                    <Plus aria-hidden /> New post
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : all.isPending ? (
          <ListSkeleton rows={4} />
        ) : all.isError ? (
          <ErrorState description={postErrorText(all.error, "Posts couldn't be loaded.").message} onRetry={() => void all.refetch()} />
        ) : sorted.length === 0 ? (
          <ListEmpty
            filter={filter}
            total={all.data.posts.length}
            canEdit={canEdit}
            aiBlocked={ai.canRun ? undefined : (ai.reason ?? "")}
            locationId={locationId}
            onNew={newPost}
            onShowAll={() => setFilter("all")}
          />
        ) : (
          <>
            {all.data.capped ? (
              <p className="text-xs text-muted-foreground">
                Showing the {(ALL_POSTS_MAX_PAGES * ALL_POSTS_PAGE_SIZE).toLocaleString()} most recently changed posts. Older ones may be missing.
              </p>
            ) : null}
            <PostList
              key={filter}
              locationId={locationId}
              posts={sorted}
              summary={data}
              onEdit={(post) => setEditing({ kind: "edit", post })}
              grouped={filter === "all"}
              focusPostId={focusPostId}
              caption={
                filter === "all" ? undefined : (
                  <>
                    {sorted.length} {sorted.length === 1 ? "post" : "posts"} · {postGroup(filter).orderLabel}
                  </>
                )
              }
            />
          </>
        )}
      </section>

      {/* Never for read-only users, whatever `?compose` says and whenever the role resolves. */}
      {editing && canEdit ? (
        <PostEditor
          locationId={locationId}
          post={editing.kind === "edit" ? editing.post : null}
          seed={editing.kind === "new" ? editing.seed : undefined}
          aiOpen={editing.kind === "new" ? editing.aiOpen : false}
          summary={data}
          onClose={closeEditor}
        />
      ) : null}
      {settingsOpen ? (
        <PostingSettingsDialog locationId={locationId} summary={data} hasClient={Boolean(location.client)} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </>
  );
}

function HeaderMeta({ summary, now, onChangeApproval }: { summary: PostsSummary; now: number; onChangeApproval: (() => void) | undefined }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck aria-hidden className="size-3.5 text-primary" />
        Approval: <span className="font-medium text-foreground">{APPROVAL_LABEL[summary.settings.approval]}</span>
        {onChangeApproval ? (
          <button
            type="button"
            onClick={onChangeApproval}
            aria-label="Change approval settings"
            // A small inline link: the ::after pads its touch target without moving the text.
            className="relative cursor-pointer rounded-sm font-semibold text-primary underline-offset-2 outline-hidden after:absolute after:-inset-x-1.5 after:-inset-y-2.5 after:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Change
          </button>
        ) : null}
      </span>
      {summary.settings.refreshed_at && summary.connection.gbp_connected ? (
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw aria-hidden className="size-3.5" />
          Synced with Google {formatRelative(summary.settings.refreshed_at, now)}
        </span>
      ) : null}
    </p>
  );
}

function ConnectNotice({ canEdit }: { canEdit: boolean }) {
  const { connect } = useGbpConnect();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong bg-card px-4 py-3.5 shadow-card sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-surface text-info ring-1 ring-inset ring-info/20">
          <PlugZap className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Connect Google to publish</p>
          <p className="text-sm text-muted-foreground">You can write and save drafts now. Connect this location's Google Business Profile to schedule and publish them.</p>
        </div>
      </div>
      {canEdit ? (
        <Button size="sm" className="shrink-0 self-start sm:self-center" onClick={() => connect()}>
          Connect Google
        </Button>
      ) : null}
    </div>
  );
}

const EMPTY_COPY: Record<PostFilterId, { title: string; description: string; done?: boolean }> = {
  all: { title: "Your first post is one click away", description: "Posts keep your Google profile active. 150–300 characters with a photo usually work best." },
  published: { title: "Nothing published yet", description: "Publish a post now or schedule one. It shows here, newest first, with its link on Google." },
  scheduled: { title: "Nothing scheduled", description: "Schedule a post for later, or let AI post for you on a schedule with auto-posts." },
  drafts: { title: "No drafts", description: "Posts you save without publishing wait here.", done: true },
  waiting: { title: "Nothing waiting for approval", description: "Posts that need an approver's OK show here.", done: true },
  problems: { title: "No problems", description: "Every post went out as planned.", done: true },
};

function ListEmpty({
  filter,
  total,
  canEdit,
  aiBlocked,
  locationId,
  onNew,
  onShowAll,
}: {
  filter: PostFilterId;
  total: number;
  canEdit: boolean;
  /** Why AI can't run right now (shown on the disabled "Write with AI"); undefined when it can. */
  aiBlocked: string | undefined;
  locationId: string;
  onNew: (aiOpen?: boolean) => void;
  onShowAll: () => void;
}) {
  const copy = EMPTY_COPY[filter];
  const firstUse = total === 0;
  return (
    <EmptyState
      variant={copy.done && !firstUse ? "all-done" : "first-use"}
      icon={copy.done && !firstUse ? CheckCircle2 : Newspaper}
      tone={copy.done && !firstUse ? undefined : "posts"}
      title={firstUse ? EMPTY_COPY.all.title : copy.title}
      description={firstUse ? EMPTY_COPY.all.description : copy.description}
      action={
        canEdit && (firstUse || !copy.done) ? (
          <Button onClick={() => onNew()}>
            <Plus aria-hidden /> New post
          </Button>
        ) : !firstUse ? (
          <Button variant="outline" onClick={onShowAll}>
            Show all posts
          </Button>
        ) : undefined
      }
      secondaryAction={
        canEdit && (firstUse || filter === "scheduled") ? (
          firstUse ? (
            <Button variant="ai" disabled={aiBlocked !== undefined} title={aiBlocked || undefined} onClick={() => onNew(true)}>
              <Sparkles aria-hidden /> Write with AI
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to={locationPath(locationId, "ai/posts", "#auto")}>
                <Sparkles aria-hidden className="text-ai" /> Set up auto-posts
              </Link>
            </Button>
          )
        ) : undefined
      }
    />
  );
}

/** The organization-wide posts calendar (`/gbp/posts`), for anyone with more than one location. */
function AllLocationsCalendarLink() {
  const { locations } = useWorkspace();
  if (locations.length < 2) return null;
  return (
    <Link
      to="/gbp/posts"
      className="whitespace-nowrap rounded-sm font-medium text-primary underline-offset-2 outline-hidden hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      See every location's posts
    </Link>
  );
}

function LocationCalendar({
  locationId,
  onOpen,
  onFocus,
  emptyAction,
}: {
  locationId: string;
  onOpen: (post: Post) => void;
  onFocus: (postId: string, status: Post["status"]) => void;
  emptyAction?: ReactNode;
}) {
  const { month, shift, today, from, to } = useMonth();
  const calendar = usePostsCalendar(locationId, from, to);
  const canEdit = useCanEdit();
  const toastError = useToastPostError();
  if (calendar.isError) {
    return <ErrorState compact description={postErrorText(calendar.error, "The calendar couldn't be loaded.").message} onRetry={() => void calendar.refetch()} />;
  }
  return (
    <PostsCalendar
      month={month}
      onShift={shift}
      onToday={today}
      items={calendar.data?.items}
      loading={calendar.isPending}
      emptyAction={emptyAction}
      onOpen={(item) => {
        if (!canEdit) {
          onFocus(item.post_id, item.status);
          return;
        }
        void getPost(locationId, item.post_id)
          .then(onOpen)
          .catch((err: unknown) => toastError(err, "That post couldn't be opened."));
      }}
    />
  );
}

function SyncPostsButton({ locationId, disabled }: { locationId: string; disabled: boolean }) {
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
  const [busy, setBusy] = useState(false);
  const [nextAllowed, setNextAllowed] = useState<string | null>(null);
  const now = useNow(15_000);
  const waiting = nextAllowed !== null && new Date(nextAllowed).getTime() > now;

  const sync = async () => {
    setBusy(true);
    try {
      const result = await refreshPosts(locationId);
      setNextAllowed(result.next_allowed_at);
      toast.success("Posts synced with Google", {
        description: `${result.updated} updated, ${result.imported} imported${result.missing ? `, ${result.missing} deleted on Google` : ""}.`,
      });
    } catch (err) {
      if (isApiError(err) && err.reason === "refresh_too_soon") {
        const next = apiErrorData(err).next_allowed_at;
        setNextAllowed(typeof next === "string" ? next : null);
      }
      toastError(err, "Posts couldn't be synced with Google.");
    } finally {
      setBusy(false);
      invalidate();
    }
  };

  return (
    <Button
      variant="outline"
      disabled={busy || waiting || disabled}
      aria-busy={busy || undefined}
      title={
        disabled
          ? "Connect Google first"
          : waiting && nextAllowed
            ? `You can sync again ${formatDateTime(nextAllowed)}`
            : "Read post states back from Google and import posts made there"
      }
      onClick={() => void sync()}
    >
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} {busy ? "Syncing…" : waiting ? "Synced" : "Sync with Google"}
    </Button>
  );
}

function PostingSettingsDialog({ locationId, summary, hasClient, onClose }: { locationId: string; summary: PostsSummary; hasClient: boolean; onClose: () => void }) {
  const access = useAccess();
  const isOwner = access.role === "owner";
  const invalidate = useInvalidatePosts(locationId);
  const toastError = useToastPostError();
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
      toastError(err, "The setting couldn't be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approval settings</DialogTitle>
          <DialogDescription>
            {isOwner ? "Choose who must approve posts before they go out." : "Only the account owner can change this."} Waiting posts show under "Waiting for
            approval" and on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={approval} onValueChange={(value) => setApproval(value as ApprovalMode)} disabled={!isOwner} className="space-y-2">
          {(
            [
              ["off", "No approval", "Posts go out when they're scheduled or published."],
              ["team", "Owner approves", "Posts written by team members wait for the owner."],
              ["client", "Client approves", hasClient ? "Every post waits for the client's user." : "Needs the location to belong to a client."],
            ] as const
          ).map(([value, title, description]) => (
            <Label
              key={value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 font-normal transition-colors has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-brand-tint/50"
            >
              <RadioGroupItem value={value} disabled={!isOwner || (value === "client" && !hasClient)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
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
