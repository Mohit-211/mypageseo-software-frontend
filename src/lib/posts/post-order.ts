/**
 * How post lists are grouped and ordered (owner request #9: "I see old posts on the top").
 *
 * Since 2026-11-17 (G14) `GET locations/:id/posts` sorts on the server: `sort=group` (its default) is this
 * file's order, and `counts` gives each group's size, so the Posts page pages on the server. The groups and
 * their order, as the server applies them:
 * - Problems: newest failure first;
 * - Waiting for approval: no time first, then the next to go out;
 * - Scheduled: next to go out first (an agenda);
 * - Drafts: most recently edited first;
 * - Published: newest first (published, else scheduled, else created time).
 * Ties fall back to the newest created, then the post id, so the order never jitters.
 *
 * The browser comparators stay for the one order the server has no sort for: AI Posts' "Coming up" (waiting
 * and scheduled posts as one agenda, a waiting post without a time first), which loads its posts
 * (`useAllPosts`) and orders them here.
 */
import type { CalendarItem, Post, PostSeries, PostStatus } from "@/api";
import { byBoolean, byNumber, byText, byTime, chain, sortRows, type Comparator } from "@/lib/sort";

/** Posts per page in a list (a server page; AI Posts' "Coming up" pages in the browser). */
export const POSTS_PAGE_SIZE = 20;

/** The status groups of a post list, in the order the "All" view shows them: what needs you, what's next, then history. */
export type PostGroupId = "problems" | "waiting" | "scheduled" | "drafts" | "published";

/** A list filter: one status group, or everything. */
export type PostFilterId = "all" | PostGroupId;

export const POST_GROUP_OF: Record<PostStatus, PostGroupId> = {
  failed: "problems",
  rejected: "problems",
  pending_approval: "waiting",
  scheduled: "scheduled",
  publishing: "scheduled",
  draft: "drafts",
  published: "published",
};

export type PostGroup = {
  id: PostGroupId;
  label: string;
  statuses: readonly PostStatus[];
  /** How the group is ordered, in words (shown next to its heading). */
  orderLabel: string;
};

/** The groups in the "All" view's order. */
export const POST_GROUPS: readonly PostGroup[] = [
  { id: "problems", label: "Problems", statuses: ["failed", "rejected"], orderLabel: "Newest first" },
  { id: "waiting", label: "Waiting for approval", statuses: ["pending_approval"], orderLabel: "Next to go out first" },
  { id: "scheduled", label: "Scheduled", statuses: ["scheduled", "publishing"], orderLabel: "Next to go out first" },
  { id: "drafts", label: "Drafts", statuses: ["draft"], orderLabel: "Last edited first" },
  { id: "published", label: "Published", statuses: ["published"], orderLabel: "Newest first" },
];

const GROUP_BY_ID = new Map(POST_GROUPS.map((group) => [group.id, group]));

export function postGroup(id: PostGroupId): PostGroup {
  // Every id is in POST_GROUPS (the type is closed).
  return GROUP_BY_ID.get(id) ?? POST_GROUPS[0]!;
}

/** The filter chips of the Posts page, most used first. */
export const POST_FILTERS: readonly { id: PostFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "scheduled", label: "Scheduled" },
  { id: "drafts", label: "Drafts" },
  { id: "waiting", label: "Waiting for approval" },
  { id: "problems", label: "Problems" },
];

export function isPostFilterId(value: string | null | undefined): value is PostFilterId {
  return POST_FILTERS.some((filter) => filter.id === value);
}

/** The `status` query of a list filter (undefined for All). */
export function filterStatuses(filter: PostFilterId): string | undefined {
  return filter === "all" ? undefined : postGroup(filter).statuses.join(",");
}

/**
 * Where a group starts in the "All" order (the number of posts of the groups before it), from the server's
 * `counts`: a page whose first post sits past its group's start continues that group from the page before.
 */
export function groupStartIndex(counts: Readonly<Record<PostGroupId, number>>, group: PostGroupId): number {
  let start = 0;
  for (const entry of POST_GROUPS) {
    if (entry.id === group) return start;
    start += counts[entry.id] ?? 0;
  }
  return start;
}

/** Stable last resort: newest created first, then the id (ids grow over time). */
const tieBreak: Comparator<Post> = chain(
  byTime((post) => post.created_at, "desc"),
  byText((post) => post.post_id, "desc"),
);

// A waiting post without a time publishes as soon as it's approved, so it's the next to go out.
const noTimeFirst: Comparator<Post> = byBoolean((post) => !post.scheduled_at);

/** The order inside each status group (see the file comment). */
export const POST_GROUP_ORDER: Record<PostGroupId, Comparator<Post>> = {
  problems: chain(byTime((post) => post.error?.at ?? post.updated_at, "desc"), tieBreak),
  waiting: chain(noTimeFirst, byTime((post) => post.scheduled_at, "asc"), byTime((post) => post.approval?.requested_at, "desc"), tieBreak),
  scheduled: chain(byTime((post) => post.scheduled_at, "asc"), tieBreak),
  drafts: chain(byTime((post) => post.updated_at, "desc"), tieBreak),
  published: chain(byTime((post) => post.published_at ?? post.scheduled_at ?? post.created_at, "desc"), tieBreak),
};

const GROUP_RANK = new Map(POST_GROUPS.map((group, index) => [group.id, index]));

/** "All": the groups in POST_GROUPS order, each in its own order. */
const allOrder: Comparator<Post> = chain(
  byNumber((post) => GROUP_RANK.get(POST_GROUP_OF[post.status]) ?? POST_GROUPS.length),
  (a, b) => POST_GROUP_ORDER[POST_GROUP_OF[a.status]](a, b),
);

/** The default order of each list filter. */
export const POST_ORDER: Record<PostFilterId, Comparator<Post>> = { all: allOrder, ...POST_GROUP_ORDER };

/** The posts a filter shows, in its order (a new array; the input is never mutated). */
export function sortPosts(posts: readonly Post[], filter: PostFilterId): Post[] {
  const shown = filter === "all" ? posts : posts.filter((post) => POST_GROUP_OF[post.status] === filter);
  return sortRows(shown, POST_ORDER[filter]);
}

/** How many posts each filter holds. */
export function countPosts(posts: readonly Post[]): Record<PostFilterId, number> {
  const counts: Record<PostFilterId, number> = { all: posts.length, problems: 0, waiting: 0, scheduled: 0, drafts: 0, published: 0 };
  for (const post of posts) counts[POST_GROUP_OF[post.status]] += 1;
  return counts;
}

/** Auto-post series: active ones first, then the newest (the API answers oldest first). */
export function sortSeries(series: readonly PostSeries[]): PostSeries[] {
  return sortRows(
    series,
    byBoolean((entry) => entry.active),
    byTime((entry) => entry.created_at, "desc"),
    byText((entry) => entry.series_id),
  );
}

/**
 * Calendar items in time order. The calendar routes sort by `published_at` then `scheduled_at`
 * ascending, which puts every not-yet-published post before the published ones inside a day.
 */
export function sortCalendarItems(items: readonly CalendarItem[]): CalendarItem[] {
  return sortRows(
    items,
    byTime((item) => item.date, "asc"),
    byText((item) => item.post_id),
  );
}

/** The segments of "Your AI posts" on AI Posts: what's coming first, then drafts, history and problems. */
export type AiPostSegment = "upcoming" | "drafts" | "published" | "problems";

export const AI_POST_SEGMENTS: readonly { id: AiPostSegment; label: string; groups: readonly PostGroupId[]; orderLabel: string }[] = [
  { id: "upcoming", label: "Coming up", groups: ["waiting", "scheduled"], orderLabel: "Next to go out first" },
  { id: "drafts", label: "Drafts", groups: ["drafts"], orderLabel: "Last edited first" },
  { id: "published", label: "Published", groups: ["published"], orderLabel: "Newest first" },
  { id: "problems", label: "Problems", groups: ["problems"], orderLabel: "Newest first" },
];

export function isAiPostSegment(value: string | null | undefined): value is AiPostSegment {
  return AI_POST_SEGMENTS.some((segment) => segment.id === value);
}

const AI_SEGMENT_ORDER: Record<AiPostSegment, Comparator<Post>> = {
  // Waiting and scheduled together, as one agenda (a waiting post without a time goes first).
  upcoming: POST_GROUP_ORDER.waiting,
  drafts: POST_GROUP_ORDER.drafts,
  published: POST_GROUP_ORDER.published,
  problems: POST_GROUP_ORDER.problems,
};

/** The AI posts a segment shows, in its order. */
export function sortAiPosts(posts: readonly Post[], segment: AiPostSegment): Post[] {
  const groups = AI_POST_SEGMENTS.find((entry) => entry.id === segment)?.groups ?? [];
  return sortRows(
    posts.filter((post) => groups.includes(POST_GROUP_OF[post.status])),
    AI_SEGMENT_ORDER[segment],
  );
}

/** How many AI posts each segment holds. */
export function countAiPosts(posts: readonly Post[]): Record<AiPostSegment, number> {
  const groups = countPosts(posts);
  return { upcoming: groups.waiting + groups.scheduled, drafts: groups.drafts, published: groups.published, problems: groups.problems };
}
