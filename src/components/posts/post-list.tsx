import { useRef, useState, type ReactNode } from "react";
import type { Post, PostsSummary } from "@/api";
import { TablePagination } from "@/components/layout/shared/data-table";
import { POSTS_PAGE_SIZE, POST_GROUP_OF, countPosts, groupStartIndex, postGroup, type PostGroupId } from "@/lib/posts/post-order";
import { PostCard } from "./post-card";

/**
 * One server page of a list (2026-11-17: the server orders and counts): `posts` is that page; the list shows it
 * as it is and the pager asks the page for another one.
 */
export type ServerPaging = {
  page: number;
  pageSize: number;
  /** The posts of the whole list (every page). */
  total: number;
  onPageChange: (page: number) => void;
};

/**
 * A list of post cards, already in order.
 *
 * - Without `paging`, `posts` is the whole list (AI Posts' "Coming up", ordered in the browser) and it pages in
 *   the browser, 20 at a time. `focusPostId` (`?post=`) opens the page holding that post.
 * - With `paging`, `posts` is one server page (the Posts page, `sort=group`).
 *
 * `grouped` (the "All" view) puts a heading before each status group, with how it is ordered, so the order is
 * never a guess; `groupCounts` (the server's `counts`) gives the headings' numbers and tells a group continued
 * from the page before. `focusPostId` outlines that post and scrolls it into view.
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
  paging,
  groupCounts,
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
  paging?: ServerPaging | undefined;
  groupCounts?: Readonly<Record<PostGroupId, number>> | null | undefined;
}) {
  const top = useRef<HTMLDivElement>(null);
  const [chosenPage, setChosenPage] = useState<number | null>(null);
  const size = paging?.pageSize ?? pageSize;
  const focusIndex = !paging && focusPostId ? posts.findIndex((post) => post.post_id === focusPostId) : -1;
  const totalItems = paging ? paging.total : posts.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / size));
  const page = paging ? paging.page : Math.min(chosenPage ?? (focusIndex >= 0 ? Math.floor(focusIndex / size) + 1 : 1), pageCount);
  // Where this page starts in the whole list.
  const start = (page - 1) * size;
  const shown = paging ? posts : posts.slice(start, start + size);
  const counts = grouped ? (groupCounts ?? (paging ? null : countPosts(posts))) : null;

  const goTo = (next: number) => {
    if (paging) paging.onPageChange(next);
    else setChosenPage(next);
    top.current?.scrollIntoView({ block: "start", behavior: "auto" });
  };

  /** A server page's first post continues its group when the group started on an earlier page. */
  const continuesFromEarlierPage = (group: PostGroupId) => (paging && counts ? start > groupStartIndex(counts, group) : false);

  return (
    <div ref={top} className="scroll-mt-20 space-y-3">
      {caption && !grouped ? <p className="text-xs font-medium text-muted-foreground">{caption}</p> : null}
      <ol className="space-y-3">
        {shown.map((post, index) => {
          const group = POST_GROUP_OF[post.status];
          const before = index > 0 ? shown[index - 1] : !paging && start > 0 ? posts[start - 1] : undefined;
          const continued =
            grouped && index === 0 && (paging ? continuesFromEarlierPage(group) : before !== undefined && POST_GROUP_OF[before.status] === group);
          const startsGroup = grouped && !continued && (!before || POST_GROUP_OF[before.status] !== group);
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
            totalItems={totalItems}
            pageSize={size}
            itemLabel={itemLabel}
            onPageChange={goTo}
          />
        </div>
      ) : null}
    </div>
  );
}
