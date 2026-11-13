import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarClock, FileText, ImageOff, Lightbulb, Newspaper, PenLine, PlugZap, Plus, Repeat, Send, Sparkles, Tags } from "lucide-react";
import type { Post } from "@/api";
import { AiStatusBanner } from "@/components/ai/ai-status-banner";
import { PageHeader, SectionHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, ListSkeleton, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { FilterChips } from "@/components/layout/shared/filter-chips";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { AiWriter } from "@/components/posts/ai-writer";
import { AutoPosts } from "@/components/posts/auto-posts";
import { PostEditor } from "@/components/posts/post-editor";
import { PostList } from "@/components/posts/post-list";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { useAiStatus } from "@/lib/ai/ai-status";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatPostMoment } from "@/lib/posts/post-format";
import { AI_POST_SEGMENTS, countAiPosts, isAiPostSegment, sortAiPosts, type AiPostSegment } from "@/lib/posts/post-order";
import type { PostEditorTarget } from "@/lib/posts/post-seed";
import { postErrorText, useAllPosts, usePostSeries, usePostsSummary } from "@/lib/posts/use-posts";
import { useTracking } from "@/lib/rankings/use-rankings";
import { byTime, sortRows } from "@/lib/sort";
import { useSearchUpdater } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * AI Posts (`/locations/:locationId/ai/posts`): everything AI does for Google posts, on one page.
 * 1. Ideas and the AI writer: picking a version opens the editor seeded with it.
 * 2. Auto-posts (`#auto`): AI series that write and publish on a schedule.
 * 3. Your AI posts (`#ai-posts`): every post written with AI (`source=ai`), in order.
 *
 * Addresses: `#ideas`, `#auto` and `#ai-posts` jump to a section (older `?ideas=1` and `?section=auto`
 * are rewritten to them); `?keyword=` (from Keywords) starts the writer on that keyword; `?new=series`
 * opens the new auto-post dialog; `?show=upcoming|drafts|published|problems` picks the list segment.
 * AI stays visible when it can't run: the banner says why and the AI buttons are disabled with the
 * reason (never hidden). Phase 25 slots (review queue, "Change it", AI settings) are not built yet.
 */
function AiPostsPage() {
  const { location } = useLocationRoute();
  const [params] = useSearchParams();
  // Older links (`?ideas=1`, `?section=auto`) become section anchors, which the app keeps in view
  // while the page above them loads.
  const anchor = params.get("section") === "auto" ? "#auto" : params.has("ideas") ? "#ideas" : null;
  if (anchor) {
    const rest = new URLSearchParams(params);
    rest.delete("section");
    rest.delete("ideas");
    const search = rest.toString();
    // The skeleton fills the frame before the redirect lands, so an old bookmark never flashes blank.
    return (
      <>
        <Navigate replace to={locationPath(location.location_id, "ai/posts", `${search ? `?${search}` : ""}${anchor}`)} />
        <PageSkeleton />
      </>
    );
  }
  // Switching location may keep this route mounted: ideas, drafts and an open editor belong to the
  // location they were written for, so each location starts fresh.
  return <AiPostsView key={location.location_id} />;
}

function AiPostsView() {
  const { location } = useLocationRoute();
  const locationId = location.location_id;
  const [params] = useSearchParams();
  const updateSearch = useSearchUpdater();
  const ai = useAiStatus(locationId);
  const canEdit = useCanEdit();
  const summary = usePostsSummary(locationId);
  const aiPosts = useAllPosts(locationId, null, { source: "ai" });
  const series = usePostSeries(locationId);
  const tracking = useTracking(locationId);
  const now = useNow();
  const listRef = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<PostEditorTarget | null>(null);

  const posts = aiPosts.data?.posts;
  const counts = useMemo(() => (posts ? countAiPosts(posts) : null), [posts]);
  const showParam = params.get("show");
  // Without a choice: what's coming up, else the latest published, else drafts.
  const segment: AiPostSegment = isAiPostSegment(showParam)
    ? showParam
    : !counts || counts.upcoming > 0
      ? "upcoming"
      : counts.published > 0
        ? "published"
        : counts.drafts > 0
          ? "drafts"
          : "upcoming";
  const shown = useMemo(() => (posts ? sortAiPosts(posts, segment) : []), [posts, segment]);
  const publishedRecently = useMemo(
    () => (posts ?? []).filter((post) => post.status === "published" && post.published_at && Date.parse(post.published_at) >= now - 30 * DAY_MS).length,
    [posts, now],
  );
  const nextUpcoming = useMemo(() => (posts ? sortAiPosts(posts, "upcoming").find((post) => post.scheduled_at)?.scheduled_at : undefined), [posts]);

  const seriesList = series.data?.series ?? [];
  const activeSeries = seriesList.filter((entry) => entry.active);
  const nextSlot = sortRows(
    activeSeries.flatMap((entry) => entry.next_slots),
    byTime((slot) => slot, "asc"),
  )[0];

  const keywordParam = params.get("keyword");
  const data = summary.data;
  const connected = data?.connection.gbp_connected ?? true;
  const photosPublishable = data?.connection.photos_publishable ?? true;
  const noKeywords = tracking.isSuccess && tracking.data.tracking.keywords.length === 0;

  // Keeps the page where it is (`#auto` / `#ideas` included) and is committed before it returns, so
  // `showSegment` can scroll to the list right after.
  const setSegment = (next: AiPostSegment) => updateSearch((updated) => updated.set("show", next), { flushSync: true });
  /** From a number at the top of the page: pick the segment and bring the list into view. */
  const showSegment = (next: AiPostSegment) => {
    setSegment(next);
    listRef.current?.scrollIntoView({ block: "start" });
  };
  const openEditor = (target: PostEditorTarget) => setEditing(target);

  return (
    <>
      <PageHeader
        icon={PenLine}
        tone="ai"
        title="AI Posts"
        description={
          canEdit
            ? "Get post ideas, let AI write posts and pictures in your voice, and keep your Google profile active with auto-posts. Nothing goes live until you say so."
            : "The Google posts written with AI for this location: what's coming up, what went live, and the auto-posts that keep your profile active."
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={locationPath(locationId, "gbp/posts")}>
                <Newspaper aria-hidden /> All posts
              </Link>
            </Button>
            {canEdit ? (
              // While AI status is still loading, keep the AI label (no flicker); the editor opens once posts load.
              ai.canRun || ai.blockedBy === "checking" ? (
                <Button variant="ai" disabled={!data} onClick={() => openEditor({ kind: "new", aiOpen: true })}>
                  <Sparkles aria-hidden /> New post with AI
                </Button>
              ) : (
                <Button disabled={!data} onClick={() => openEditor({ kind: "new" })}>
                  <Plus aria-hidden /> Write a post
                </Button>
              )
            ) : null}
          </>
        }
      />

      <AiStatusBanner status={ai} />

      {data && !connected ? (
        <Notice
          icon={PlugZap}
          tone="info"
          title="Ideas and drafts work now"
          action={canEdit ? <ConnectButton /> : undefined}
        >
          Connect this location's Google Business Profile to publish posts and to use auto-posts.
        </Notice>
      ) : null}
      {data && connected && !photosPublishable ? (
        <Notice icon={ImageOff} tone="warning" title="Posts with a photo can't be published yet">
          AI images can be created, but a post with a photo won't publish to Google until this is available. Keep auto-post images off until then.
        </Notice>
      ) : null}
      {noKeywords && canEdit ? (
        <Notice
          icon={Tags}
          tone="neutral"
          title="Add keywords for better posts"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={locationPath(locationId, "keywords")}>
                Add keywords <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        >
          AI weaves your tracked keywords into ideas and posts, which helps you show up for those searches.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Status tiles share the Posts page's status colours; the Auto-posts tile stays AI violet. */}
        <KpiTile
          label="Coming up"
          value={counts?.upcoming ?? 0}
          icon={CalendarClock}
          statusTone="info"
          loading={aiPosts.isPending}
          onClick={() => showSegment("upcoming")}
          hint={nextUpcoming ? `Next: ${formatPostMoment(nextUpcoming, { weekday: true })}` : "No AI post scheduled"}
        />
        <KpiTile
          label="AI drafts"
          value={counts?.drafts ?? 0}
          icon={FileText}
          statusTone="neutral"
          loading={aiPosts.isPending}
          onClick={() => showSegment("drafts")}
          // A read-only client user never sees the writer or the editor: the agency does this part.
          hint={counts?.drafts ? (canEdit ? "Ready to check and schedule" : "Your agency checks and schedules these") : "No drafts waiting"}
        />
        <KpiTile
          label="Published, last 30 days"
          value={publishedRecently}
          icon={Send}
          statusTone="success"
          loading={aiPosts.isPending}
          onClick={() => showSegment("published")}
          hint={counts ? `${counts.published} published with AI in total` : undefined}
        />
        <KpiTile
          label="Auto-posts"
          value={series.data ? `${activeSeries.length} of ${series.data.limit}` : "–"}
          icon={Repeat}
          tone="ai"
          loading={series.isPending}
          to="#auto"
          hint={nextSlot ? `Next AI post ${formatPostMoment(nextSlot, { weekday: true })}` : activeSeries.length ? "No slot coming up" : "None running"}
        />
      </div>

      {canEdit ? (
        <section id="ideas" aria-label="Ideas and AI writer" className="scroll-mt-20 space-y-4">
          <SectionHeader
            icon={Lightbulb}
            tone="ai"
            title="Ideas and AI writer"
            description="Start from a fresh idea or your own topic. AI writes the post in your voice, and you check it before anything goes live."
          />
          <AiWriter
            locationId={locationId}
            layout="page"
            initialKeyword={keywordParam}
            onPick={(draft, context) => openEditor({ kind: "new", seed: { ...context, draft } })}
          />
        </section>
      ) : null}

      <section id="auto" aria-label="Auto-posts" className="scroll-mt-20">
        <AutoPosts
          locationId={locationId}
          timeZone={location.timezone}
          gbpConnected={connected}
          photosPublishable={photosPublishable}
          startNew={params.get("new") === "series"}
          onOpenPost={(post) => openEditor({ kind: "edit", post })}
        />
      </section>

      <section id="ai-posts" ref={listRef} aria-label="Your AI posts" className="scroll-mt-20 space-y-4">
        <SectionHeader
          icon={Newspaper}
          tone="ai"
          title="Your AI posts"
          description={canEdit ? "Every post written with AI for this location. Open one to edit, schedule or publish it." : "Every post written with AI for this location."}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to={locationPath(locationId, "gbp/posts")}>
                All posts <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        <FilterChips
          aria-label="Show AI posts"
          value={segment}
          onChange={setSegment}
          options={AI_POST_SEGMENTS.map((entry) => ({
            id: entry.id,
            label: entry.label,
            ...(counts ? { count: counts[entry.id] } : {}),
            ...(entry.id === "problems" ? { attention: "critical" as const } : {}),
          }))}
        />
        {aiPosts.isPending || !data ? (
          summary.isError ? (
            <ErrorState description={postErrorText(summary.error, "Posts couldn't be loaded.").message} onRetry={() => void summary.refetch()} />
          ) : (
            <ListSkeleton rows={3} />
          )
        ) : aiPosts.isError ? (
          <ErrorState description={postErrorText(aiPosts.error, "AI posts couldn't be loaded.").message} onRetry={() => void aiPosts.refetch()} />
        ) : shown.length === 0 ? (
          <SegmentEmpty segment={segment} hasAny={(posts?.length ?? 0) > 0} />
        ) : (
          <PostList
            key={segment}
            locationId={locationId}
            posts={shown}
            summary={data}
            onEdit={(post: Post) => openEditor({ kind: "edit", post })}
            itemLabel="AI posts"
            caption={
              <>
                {shown.length} {shown.length === 1 ? "post" : "posts"} · {AI_POST_SEGMENTS.find((entry) => entry.id === segment)?.orderLabel}
              </>
            }
          />
        )}
      </section>

      {editing && data && canEdit ? (
        <PostEditor
          locationId={locationId}
          post={editing.kind === "edit" ? editing.post : null}
          seed={editing.kind === "new" ? editing.seed : undefined}
          aiOpen={editing.kind === "new" ? editing.aiOpen : false}
          summary={data}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function ConnectButton() {
  const { connect } = useGbpConnect();
  return (
    <Button size="sm" onClick={() => connect()}>
      Connect Google
    </Button>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  action,
  children,
}: {
  icon: typeof Sparkles;
  tone: "info" | "warning" | "neutral";
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-center",
        tone === "info" && "border-info/25 bg-info-surface",
        tone === "warning" && "border-warning/35 bg-warning-surface",
        tone === "neutral" && "border-border bg-card shadow-card",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon
          aria-hidden
          className={cn("mt-0.5 size-5 shrink-0", tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "text-chart-3")}
        />
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", tone === "warning" ? "text-warning-foreground" : "text-foreground")}>{title}</p>
          <p className={cn("text-sm", tone === "warning" ? "text-warning-foreground" : "text-muted-foreground")}>{children}</p>
        </div>
      </div>
      {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
    </div>
  );
}

/** `readOnly`: the words for a client user, who never sees the writer (their agency writes the posts). */
const SEGMENT_EMPTY: Record<AiPostSegment, { title: string; description: string; readOnly?: string }> = {
  upcoming: {
    title: "No AI posts coming up",
    description: "Write one with AI above and schedule it, or set up auto-posts to keep a steady rhythm.",
    readOnly: "When your agency schedules an AI post, it shows here.",
  },
  drafts: {
    title: "No AI drafts",
    description: "Versions you save from the AI writer wait here until you schedule them.",
    readOnly: "AI drafts your agency is still working on show here.",
  },
  published: { title: "No AI posts published yet", description: "Once an AI post goes live, it shows here, newest first." },
  problems: { title: "No problems", description: "Every AI post went out as planned." },
};

function SegmentEmpty({ segment, hasAny }: { segment: AiPostSegment; hasAny: boolean }) {
  const canEdit = useCanEdit();
  const copy = SEGMENT_EMPTY[segment];
  if (!hasAny && segment !== "problems") {
    return (
      <EmptyState
        icon={Sparkles}
        tone="ai"
        title="Your AI posts will show here"
        description={
          canEdit ? "Pick an idea or a topic above, choose a version and save it. Posts written by auto-posts show here too." : "AI posts your agency writes show here."
        }
        compact
      />
    );
  }
  return (
    <EmptyState
      variant={segment === "problems" ? "all-done" : "no-results"}
      title={copy.title}
      description={canEdit ? copy.description : (copy.readOnly ?? copy.description)}
      compact
    />
  );
}

export default AiPostsPage;
