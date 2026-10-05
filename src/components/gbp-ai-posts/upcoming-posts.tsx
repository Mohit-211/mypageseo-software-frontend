import { useState } from "react";
import { Link } from "react-router-dom";
import { format, isAfter } from "date-fns";
import { CalendarClock, CalendarPlus, Repeat } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_POST_TYPE_LABEL, RECURRENCE_LABEL, type AiGbpPost } from "@/lib/gbp/ai-posts";
import { PostActionsMenu } from "./post-actions";
import { AI_POSTS_PATH, AiIndicator, PostStatusBadge, PostThumbnail } from "./post-ui";
import { useNow } from "@/hooks/use-now";

const INITIAL_VISIBLE = 5;

export function UpcomingPosts({ posts, onCreate }: { posts: AiGbpPost[]; onCreate: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const now = new Date(useNow());
  const upcoming = posts
    .filter((p) => p.status !== "published" && p.scheduledAt && isAfter(new Date(p.scheduledAt), now))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const visible = showAll ? upcoming : upcoming.slice(0, INITIAL_VISIBLE);

  return (
    <Panel
      title="Upcoming Posts"
      description={upcoming.length > 0 ? `${upcoming.length} queued to go live` : "Nothing queued"}
    >
      {upcoming.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarClock}
          title="No upcoming posts"
          description="Generate a post with AI and schedule it to keep your Google Business Profile active."
          action={<Button size="sm" onClick={onCreate}><CalendarPlus aria-hidden /> Create Post</Button>}
        />
      ) : (
        <>
          <ul className="-my-1 divide-y divide-border">
            {visible.map((post) => (
              <li key={post.id} className="flex items-center gap-3 py-3">
                <PostThumbnail src={post.imageUrl} className="size-14" />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`${AI_POSTS_PATH}/${post.id}`}
                    className="block truncate text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {post.businessName} · {AI_POST_TYPE_LABEL[post.type]}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex items-center gap-1 text-xs tabular text-foreground">
                      <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
                      {format(new Date(post.scheduledAt!), "EEE, MMM d · h:mm a")}
                    </span>
                    <PostStatusBadge status={post.status} className="sm:hidden" />
                    {post.recurrence !== "none" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Repeat className="size-3" aria-hidden /> {RECURRENCE_LABEL[post.recurrence]}
                      </span>
                    ) : null}
                    {post.aiGenerated ? <AiIndicator /> : null}
                  </div>
                </div>
                <PostStatusBadge status={post.status} className="hidden shrink-0 sm:inline-flex" />
                <PostActionsMenu post={post} />
              </li>
            ))}
          </ul>
          {upcoming.length > INITIAL_VISIBLE ? (
            <div className="mt-3 border-t border-border pt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show all ${upcoming.length} upcoming posts`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

export function UpcomingPostsSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-card" role="status" aria-label="Loading upcoming posts">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-border px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="size-14 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="mt-2 h-3 w-1/3" />
              <Skeleton className="mt-2 h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-5 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
