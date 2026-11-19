import { keepPreviousData, queryOptions, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Clock, FileText, LoaderCircle, XCircle, type LucideIcon } from "lucide-react";
import {
  apiErrorData,
  getPost,
  getPostMedia,
  getPostSeries,
  getPosts,
  getPostsCalendar,
  getPostsSummary,
  isApiError,
  type CtaType,
  type Post,
  type PostCounts,
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
import { notApproverText, type ApproverViewerRole } from "./approval-labels";

export const postsKey = (locationId: string) => ["locations", locationId, "posts"] as const;

/**
 * `GET posts/summary`: counts per status, last and next post, and `connection.gbp_connected`. The
 * backend answers for a location without Google too (the organization calendar reads that flag).
 * Phase 25c: `ai { configured, paused_today, token_costs }` for the AI buttons (see `post-ai-state.ts`).
 */
export const postsSummaryQuery = (locationId: string) =>
  queryOptions({ queryKey: [...postsKey(locationId), "summary"], queryFn: ({ signal }) => getPostsSummary(locationId, signal), retry: false });

export function usePostsSummary(locationId: string) {
  return useQuery(postsSummaryQuery(locationId));
}

/**
 * One server page of posts, in the server's order (2026-11-17): `sort=group` (the default) is the Posts page's
 * order (problems newest failure first; waiting with no time first, then the next to go out; scheduled next
 * first; drafts last edited first; published newest first), and `counts` gives the filter chips' numbers (the
 * same filters without `status`). The previous page stays on screen while the next one loads.
 */
export function usePostsList(locationId: string, query: PostsQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...postsKey(locationId), "list", query],
    queryFn: ({ signal }) => getPosts(locationId, query, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    retry: false,
  });
}

/**
 * One post (`GET …/posts/:postId`), e.g. for `?post=<id>` when it isn't on the list's page. `refetchMs` reads it
 * again on a timer (a series post its series is writing: nothing to poll but the post itself).
 */
export function usePost(locationId: string, postId: string | null | undefined, enabled = true, options: { refetchMs?: number | false } = {}) {
  return useQuery({
    queryKey: [...postsKey(locationId), "post", postId ?? ""],
    queryFn: ({ signal }) => getPost(locationId, postId ?? "", signal),
    enabled: enabled && Boolean(postId),
    refetchInterval: options.refetchMs ?? false,
    retry: false,
  });
}

/** `GET posts` answers at most 100 posts per call. */
export const ALL_POSTS_PAGE_SIZE = 100;
/** Safety cap per list: 10 calls (1,000 posts). Far above what one location writes. */
export const ALL_POSTS_MAX_PAGES = 10;

export type AllPosts = {
  posts: Post[];
  /** What the server counted for this list. */
  total: number;
  /** More than `ALL_POSTS_MAX_PAGES` pages: the oldest may be missing. */
  capped: boolean;
  /** The groups' counts under the same filters without `status` (2026-11-17; older servers leave it out). */
  counts: PostCounts | null;
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
  return {
    posts: [...byId.values()],
    total: first.total,
    capped: first.total > ALL_POSTS_MAX_PAGES * ALL_POSTS_PAGE_SIZE,
    counts: first.counts ?? null,
  };
}

/**
 * Every post of a list, all pages, for an order the server has no sort for: AI Posts' "Coming up" (waiting and
 * scheduled posts as one agenda, a waiting post without a time first). `sort=group` lists every waiting post
 * before the scheduled ones and `sort=scheduled_at` puts posts without a time last, so that segment loads its
 * posts (1 call up to 100, at most 10) and orders them in the browser (`sortAiPosts`). Everything else pages on
 * the server (`usePostsList`).
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

/**
 * The location's photo library (Phase 25c; up to 200 photos, so one call of 100 and a second when needed), e.g.
 * to find the photo an enhanced picture was made from (`source_media_id`) and put it back on the post.
 */
export function useLibraryPhotos(locationId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...postsKey(locationId), "media", "library"],
    queryFn: async ({ signal }) => {
      const first = await getPostMedia(locationId, 1, 100, signal, { library: true });
      if (first.total <= first.media.length) return first.media;
      const second = await getPostMedia(locationId, 2, 100, signal, { library: true });
      return [...first.media, ...second.media];
    },
    enabled,
    retry: false,
  });
}

/**
 * A post's picture as the full photo object (Phase 25c: `kind`, `label`, `source_media_id`), from the location's
 * newest 100 photos outside the library (where the pictures made for posts are). Null when it isn't among them.
 * Used to undo an enhancement: `source_media_id` is the library photo it was made from.
 */
export function useMediaDetails(locationId: string, mediaId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [...postsKey(locationId), "media", "details", mediaId ?? ""],
    queryFn: async ({ signal }) => {
      const list = await getPostMedia(locationId, 1, 100, signal, { library: false });
      return list.media.find((item) => item.media_id === mediaId) ?? null;
    },
    enabled: enabled && Boolean(mediaId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Everything a post change can move: lists, counts, calendar, series, topics; the organization's posts; the token balance. */
export function useInvalidatePosts(locationId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: postsKey(locationId) });
    // The organization calendar and the review queue (`ORGANIZATION_POSTS_KEY` in ai-runs.ts).
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };
}

/** The token balance only (after an AI action that saved nothing). */
export function useInvalidateTokens() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
  };
}

/**
 * Token prices of every AI action (`useAiCosts(locationId)` → `post_draft`, `post_image`, …). Moved to the AI
 * library; re-exported for older imports. Posts' own prices also come with `GET posts/summary` → `ai.token_costs`
 * (`usePostAiState` in `post-ai-state.ts`).
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
/** Longest typed topic `POST posts/ai-draft` accepts. */
export const AI_TOPIC_MAX = 300;
/** Keywords a request may name (post writer v2 uses at most 2 of them). */
export const MAX_DRAFT_KEYWORDS = 3;
/** Keywords post writer v2 actually uses in one post. */
export const USED_DRAFT_KEYWORDS = 2;
/** "Anything to stress or change?" for "Write with AI" and "Change it" (characters). */
export const AI_INSTRUCTIONS_MAX = 500;
/** A picture's description for "Create image" (characters). */
export const PICTURE_HINT_MIN = 3;
export const PICTURE_HINT_MAX = 500;

const UPLOAD_ERRORS: Record<string, string> = {
  media_type: "Use a JPEG or PNG photo.",
  media_too_small: "The photo must be at least 250×250 pixels.",
  media_too_large: "The photo must be 5 MB or smaller, and at most 50 megapixels.",
  media_too_plain: "The photo has too little detail. Try another one.",
  media_unreadable: "The photo couldn't be read. Try another one.",
  media_in_use: "A post that isn't published yet uses this photo.",
};

/** A series history entry's `reason` in words. Moved to `series-planner.ts`; re-exported for older imports. */
export { seriesErrorText } from "./series-planner";

/**
 * Reasons whose words come from the AI library's copy deck (`aiErrorText`), so posts, reviews and
 * keyword ideas say the same thing about AI, tokens and the account. Since 2026-11-17 posts no longer
 * answer `revision_in_progress` (replies still do): a busy post is 409 `generation_in_progress`.
 */
export const AI_ROUTED_REASONS: ReadonlySet<string> = new Set([
  "ai_not_configured",
  "ai_budget_reached",
  "ai_org_budget_reached",
  "ai_failed",
  "insufficient_tokens",
  "subscription_required",
  "organization_suspended",
  "feature_not_included",
  "ai_not_compliant",
  "rate_limited",
  "run_not_queued",
]);

/** True when the AI copy deck has the words for this error (`useToastPostError` toasts it with `toastAiError`). */
export function isAiRoutedError(err: unknown): boolean {
  return isApiError(err) && Boolean(err.reason && AI_ROUTED_REASONS.has(err.reason));
}

/** Developer text a backend message can carry (a setting's name, "server", "API", a validator's quoted field). */
const TECHNICAL_WORDS = /\bserver\b|\bAPI\b|[A-Z]{2,}_[A-Z_]{2,}|^"|https?:\/\/|\binternal\b/i;

/** A backend message the app may show as it is: plain words only, else `fallback`. */
function plainMessage(message: string | null | undefined, fallback: string): string {
  const text = message?.trim();
  return text && !TECHNICAL_WORDS.test(text) ? text : fallback;
}

export type PostErrorTextOptions = {
  /** The viewer's role, to say who approves a post they can't (403 `not_an_approver`). */
  role?: ApproverViewerRole | null;
};

/**
 * Message for a failed posts call, from `data.reason`. `buyTokens` is set when
 * the user should be offered token packs; `reload` when the post changed meanwhile.
 *
 * Pure (it is also called while rendering error states): recording what an error says about AI or
 * the account happens in `useToastPostError`, through `toastAiError`.
 */
export function postErrorText(err: unknown, fallback: string, options: PostErrorTextOptions = {}): { message: string; buyTokens?: boolean; reload?: boolean } {
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
    case "checks_failed":
      // Post writer v2: the AI text still has a hard finding (422, with `findings`).
      return { message: "Some words the AI wrote must change before this post goes out. Edit the highlighted words, then try again." };
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
    case "not_an_approver": {
      // Phase 25c: who approves follows the post's reason (`approval_reason`) and the viewer's role.
      const reason = apiErrorData(err).approval_reason;
      return { message: notApproverText(typeof reason === "string" ? reason : null, options.role), reload: true };
    }
    case "review_expired":
      return { message: "Nobody reviewed this post in time, so it went back to drafts.", reload: true };
    case "too_many_series":
      return { message: "A location can have up to 3 active auto-post series." };
    case "no_slots":
      // "Write the next post now" on a series with no dates left (409).
      return { message: "This series has no dates left to post on. Change its days or end date first." };
    case "series_paused":
      return { message: "This series is paused. Resume it first." };
    case "generation_in_progress":
      return { message: "Another AI action is already working on this. Wait for it to finish, then try again." };
    case "post_not_empty":
      return { message: "This draft already has text. Use Change it to rewrite it.", reload: true };
    case "no_text":
      return { message: "This post has no text yet. Use Write with AI to write it." };
    case "subject_required":
      return { message: "Describe the picture first." };
    case "instructions_declined":
      return { message: "None of these changes can be made to a post. Nothing was spent: change your request and try again." };
    case "topic_not_available":
      return { message: "This topic is being written or was just used. Pick another one." };
    case "topic_not_found":
      return { message: "This topic is gone. Pick another one." };
    case "no_topic":
      return { message: "There's nothing to plan a topic from yet. Type your own topic, or add facts in AI Settings." };
    case "post_not_found":
      return { message: "This post was deleted.", reload: true };
    case "access_removed":
      return { message: "You can no longer change this location's posts." };
    case "location_removed":
      return { message: "This location was removed." };
    case "timed_out":
    case "interrupted":
    case "internal_error":
    case "enqueue_failed":
      return { message: "The AI couldn't finish this. Nothing was spent. Try again." };
    case "invalid_input":
      // The backend's validator words ('"value" must have at least 1 key') are for developers.
      return { message: plainMessage(err.message, "Something in the form isn't valid. Check it, then try again.") };
    case "ends_before_start":
      return { message: "The end date must be after the start date." };
    case "read_only":
      return { message: "Your access is read-only." };
    default:
      // A published post is patched on Google first: 502 carries Google's reason and nothing changed.
      if (err.status === 502) return { message: err.message ? `Google refused the change: ${err.message}` : "Google refused the change. Try again later." };
      return { message: plainMessage(err.message, fallback) };
  }
}
