import { useRef, useState, type ReactNode } from "react";
import type { Post, PostsSummary } from "@/api";
import { TablePagination } from "@/components/layout/shared/data-table";
import { POSTS_PAGE_SIZE, POST_GROUP_OF, countPosts, postGroup } from "@/lib/posts/post-order";
import { PostCard } from "./post-card";

/**
 * A list of post cards, already in order (`sortPosts`), paged in the browser 20 at a time.
 *
 * `grouped` (the "All" view) puts a heading before each status group, with how it is ordered, so the
 * order is never a guess. `focusPostId` (`?post=` from a calendar or a link) opens the page holding
 * that post, outlines it and scrolls it into view.
 */
export function PostList({
  locationId,
  posts,
  summary,
  onEdit,
  grouped = false,
  focusPostId = null,
  pageSize = POSTS_PAGE_SIZE,
  itemLabel = "posts",
  caption,
}: {
  locationId: string;
  posts: readonly Post[];
  summary: PostsSummary;
  onEdit: (post: Post) => void;
  grouped?: boolean;
  focusPostId?: string | null;
  pageSize?: number;
  itemLabel?: string;
  /** A line above an ungrouped list, e.g. "8 posts · Newest first". */
  caption?: ReactNode;
}) {
  const top = useRef<HTMLDivElement>(null);
  const [chosenPage, setChosenPage] = useState<number | null>(null);
  const focusIndex = focusPostId ? posts.findIndex((post) => post.post_id === focusPostId) : -1;
  const pageCount = Math.max(1, Math.ceil(posts.length / pageSize));
  const page = Math.min(chosenPage ?? (focusIndex >= 0 ? Math.floor(focusIndex / pageSize) + 1 : 1), pageCount);
  const start = (page - 1) * pageSize;
  const shown = posts.slice(start, start + pageSize);
  const counts = grouped ? countPosts(posts) : null;

  const goTo = (next: number) => {
    setChosenPage(next);
    top.current?.scrollIntoView({ block: "start", behavior: "auto" });
  };

  return (
    <div ref={top} className="scroll-mt-20 space-y-3">
      {caption && !grouped ? <p className="text-xs font-medium text-muted-foreground">{caption}</p> : null}
      <ol className="space-y-3">
        {shown.map((post, index) => {
          const group = POST_GROUP_OF[post.status];
          const before = index > 0 ? shown[index - 1] : start > 0 ? posts[start - 1] : undefined;
          const startsGroup = grouped && (!before || POST_GROUP_OF[before.status] !== group);
          const continued = grouped && index === 0 && before !== undefined && POST_GROUP_OF[before.status] === group;
          const info = postGroup(group);
          return (
            <li key={post.post_id}>
              {startsGroup || continued ? (
                <h3 className={index === 0 ? "mb-3" : "mb-3 mt-7"}>
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      {info.label}
                      {continued ? " (continued)" : ""}
                    </span>
                    {counts ? <span className="text-xs font-semibold tabular-nums text-muted-foreground">{counts[group]}</span> : null}
                    <span className="text-xs text-muted-foreground">· {info.orderLabel}</span>
                  </span>
                </h3>
              ) : null}
              <PostCard locationId={locationId} post={post} summary={summary} onEdit={onEdit} highlighted={post.post_id === focusPostId} />
            </li>
          );
        })}
      </ol>
      {pageCount > 1 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <TablePagination
            className="border-t-0"
            page={page}
            pageCount={pageCount}
            totalItems={posts.length}
            pageSize={pageSize}
            itemLabel={itemLabel}
            onPageChange={goTo}
          />
        </div>
      ) : null}
    </div>
  );
}
