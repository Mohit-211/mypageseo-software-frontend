import { queryOptions, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock, FileText, LoaderCircle, XCircle, type LucideIcon } from "lucide-react";
import {
  getPostMedia,
  getPostSeries,
  getPosts,
  getPostsCalendar,
  getPostsSummary,
  isApiError,
  type CtaType,
  type Post,
  type PostSource,
  type PostStatus,
  type PostsQuery,
  type PostTone,
  type AiImageStyle,
  type Weekday,
} from "@/api";
import { formatTokens } from "@/lib/ai/ai-costs";
import { aiErrorText } from "@/lib/ai/ai-errors";
import type { StatusTone } from "@/components/layout/shared/module-tone";

export const postsKey = (locationId: string) => ["locations", locationId, "posts"] as const;

/**
 * `GET posts/summary`: counts per status, last and next post, and `connection.gbp_connected`. The
 * backend answers for a location without Google too (the organization calendar reads that flag).
 */
export const postsSummaryQuery = (locationId: string) =>
  queryOptions({ queryKey: [...postsKey(locationId), "summary"], queryFn: ({ signal }) => getPostsSummary(locationId, signal), retry: false });

export function usePostsSummary(locationId: string) {
  return useQuery(postsSummaryQuery(locationId));
}

/**
 * One server page of posts, in the server's order ("most recently changed first"). Don't show it as
 * a list people read top to bottom: use `useAllPosts` + `sortPosts` (see below).
 */
export function usePostsList(locationId: string, query: PostsQuery) {
  return useQuery({ queryKey: [...postsKey(locationId), "list", query], queryFn: ({ signal }) => getPosts(locationId, query, signal), retry: false });
}

/** `GET posts` answers at most 100 posts per call. */
export const ALL_POSTS_PAGE_SIZE = 100;
/** Safety cap per list: 10 calls (1,000 posts). Far above what one location writes. */
export const ALL_POSTS_MAX_PAGES = 10;

export type AllPosts = {
  posts: Post[];
  /** What the server counted for this list. */
  total: number;
  /** More than `ALL_POSTS_MAX_PAGES` pages: the oldest changes may be missing. */
  capped: boolean;
};

export type AllPostsOptions = { source?: PostSource; enabled?: boolean };

async function loadAllPosts(locationId: string, query: Omit<PostsQuery, "page" | "limit">, signal: AbortSignal): Promise<AllPosts> {
  const first = await getPosts(locationId, { ...query, page: 1, limit: ALL_POSTS_PAGE_SIZE }, signal);
  const pages = Math.min(Math.ceil(first.total / ALL_POSTS_PAGE_SIZE), ALL_POSTS_MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      getPosts(locationId, { ...query, page: index + 2, limit: ALL_POSTS_PAGE_SIZE }, signal),
    ),
  );
  // A post that changes between two page calls can move across pages: keep one copy of each.
  const byId = new Map<string, Post>();
  for (const post of [first, ...rest].flatMap((page) => page.posts)) byId.set(post.post_id, post);
  return { posts: [...byId.values()], total: first.total, capped: first.total > ALL_POSTS_MAX_PAGES * ALL_POSTS_PAGE_SIZE };
}

/**
 * Every post of a list, all pages, for ordering and paging in the browser (`sortPosts`, 20 a page).
 *
 * WORKAROUND until the backend can sort: `GET locations/:id/posts` has no sort parameter and answers
 * "most recently changed first" (`updated_at desc`). "Refresh posts" and the monthly Google sync
 * rewrite `updated_at` of every synced post one at a time, in Google's newest-first order, so the
 * OLDEST published post got the latest `updated_at` and was listed first. Sorting one page can't fix
 * that, so a list loads all its pages (1 call up to 100 posts, at most 10) and sorts them itself.
 * A `sort`/`order` parameter has been requested on the Handoff Board; when it ships, go back to
 * server paging (`usePostsList`) with the order of `POST_ORDER` in `post-order.ts`.
 *
 * `statuses`: one status, a comma list, or an array; empty means every status. The key sits under
 * `postsKey`, so `useInvalidatePosts` reloads it after any change.
 */
export function useAllPosts(locationId: string, statuses?: string | readonly PostStatus[] | null, options: AllPostsOptions = {}) {
  const status = typeof statuses === "string" ? statuses : statuses?.length ? statuses.join(",") : "";
  const { source, enabled = true } = options;
  return useQuery({
    queryKey: [...postsKey(locationId), "list", { all: true, status: status || null, source: source ?? null }],
    queryFn: ({ signal }) => loadAllPosts(locationId, { ...(status ? { status } : {}), ...(source ? { source } : {}) }, signal),
    enabled,
    retry: false,
  });
}

export function usePostsCalendar(locationId: string, from: string, to: string) {
  return useQuery({
    queryKey: [...postsKey(locationId), "calendar", from, to],
    queryFn: ({ signal }) => getPostsCalendar(locationId, from, to, signal),
    retry: false,
  });
}

export function usePostSeries(locationId: string) {
  return useQuery({ queryKey: [...postsKey(locationId), "series"], queryFn: ({ signal }) => getPostSeries(locationId, signal), retry: false });
}

/** The location's photos, newest first, a page at a time ("Load more"). */
export function usePostMedia(locationId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...postsKey(locationId), "media"],
    queryFn: ({ pageParam, signal }) => getPostMedia(locationId, pageParam, 50, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    enabled,
    retry: false,
  });
}

/** Everything a post change can move: lists, counts, calendar, series; plus the token balance after AI. */
export function useInvalidatePosts(locationId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };
}

/** The token balance only: AI ideas and drafts save nothing, so the post lists don't need a reload. */
export function useInvalidateTokens() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };
}

/**
 * Token prices of every AI action (`useAiCosts(locationId)` → `post_topics`, `post_draft`,
 * `post_image`, `regenerate`, `auto_post`, …). Moved to the AI library; re-exported for older imports.
 */
export { useAiCosts } from "@/lib/ai/ai-costs";

/** "1 token", "3 tokens", "Free". Kept for older imports; prefer `formatTokens` from the AI library. */
export const tokens = formatTokens;

/** The status lists of the Posts page (kept for deep links and older imports; see `post-order.ts`). */
export const POST_TABS = [
  { id: "drafts", label: "Drafts", status: "draft" },
  { id: "waiting", label: "Waiting for approval", status: "pending_approval" },
  { id: "scheduled", label: "Scheduled", status: "scheduled,publishing" },
  { id: "published", label: "Published", status: "published" },
  { id: "problems", label: "Problems", status: "failed,rejected" },
] as const;

export type PostTabId = (typeof POST_TABS)[number]["id"] | "calendar" | "auto";

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected",
};

export const STATUS_TONE: Record<PostStatus, StatusTone> = {
  draft: "neutral",
  pending_approval: "warning",
  scheduled: "info",
  publishing: "info",
  published: "success",
  failed: "critical",
  rejected: "critical",
};

/** Each status has an icon too, so it never depends on colour alone. */
export const STATUS_ICON: Record<PostStatus, LucideIcon> = {
  draft: FileText,
  pending_approval: Clock,
  scheduled: CalendarClock,
  publishing: LoaderCircle,
  published: CheckCircle2,
  failed: XCircle,
  rejected: XCircle,
};

export const CTA_LABEL: Record<CtaType, string> = {
  BOOK: "Book",
  ORDER: "Order online",
  SHOP: "Buy",
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  CALL: "Call now",
};

export const TONE_LABEL: Record<PostTone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  enthusiastic: "Enthusiastic",
  informative: "Informative",
};

export const STYLE_LABEL: Record<AiImageStyle, string> = {
  photo_scene: "Realistic photo",
  lifestyle_photo: "Lifestyle photo",
  detail_photo: "Close-up photo",
  photo_wide: "Wide photo",
  flat_illustration: "Flat illustration",
  render_3d: "3D render",
  watercolor: "Watercolour",
};

/** Photo styles first (Google prefers real-looking photos); the rest may read as stock art. */
export const STYLE_ORDER: AiImageStyle[] = ["photo_scene", "lifestyle_photo", "detail_photo", "photo_wide", "flat_illustration", "render_3d", "watercolor"];
export const STOCK_ART_STYLES = new Set<AiImageStyle>(["flat_illustration", "render_3d", "watercolor"]);

export const WEEKDAYS: { id: Weekday; short: string }[] = [
  { id: "MONDAY", short: "Mon" },
  { id: "TUESDAY", short: "Tue" },
  { id: "WEDNESDAY", short: "Wed" },
  { id: "THURSDAY", short: "Thu" },
  { id: "FRIDAY", short: "Fri" },
  { id: "SATURDAY", short: "Sat" },
  { id: "SUNDAY", short: "Sun" },
];

/** Shortest topic `POST posts/ai-draft` accepts (backend validation: 3 characters). */
export const AI_TOPIC_MIN = 3;
/** Keywords an AI draft can weave in. */
export const MAX_DRAFT_KEYWORDS = 3;

const UPLOAD_ERRORS: Record<string, string> = {
  media_type: "Use a JPEG or PNG photo.",
  media_too_small: "The photo must be at least 250×250 pixels.",
  media_too_large: "The photo must be 5 MB or smaller.",
  media_too_plain: "The photo has too little detail. Try another one.",
  media_unreadable: "The photo couldn't be read. Try another one.",
  media_in_use: "A post that isn't published yet uses this photo.",
};

const SERIES_ERRORS: Record<string, string> = {
  insufficient_tokens: "Not enough tokens",
  ai_not_configured: "AI isn't switched on yet",
  ai_budget_reached: "AI was paused for the day",
  ai_failed: "The AI didn't answer",
  gbp_not_connected: "The location isn't connected to Google",
  ai_not_compliant: "The AI draft didn't meet Google's post rules (no tokens were used)",
};

export function seriesErrorText(code: string): string {
  return SERIES_ERRORS[code] ?? "A post couldn't be made";
}

/** What a failed or rejected post's `error.code` means for the customer. */
export const POST_FAILURE_COPY: Record<string, string> = {
  google_unavailable: "Google didn't answer. Retry in a few minutes.",
  google_rejected: "Google's review rejected this post. Edit it and publish again.",
  reconnect_required: "Google access needs to be restored before this post can publish.",
  gbp_not_connected: "The Business Profile isn't connected.",
  gbp_unbound: "The Business Profile was unbound from this location.",
  v4_access_pending: "Waiting for Google to grant posting access.",
  media_url_not_public: "Google couldn't load the photo. Remove the photo to publish now, or try again later.",
  media_unreachable: "Google couldn't load the photo. Retry, or choose another photo.",
  media_missing: "The photo is missing. Upload it again.",
  publish_interrupted: "Publishing was interrupted. Retry.",
  location_removed: "The location was removed.",
  post_incomplete: "The post isn't complete. Edit it, then publish.",
};

/** A post's failure in words; Google's own wording when it refused the request. */
export function postFailureText(error: { code: string; message: string } | null): string | null {
  if (!error) return null;
  if (error.code === "google_rejected_request") return `Google refused the post: ${error.message}`;
  return POST_FAILURE_COPY[error.code] ?? error.message;
}

/**
 * Reasons whose words come from the AI library's copy deck (`aiErrorText`), so posts, reviews and
 * keyword ideas say the same thing about AI, tokens and the account.
 */
export const AI_ROUTED_REASONS: ReadonlySet<string> = new Set([
  "ai_not_configured",
  "ai_budget_reached",
  "ai_failed",
  "insufficient_tokens",
  "subscription_required",
  "organization_suspended",
  "feature_not_included",
  "ai_not_compliant",
  "revision_in_progress",
]);

/** True when the AI copy deck has the words for this error (`useToastPostError` toasts it with `toastAiError`). */
export function isAiRoutedError(err: unknown): boolean {
  return isApiError(err) && Boolean(err.reason && AI_ROUTED_REASONS.has(err.reason));
}

/**
 * Message for a failed posts call, from `data.reason`. `buyTokens` is set when
 * the user should be offered token packs; `reload` when the post changed meanwhile.
 *
 * Pure (it is also called while rendering error states): recording what an error says about AI or
 * the account happens in `useToastPostError`, through `toastAiError`.
 */
export function postErrorText(err: unknown, fallback: string): { message: string; buyTokens?: boolean; reload?: boolean } {
  if (!isApiError(err)) return { message: fallback };
  const reason = err.reason ?? "";
  if (UPLOAD_ERRORS[reason]) return { message: UPLOAD_ERRORS[reason] };
  if (AI_ROUTED_REASONS.has(reason)) {
    const text = aiErrorText(err, { fallback });
    return { message: `${text.title}. ${text.description}`, ...(reason === "insufficient_tokens" && text.action ? { buyTokens: true } : {}) };
  }
  switch (reason) {
    case "post_incomplete":
      return { message: "The post isn't complete yet. Fix the highlighted fields first." };
    case "invalid_status":
    case "post_changed":
      return { message: "This post changed in the meantime. It has been reloaded.", reload: true };
    case "type_change_on_published":
      return { message: "A published post's type can't change. Duplicate it instead." };
    case "refresh_too_soon":
      return { message: "Posts were synced with Google a moment ago. Try again in a few minutes." };
    case "gbp_not_connected":
      return { message: "Connect this location to Google to publish." };
    case "v4_access_pending":
      return { message: "Publishing needs a Google approval that is still pending." };
    case "owner_only":
      return { message: "Only the account owner can change posting settings." };
    case "no_client":
      return { message: "Client approval needs the location to belong to a client." };
    case "not_an_approver":
      return { message: "You can't approve posts for this location." };
    case "too_many_series":
      return { message: "A location can have up to 3 active auto-post series." };
    case "invalid_input":
      return { message: err.message || "Something in the form isn't valid (for example an unknown time zone)." };
    case "ends_before_start":
      return { message: "The end date must be after the start date." };
    case "read_only":
      return { message: "Your access is read-only." };
    default:
      // A published post is patched on Google first: 502 carries Google's reason and nothing changed.
      if (err.status === 502) return { message: err.message ? `Google refused the change: ${err.message}` : "Google refused the change. Try again later." };
      return { message: err.message || fallback };
  }
}
