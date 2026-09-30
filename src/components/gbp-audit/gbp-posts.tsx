import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ExternalLink, List, Plus } from "lucide-react";
import { Panel, SectionHeader, StatusBadge, type StatusTone } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { ConnectGbpButton } from "@/components/gbp-audit/connect-gbp-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  POSTS_PAGE_SIZE,
  POST_STATUS_LABEL,
  POST_TYPE_LABEL,
  type GbpPost,
  type GbpPostType,
  type GbpPostsData,
  type PostLifecycle,
} from "@/lib/gbp/gbp-posts";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/layout/shared/data-table";

const statusTone: Record<PostLifecycle, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  published: "success",
  failed: "critical",
  unknown: "neutral",
};

export function GbpPostsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6" aria-label="Loading posts">
      <Skeleton className="h-12 w-full" />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

export function GbpPostsContent({ data, onRetry }: { data: GbpPostsData; onRetry: () => void }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState<"all" | PostLifecycle>("all");
  const [type, setType] = useState<"all" | GbpPostType>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GbpPost | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GbpPost | null>(null);

  const capabilities = data.capabilities;

  const filtered = useMemo(() => {
    const rows = data.posts.filter((post) => {
      if (status !== "all" && post.status !== status) return false;
      if (type !== "all" && post.type !== type) return false;
      if (capabilities.canSearch && search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${post.title ?? ""} ${post.summary ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  }, [data.posts, capabilities.canSearch, status, type, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * POSTS_PAGE_SIZE, current * POSTS_PAGE_SIZE);
  const hasFilters = status !== "all" || type !== "all" || search.trim() !== "";

  if (data.status === "loading") return <GbpPostsLoading />;
  if (data.status === "error") {
    return (
      <ErrorState
        title="Posts could not be loaded"
        description="We couldn't load posts for this profile. Try again without leaving the location."
        onRetry={onRetry}
      />
    );
  }
  if (data.status === "disconnected") {
    return (
      <EmptyState
        title="Google Business Profile is not connected"
        description="Connect this location's Google Business Profile before posts can be created, scheduled, published, or monitored here."
        action={<ConnectGbpButton />}
        className="min-h-72"
      />
    );
  }
  if (data.status === "no_posts" || data.posts.length === 0) {
    return (
      <EmptyState
        title="No posts for this location yet"
        description="This profile is connected, but no Google Business Profile posts have been returned for this location."
        className="min-h-64"
        action={capabilities.canCreate ? <Button onClick={() => setEditing("new")}><Plus aria-hidden /> Create post</Button> : undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="inline-flex rounded-md border border-border p-0.5">
            {(["list", "calendar"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                aria-pressed={view === option}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium",
                  view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "list" ? <List className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
                {option === "list" ? "List" : "Calendar"}
              </button>
            ))}
          </div>
          <Select value={status} onValueChange={(value) => { setStatus(value as PostLifecycle | "all"); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] text-xs" aria-label="Post status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(["draft", "scheduled", "published", "failed"] as PostLifecycle[]).map((value) => (
                <SelectItem key={value} value={value}>{POST_STATUS_LABEL[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {capabilities.supportedTypes.length > 0 ? (
            <Select value={type} onValueChange={(value) => { setType(value as GbpPostType | "all"); setPage(1); }}>
              <SelectTrigger className="h-9 w-[150px] text-xs" aria-label="Post type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {capabilities.supportedTypes.map((value) => (
                  <SelectItem key={value} value={value}>{POST_TYPE_LABEL[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setStatus("all"); setType("all"); setSearch(""); setPage(1); }}>Reset</Button>
          ) : null}
        </div>
        {capabilities.canSearch ? (
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search posts"
            aria-label="Search posts"
            className="h-9 w-full text-sm lg:w-64"
          />
        ) : null}
      </div>

      {view === "calendar" ? (
        <PostsCalendar posts={filtered} onSelect={(post) => setEditing(post)} />
      ) : (
        <Panel title="Posts" description={`${filtered.length.toLocaleString()} of ${data.posts.length.toLocaleString()} posts`}>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No posts match the current filters.</p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((post) => (
                <li key={post.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{post.title ?? "Untitled post"}</span>
                      <StatusBadge tone={statusTone[post.status]}>{POST_STATUS_LABEL[post.status]}</StatusBadge>
                      {post.type ? <StatusBadge tone="brand">{POST_TYPE_LABEL[post.type]}</StatusBadge> : null}
                      <span className="text-xs text-muted-foreground">{post.date ?? "Date unavailable"}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{post.summary ?? "No post copy is available."}</p>
                    {post.ctaLabel ? <p className="mt-1 text-xs text-muted-foreground">Call to action: {post.ctaLabel}</p> : null}
                    {post.status === "failed" ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-critical">
                        <AlertCircle className="size-3.5" aria-hidden />
                        {post.failureReason ?? "Publishing failed. No reason was returned."}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {post.sourceUrl ? (
                      <Button asChild variant="ghost" size="sm">
                        <a href={post.sourceUrl} target="_blank" rel="noreferrer">Open in Google <ExternalLink className="size-3.5" aria-hidden /></a>
                      </Button>
                    ) : null}
                    {post.status === "failed" && capabilities.canRetry ? (
                      <Button variant="accent" size="sm">Retry publish</Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => setEditing(post)}>
                      {capabilities.canEdit ? "Edit" : "View"}
                    </Button>
                    {capabilities.canDelete ? (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(post)}>Delete</Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {visible.length > 0 ? (
            <div className="-mx-4 -mb-4 mt-4">
              <TablePagination
                page={current}
                pageCount={totalPages}
                totalItems={filtered.length}
                pageSize={POSTS_PAGE_SIZE}
                itemLabel="posts"
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </Panel>
      )}

      <PostEditor post={editing} data={data} onClose={() => setEditing(null)} />

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{confirmDelete?.title ?? "Untitled post"}” from this location. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-critical text-primary-foreground hover:bg-critical/90">Delete post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Operational month grid placing posts on their scheduled or published day. */
function PostsCalendar({ posts, onSelect }: { posts: GbpPost[]; onSelect: (post: GbpPost) => void }) {
  const dated = posts.filter((post) => post.timestamp);
  const anchor = dated[0]?.timestamp ? new Date(dated[0].timestamp) : new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => (index < startOffset ? null : index - startOffset + 1));
  const monthLabel = firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <section aria-labelledby="posts-calendar-title">
      <SectionHeader title={`Calendar — ${monthLabel}`} description="Scheduled and published posts by date" />
      <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
        <div className="grid min-w-[640px] grid-cols-7 border-b border-border bg-brand-tint">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="px-2 py-2 text-xs font-medium text-muted-foreground">{day}</div>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7">
          {cells.map((day, index) => {
            const dayPosts = day === null ? [] : dated.filter((post) => new Date(post.timestamp as string).getDate() === day && new Date(post.timestamp as string).getMonth() === month);
            return (
              <div key={index} className="min-h-24 border-b border-r border-border p-1.5 last:border-r-0">
                {day === null ? null : (
                  <>
                    <span className="text-xs tabular text-muted-foreground">{day}</span>
                    <div className="mt-1 space-y-1">
                      {dayPosts.map((post) => (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => onSelect(post)}
                          className="block w-full truncate rounded border border-border bg-brand-tint px-1.5 py-1 text-left text-[11px] font-medium text-foreground hover:border-primary/40"
                        >
                          {post.title ?? "Untitled post"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {dated.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No posts carry a scheduled or published date, so nothing can be placed on the calendar.</p>
      ) : null}
    </section>
  );
}

function PostEditor({ post, data, onClose }: { post: GbpPost | "new" | null; data: GbpPostsData; onClose: () => void }) {
  const capabilities = data.capabilities;
  const existing = post && post !== "new" ? post : null;
  const isNew = post === "new";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isGeneratedDraft, setIsGeneratedDraft] = useState(false);
  const editable = isNew ? capabilities.canCreate : capabilities.canEdit;

  return (
    <Sheet
      open={post !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setTitle("");
          setBody("");
          setIsGeneratedDraft(false);
        }
      }}
    >
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        {post ? (
          <>
            <SheetHeader>
              <SheetTitle>{isNew ? "Create post" : (existing?.title ?? "Post")}</SheetTitle>
              <SheetDescription>
                {isNew ? "Write the post copy, then choose whether to save, schedule, or publish it." : "Review this post's current details and status."}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              {existing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={statusTone[existing.status]}>{POST_STATUS_LABEL[existing.status]}</StatusBadge>
                  {existing.type ? <StatusBadge tone="brand">{POST_TYPE_LABEL[existing.type]}</StatusBadge> : null}
                  <span className="text-xs text-muted-foreground">{existing.date ?? "Date unavailable"}</span>
                </div>
              ) : null}

              {existing?.mediaUrl ? (
                <img src={existing.mediaUrl} alt="" className="h-40 w-full rounded-md border border-border object-cover" />
              ) : null}

              {existing ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Post copy</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">{existing.summary ?? "No post copy is available."}</p>
                </div>
              ) : null}

              {existing?.status === "failed" ? (
                <div className="rounded-md border border-critical/25 bg-critical-surface p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-critical">Publishing failed</p>
                  <p className="mt-1 text-sm text-foreground">{existing.failureReason ?? "No failure reason was returned by Google."}</p>
                </div>
              ) : null}

              {editable ? (
                <div className="space-y-4">
                  {capabilities.supportedTypes.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="post-type">Post type</Label>
                      <Select defaultValue={capabilities.supportedTypes[0] ?? "update"}>
                        <SelectTrigger id="post-type" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {capabilities.supportedTypes.map((value) => (
                            <SelectItem key={value} value={value}>{POST_TYPE_LABEL[value]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label htmlFor="post-title">Title</Label>
                    <Input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short, specific post title" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="post-body">Post copy</Label>
                      {capabilities.canGenerateDraft ? (
                        <Button variant="outline" size="sm" onClick={() => setIsGeneratedDraft(true)}>Generate draft</Button>
                      ) : null}
                    </div>
                    {isGeneratedDraft ? <StatusBadge tone="warning">Generated draft — review before publishing</StatusBadge> : null}
                    <Textarea id="post-body" rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What should customers know?" />
                  </div>

                  {capabilities.ctaOptions.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="post-cta">Call to action</Label>
                      <Select>
                        <SelectTrigger id="post-cta" className="h-9 text-sm"><SelectValue placeholder="Select a call to action" /></SelectTrigger>
                        <SelectContent>
                          {capabilities.ctaOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  {capabilities.canUploadMedia ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="post-media">Image</Label>
                      <Input id="post-media" type="file" accept="image/*" />
                    </div>
                  ) : null}

                  {capabilities.canSchedule ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="post-schedule">Publication date and time</Label>
                      <Input id="post-schedule" type="datetime-local" />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                    <Button variant="outline" size="sm" disabled={body.trim() === ""}>Save draft</Button>
                    {capabilities.canSchedule ? <Button variant="outline" size="sm" disabled={body.trim() === ""}>Schedule</Button> : null}
                    {capabilities.canPublish ? <Button size="sm" disabled={body.trim() === ""}>Publish now</Button> : null}
                  </div>
                </div>
              ) : (
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Creating, editing, scheduling, and publishing posts is not available in the current product integration, so posts can only be read here.
                </p>
              )}

              {existing?.sourceUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={existing.sourceUrl} target="_blank" rel="noreferrer">Open in Google <ExternalLink className="size-3.5" aria-hidden /></a>
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
