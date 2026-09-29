import { withDemoFallback } from "../mypageseo/demo/demo-mode";
import { demoGbpPosts } from "../mypageseo/demo/posts";

export type GbpPostsStatus = "loading" | "ready" | "no_posts" | "disconnected" | "error";

export type PostLifecycle = "draft" | "scheduled" | "published" | "failed" | "unknown";

export type GbpPostType = "update" | "offer" | "event";

export type GbpPost = {
  id: string;
  title: string | null;
  summary: string | null;
  type: GbpPostType | null;
  status: PostLifecycle;
  /** Human readable scheduled or publication date supplied by the backend. */
  date: string | null;
  /** ISO timestamp used for calendar placement and sorting. */
  timestamp: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  mediaUrl: string | null;
  /** Failure reason returned by the backend for failed publications. */
  failureReason: string | null;
  sourceUrl: string | null;
};

export type GbpPostsCapabilities = {
  canCreate: boolean;
  canEdit: boolean;
  canSchedule: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canRetry: boolean;
  canGenerateDraft: boolean;
  canUploadMedia: boolean;
  canSearch: boolean;
  /** Post types the current backend integration can actually submit. */
  supportedTypes: GbpPostType[];
  /** CTA options the current backend integration can actually submit. */
  ctaOptions: { value: string; label: string }[];
};

export type GbpPostsData = {
  status: GbpPostsStatus;
  lastCheckedAt: string | null;
  posts: GbpPost[];
  capabilities: GbpPostsCapabilities;
};

/**
 * The live Google Business Profile posting source is not connected in this
 * frontend yet, so this adapter falls back to a deterministic demo post
 * list with realistic write capabilities enabled.
 */
export function getGbpPosts(
  locationId?: string | null,
  real?: GbpPostsData | null,
): GbpPostsData {
  return withDemoFallback(real, () => demoGbpPosts(locationId));
}

export const POST_TYPE_LABEL: Record<GbpPostType, string> = {
  update: "Update",
  offer: "Offer",
  event: "Event",
};

export const POST_STATUS_LABEL: Record<PostLifecycle, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  unknown: "Status unavailable",
};

export const POSTS_PAGE_SIZE = 20;
