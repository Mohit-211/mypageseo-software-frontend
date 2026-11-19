import { useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  FileText,
  Info,
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
import { PostCard } from "@/components/posts/post-card";
import { PostEditor } from "@/components/posts/post-editor";
import { PostList } from "@/components/posts/post-list";
import { PostsCalendar } from "@/components/posts/posts-calendar";
import { RunProgress } from "@/components/posts/run-status";
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
import { useActivePostRuns } from "@/lib/posts/ai-runs";
import { useMonth } from "@/lib/posts/calendar";
import { usePostOpenHost } from "@/lib/posts/open-post";
import { formatPostMoment } from "@/lib/posts/post-format";
import { POSTS_PAGE_SIZE, POST_FILTERS, POST_GROUP_OF, filterStatuses, isPostFilterId, postGroup, type PostFilterId } from "@/lib/posts/post-order";
import type { PostEditorTarget } from "@/lib/posts/post-seed";
import { useToastPostError } from "@/lib/posts/post-toasts";
import { useRunOutcomeNotices } from "@/lib/posts/use-post-runs";
import { postErrorText, useInvalidatePosts, usePost, usePostsCalendar, usePostsList, usePostsSummary } from "@/lib/posts/use-posts";
import { useSearchUpdater } from "@/lib/url-state";

type View = "list" | "calendar";

const VIEW_OPTIONS = [
  { value: "list", label: "List", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
] as const;

/**
 * What the location's approval setting governs. With approvals off, AI posts can still wait for the owner or a
 * member (Phase 25c: a series in review mode, or what the checks flagged), so "off" speaks of the team's posts.
 */
const APPROVAL_LABEL: Record<ApprovalMode, string> = {
  off: "Team posts go out without approval",
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
 * - `?post=<id>` (the rejection email's link, the calendar's) outlines that post; when it isn't on the list's
 *   page, it is read by id and shown above the list;
 * - `?compose=1` opens the editor; the older `?tab=auto` goes to AI Posts › Auto-posts.
 *
 * The server orders and pages the list (2026-11-17, G14): `sort=group` is the order of the "All" view (problems,
 * waiting, scheduled, drafts, published, each in its own order), each filter is one server page at a time, and
 * `counts` gives the filter chips' numbers. The page polls the location's active AI runs, so every card shows
 * "Creating…" while the AI works on it.
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
  const canEdit = useCanEdit();
  const ai = useAiStatus(locationId);
  const now = useNow();
  const [editing, setEditing] = useState<PostEditorTarget | null>(() => (params.get("compose") ? { kind: "new" } : null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The location's AI runs, polled while any works: each card reads its own, and new drafts being written (no
  // post yet, so no card) show above the list until their post lands in Drafts.
  const pageRuns = useActivePostRuns(locationId);
  const newDrafts = pageRuns.runs.filter((run) => run.kind === "draft" && !run.post_id);
  // How the viewer's own runs ended when nothing on screen showed it: the editor that started one was closed, or a
  // "Change it" sent a scheduled post back to drafts and its card left the list.
  useRunOutcomeNotices(locationId);
  // "Open it" on those toasts (and the cards' own) opens the post here, read again, never over a window; from another
  // page it comes here (`?post=`) and opens that post once read (open-post.ts).
  usePostOpenHost(locationId, (post, run) => setEditing({ kind: "edit", post, run }), params.get("post"));

  const tab = params.get("tab");
  const view: View = params.get("view") === "calendar" || tab === "calendar" ? "calendar" : "list";
  const filter: PostFilterId = isPostFilterId(tab) ? tab : "all";
  const focusPostId = params.get("post");
  // The page number belongs to its filter: another filter (a chip, a link, Back) starts at page 1.
  const [paging, setPaging] = useState<{ filter: PostFilterId; page: number }>({ filter, page: 1 });
  const page = paging.filter === filter ? paging.page : 1;
  const list = usePostsList(locationId, { ...(filter === "all" ? {} : { status: filterStatuses(filter) }), sort: "group", page, limit: POSTS_PAGE_SIZE }, { enabled: view === "list" });
  // The previous page stays on screen while the next one of the same filter loads (no jump); the chips keep their
  // numbers (the same filters without `status`). Another filter's page waits behind a skeleton instead.
  const posts = list.data?.posts;
  const fromOtherFilter = list.isPlaceholderData && filter !== "all" && (posts ?? []).some((post) => POST_GROUP_OF[post.status] !== filter);
  const counts = list.data?.counts ?? null;
  // A post from a link that isn't on this page: read it by id and show it above the list.
  const focusOnPage = Boolean(focusPostId && posts?.some((post) => post.post_id === focusPostId));
  const linked = usePost(locationId, focusPostId, view === "list" && list.isSuccess && !list.isPlaceholderData && !focusOnPage);

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
  const setFilter = (next: PostFilterId) => {
    setPaging({ filter: next, page: 1 });
    update((search) => {
      if (next === "all") search.delete("tab");
      else search.set("tab", next);
      search.delete("post");
      search.delete("view");
    });
  };
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
        ) : (
          <>
            {newDrafts.map((run) => (
              <RunProgress key={run.run_id} run={run} />
            ))}
            {focusPostId && !focusOnPage && (linked.data || linked.isError) ? (
              <LinkedPost
                locationId={locationId}
                post={linked.data ?? null}
                error={linked.error}
                summary={data}
                onEdit={(post) => setEditing({ kind: "edit", post })}
              />
            ) : null}
            {list.isError && !list.data ? (
              <ErrorState description={postErrorText(list.error, "Posts couldn't be loaded.").message} onRetry={() => void list.refetch()} />
            ) : list.isPending || fromOtherFilter || !list.data ? (
              <ListSkeleton rows={4} />
            ) : list.data.posts.length === 0 && page > 1 ? (
              // The list got shorter (posts deleted or moved) while this page was open.
              <EmptyState
                variant="no-results"
                title="No posts on this page any more"
                description="Some posts moved or were deleted."
                action={
                  <Button variant="outline" onClick={() => setPaging({ filter, page: 1 })}>
                    Go to the first page
                  </Button>
                }
                compact
              />
            ) : list.data.posts.length === 0 ? (
              <ListEmpty
                filter={filter}
                total={counts?.all ?? chipCounts.all}
                canEdit={canEdit}
                aiBlocked={ai.canRun ? undefined : (ai.reason ?? "")}
                locationId={locationId}
                onNew={newPost}
                onShowAll={() => setFilter("all")}
              />
            ) : (
              <PostList
                key={filter}
                locationId={locationId}
                posts={list.data.posts}
                summary={data}
                onEdit={(post) => setEditing({ kind: "edit", post })}
                grouped={filter === "all"}
                groupCounts={counts}
                focusPostId={focusPostId}
                paging={{ page, pageSize: POSTS_PAGE_SIZE, total: list.data.total, onPageChange: (next) => setPaging({ filter, page: next }) }}
                caption={
                  filter === "all" ? undefined : (
                    <>
                      {list.data.total} {list.data.total === 1 ? "post" : "posts"} · {postGroup(filter).orderLabel}
                    </>
                  )
                }
              />
            )}
          </>
        )}
      </section>

      {/* Never for read-only users, whatever `?compose` says and whenever the role resolves. */}
      {editing && canEdit ? (
        <PostEditor
          // Another post opened (from a toast's "Open it", the calendar) starts a fresh editor: its form is the post's.
          key={editing.kind === "edit" ? editing.post.post_id : "new"}
          locationId={locationId}
          post={editing.kind === "edit" ? editing.post : null}
          aiOpen={editing.kind === "new" ? editing.aiOpen : false}
          run={editing.kind === "edit" ? (editing.run ?? null) : null}
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

/** The post a link names (`?post=`) when it isn't on the list's page: read by id and outlined above the list. */
function LinkedPost({
  locationId,
  post,
  error,
  summary,
  onEdit,
}: {
  locationId: string;
  post: Post | null;
  error: unknown;
  summary: PostsSummary;
  onEdit: (post: Post) => void;
}) {
  if (!post) {
    const gone = isApiError(error) && error.status === 404;
    return (
      <p role="status" className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {gone ? "The post from your link was deleted." : postErrorText(error, "The post from your link couldn't be loaded.").message}
      </p>
    );
  }
  return (
    <section aria-label="The post from your link" className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">From your link</h3>
      <PostCard locationId={locationId} post={post} summary={summary} onEdit={onEdit} highlighted />
    </section>
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
              ["off", "No approval", "Your team's posts go out when they're scheduled or published. AI posts that need a person's review still wait for one."],
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
