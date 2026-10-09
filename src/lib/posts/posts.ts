import {
  apiErrorData,
  isApiError,
  type Post,
  type PostCtaType,
  type PostImageStyle,
  type PostIssue,
  type PostSeriesCadence,
  type PostStatus,
  type PostTone,
  type PostType,
} from "@/api";
import { reviewErrorMessage } from "@/lib/reviews/review-errors";
import type { StatusTone } from "@/components/layout/shared/data-display";
import { formatDate, formatDateTime } from "@/lib/datetime";

export const POST_SUMMARY_MAX = 1500;
export const POST_TITLE_MAX = 58;

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  pending_approval: "Waiting for approval",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected by Google",
};

export const POST_STATUS_TONE: Record<PostStatus, StatusTone> = {
  draft: "neutral",
  pending_approval: "warning",
  scheduled: "info",
  publishing: "info",
  published: "success",
  failed: "critical",
  rejected: "critical",
};

export const POST_TYPE_LABEL: Record<PostType, string> = { standard: "Update", event: "Event", offer: "Offer" };

export const POST_CTA_LABEL: Record<PostCtaType, string> = {
  BOOK: "Book",
  ORDER: "Order online",
  SHOP: "Shop",
  LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up",
  CALL: "Call now",
};

/** List tabs: each maps to the `status` filter of `GET posts`. */
export const POST_TABS = [
  { id: "all", label: "All", status: undefined },
  { id: "draft", label: "Drafts", status: "draft" },
  { id: "pending_approval", label: "Waiting for approval", status: "pending_approval" },
  { id: "scheduled", label: "Scheduled", status: "scheduled,publishing" },
  { id: "published", label: "Published", status: "published" },
  { id: "problems", label: "Problems", status: "failed,rejected" },
] as const;

export type PostTabId = (typeof POST_TABS)[number]["id"];

/** "14 Nov 2026, 10:00" for a local post date; time optional. */
export function postDateText(value: { date: string; time?: string | null } | null | undefined) {
  if (!value?.date) return null;
  const date = formatDate(`${value.date}T00:00:00`);
  return value.time ? `${date}, ${value.time}` : date;
}

/** When the post went or goes live, for the list. */
export function postWhenText(post: Post) {
  if (post.published_at) return `Published ${formatDateTime(post.published_at)}`;
  if (post.scheduled_at) return `${post.status === "pending_approval" ? "Planned for" : "Scheduled for"} ${formatDateTime(post.scheduled_at)}`;
  return `Last changed ${formatDateTime(post.updated_at)}`;
}

const ERROR_COPY: Record<string, string> = {
  post_incomplete: "The post isn't complete yet. Fix the items listed and try again.",
  invalid_status: "This post can't do that in its current state. Reload and try again.",
  post_changed: "Someone changed this post meanwhile. Reload to see the latest version.",
  type_change_on_published: "A published post can't change type. Duplicate it instead.",
  refresh_too_soon: "Posts were refreshed recently. You can refresh again in a few minutes.",
  not_an_approver: "You can't approve posts for this location.",
  owner_only: "Only the organization owner can change posting settings.",
  no_client: "Client approval needs this location to belong to a client.",
  gbp_not_connected: "Connect this location's Google Business Profile to publish posts.",
  v4_access_pending: "Posting is waiting for Google to grant API access.",
  reconnect_required: "Google access for this location needs to be restored. Reconnect Google on the Locations page.",
  media_type: "Use a JPEG or PNG photo.",
  media_too_small: "The photo must be at least 250 × 250 pixels.",
  media_too_large: "The photo must be 5 MB or smaller.",
  media_too_plain: "The photo has too little detail. Choose a different one.",
  media_unreadable: "That file couldn't be read as a photo.",
  invalid_upload: "That file couldn't be uploaded.",
  media_in_use: "This photo is used by a post that isn't published yet.",
  read_only: "Your access is read-only, so you can't change posts.",
  too_many_series: "A location can have at most 3 active auto-post series. Pause or delete one first.",
  ends_before_start: "The end date must be after the start date.",
};

/** AI errors share their copy with the review AI. */
const AI_REASONS = new Set(["insufficient_tokens", "ai_not_configured", "ai_budget_reached", "ai_failed"]);

/** A customer-facing message for a posts API error. */
export function postErrorMessage(err: unknown, fallback: string) {
  if (!isApiError(err)) return fallback;
  if (err.reason && AI_REASONS.has(err.reason)) return reviewErrorMessage(err, fallback).message;
  if (err.reason && ERROR_COPY[err.reason]) return ERROR_COPY[err.reason]!;
  if (err.status === 502) return err.message || "Google refused the change. Try again later.";
  return err.message || fallback;
}

/** The `issues` list of a 422 `post_incomplete`. */
export function postErrorIssues(err: unknown): PostIssue[] {
  const issues = apiErrorData(err).issues;
  return Array.isArray(issues) ? (issues as PostIssue[]) : [];
}

/** What a post's `error.code` means for the customer. */
export const POST_FAILURE_COPY: Record<string, string> = {
  google_unavailable: "Google didn't answer. Retry in a few minutes.",
  google_rejected: "Google's review rejected this post. Edit it and publish again.",
  reconnect_required: "Google access needs to be restored before this post can publish.",
  gbp_not_connected: "The Business Profile isn't connected.",
  gbp_unbound: "The Business Profile was unbound from this location.",
  v4_access_pending: "Waiting for Google to grant posting access.",
  media_url_not_public: "Google couldn't fetch the photo.",
  media_unreachable: "Google couldn't fetch the photo.",
  media_missing: "The photo is missing. Upload it again.",
  publish_interrupted: "Publishing was interrupted. Retry.",
  location_removed: "The location was removed.",
  post_incomplete: "The post isn't complete.",
};

export const POST_TONE_LABEL: Record<PostTone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  enthusiastic: "Enthusiastic",
  informative: "Informative",
};

export const POST_IMAGE_STYLE_LABEL: Record<PostImageStyle, string> = {
  photo_scene: "Realistic photo",
  lifestyle_photo: "Lifestyle photo",
  detail_photo: "Close-up photo",
  flat_illustration: "Flat illustration",
  render_3d: "3D render",
  watercolor: "Watercolour",
  photo_wide: "Wide photo",
};

export const WEEKDAY_NAMES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

const dayName = (day: string) => day.charAt(0) + day.slice(1).toLowerCase();

/** "Every Monday and Thursday", "Every 3 days", "Monthly on day 5". */
export function cadenceText(cadence: PostSeriesCadence) {
  if (cadence.kind === "weekly") {
    const days = cadence.days_of_week.map(dayName);
    if (days.length === 0) return "Weekly";
    return `Every ${days.length > 1 ? `${days.slice(0, -1).join(", ")} and ${days.at(-1)}` : days[0]}`;
  }
  if (cadence.kind === "every_n_days") return cadence.n === 1 ? "Every day" : `Every ${cadence.n} days`;
  return `Monthly on day ${cadence.day_of_month}`;
}

/** Why an auto-post slot failed. */
export const SERIES_FAILURE_COPY: Record<string, string> = {
  insufficient_tokens: "Not enough tokens",
  ai_not_configured: "AI isn't set up on the server",
  ai_budget_reached: "Today's AI limit was reached",
  ai_failed: "The AI didn't answer",
  gbp_not_connected: "The Business Profile isn't connected",
  image_failed: "The image failed, so the post went out text-only",
};

/** True when the error means the AI buttons should be hidden for now. */
export function isAiUnavailable(err: unknown) {
  return isApiError(err) && err.reason === "ai_not_configured";
}

/** True when the error should offer token packs. */
export function needsTokens(err: unknown) {
  return isApiError(err) && err.reason === "insufficient_tokens";
}
