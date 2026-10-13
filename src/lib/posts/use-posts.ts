import { useSyncExternalStore } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiErrorData,
  getPostMedia,
  getPostSeries,
  getPosts,
  getPostsCalendar,
  getPostsSummary,
  isApiError,
  type CtaType,
  type PostStatus,
  type PostsQuery,
  type PostTone,
  type AiImageStyle,
  type Weekday,
} from "@/api";
import { useBilling } from "@/lib/billing/use-billing";

export const postsKey = (locationId: string) => ["locations", locationId, "posts"] as const;

export function usePostsSummary(locationId: string) {
  return useQuery({ queryKey: [...postsKey(locationId), "summary"], queryFn: ({ signal }) => getPostsSummary(locationId, signal), retry: false });
}

export function usePostsList(locationId: string, query: PostsQuery) {
  return useQuery({ queryKey: [...postsKey(locationId), "list", query], queryFn: ({ signal }) => getPosts(locationId, query, signal), retry: false });
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

/** Token cost of each AI post action, from `GET billing` → `tokens.ai_costs` (defaults 1 and 3). */
export function useAiCosts() {
  const billing = useBilling();
  const costs = billing.data?.tokens.ai_costs ?? {};
  return { draft: costs.post_draft ?? 1, image: costs.post_image ?? 3, topics: costs.post_topics ?? 1 };
}

export const tokens = (count: number) => `${count} token${count === 1 ? "" : "s"}`;

/** The tabs of the Posts page and the statuses each lists. */
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

export const STATUS_TONE: Record<PostStatus, "neutral" | "info" | "success" | "warning" | "critical" | "brand"> = {
  draft: "neutral",
  pending_approval: "warning",
  scheduled: "info",
  publishing: "info",
  published: "success",
  failed: "critical",
  rejected: "critical",
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
  ai_not_configured: "AI isn't set up yet",
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
  media_url_not_public: "Google couldn't fetch the photo (this server isn't reachable from Google).",
  media_unreachable: "Google couldn't fetch the photo. Retry, or choose another photo.",
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

/*
 * AI availability: after a 503 `ai_not_configured` the AI buttons are hidden for the rest of
 * the session (the note: "hide the AI buttons"), rather than failing on every click.
 */
let aiUnavailable = false;
const aiListeners = new Set<() => void>();

function markAiUnavailable() {
  if (aiUnavailable) return;
  aiUnavailable = true;
  for (const listener of aiListeners) listener();
}

/** False once the server said AI isn't set up. */
export function useAiAvailable(): boolean {
  return !useSyncExternalStore(
    (listener) => {
      aiListeners.add(listener);
      return () => aiListeners.delete(listener);
    },
    () => aiUnavailable,
  );
}

/**
 * Message for a failed posts call, from `data.reason`. `buyTokens` is set when
 * the user should be offered token packs; `reload` when the post changed meanwhile.
 */
export function postErrorText(err: unknown, fallback: string): { message: string; buyTokens?: boolean; reload?: boolean } {
  if (!isApiError(err)) return { message: fallback };
  if (err.reason === "ai_not_configured") markAiUnavailable();
  const data = apiErrorData(err);
  const reason = err.reason ?? "";
  if (UPLOAD_ERRORS[reason]) return { message: UPLOAD_ERRORS[reason] };
  switch (reason) {
    case "insufficient_tokens":
      return { message: `Not enough tokens: this costs ${String(data.cost ?? "?")}, your balance is ${String(data.balance ?? "?")}.`, buyTokens: true };
    case "ai_not_configured":
      return { message: "AI isn't available yet, so the AI buttons are hidden." };
    case "ai_budget_reached":
      return { message: "AI is paused for today. Try again tomorrow." };
    case "ai_failed":
      return { message: "The AI didn't answer. Nothing was charged; try again." };
    case "post_incomplete":
      return { message: "The post isn't complete yet. Fix the highlighted fields first." };
    case "invalid_status":
    case "post_changed":
      return { message: "This post changed in the meantime. It has been reloaded.", reload: true };
    case "type_change_on_published":
      return { message: "A published post's type can't change. Duplicate it instead." };
    case "refresh_too_soon":
      return { message: "Posts were refreshed a moment ago. Try again in a few minutes." };
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
    case "subscription_required":
      return { message: "Your account is read-only until you subscribe." };
    default:
      // A published post is patched on Google first: 502 carries Google's reason and nothing changed.
      if (err.status === 502) return { message: err.message ? `Google refused the change: ${err.message}` : "Google refused the change. Try again later." };
      return { message: err.message || fallback };
  }
}
