/**
 * Plain words for why a post waits, why an automatic post is held, what a series did, and why a post failed
 * (Phase 25c and the 2026-11-17 follow-ups). One list for the post card, the review queue, the series cards and
 * the Posts page, so they all say the same thing. Sentence case, no "server", colour never alone (each label
 * comes with a tone the caller turns into an icon and a colour).
 *
 * - `approvalReasonLabel(post.approval?.reason)`: why it waits (`team`, `client`, `ai_review`, `needs_review`), in
 *   words for anyone who reads it (an approver, a member, a client user);
 * - `waitsForText(reason, role)` / `notApproverText(reason, role)`: who approves a post the viewer can't approve;
 * - `heldLabel(code)` / `heldLabels(post.approval?.held)`: why an automatic series post waits for a person;
 * - `seriesOutcomeLabel(entry.outcome)`: a series history entry, and Generate next's `not_handed_over`;
 * - `seriesPauseLabel(series.paused?.reason)`: why a series paused itself;
 * - `autoPublishSwitchText(series.auto_publish?.switch)`: "Automatic publishing isn't switched on yet" (or null when on);
 * - `postErrorWords(post.error)` / `postProblemWords(post)`: a failed or rejected post's problem and what to offer.
 *
 * `auto_cap_week` and `auto_cap_spacing` are gone since 2026-11-17: there is no "at most 3 a week" any more.
 */
import type { AiFeatureState, Post, PostApprovalReason, SeriesHistoryOutcome, SeriesHold, SeriesNextOutcome, SeriesPauseReason } from "@/api";

/** How a label should look: `critical` (red), `warning` (amber), `ai` (violet), `info` / `neutral` (muted). */
export type LabelTone = "critical" | "warning" | "ai" | "info" | "neutral";

export type Label = { text: string; tone: LabelTone };

/* -------------------------------------------------------------------------- */
/* Why a post waits                                                             */
/* -------------------------------------------------------------------------- */

/** Why it waits, for whoever reads it: never addressed to the approver ("before you approve it"), as a member or a client user may read it. */
export const APPROVAL_REASON_LABEL: Readonly<Record<PostApprovalReason, Label>> = {
  team: { text: "Waiting for the owner's approval", tone: "warning" },
  client: { text: "Waiting for the client's approval", tone: "warning" },
  ai_review: { text: "Written by AI: waiting for a person to review it", tone: "ai" },
  needs_review: { text: "Flagged by our checks: a person must read it closely before it goes out", tone: "warning" },
};

/** Why a post waits for approval, or null (no reason recorded: an approval from before Phase 25c). */
export function approvalReasonLabel(reason: PostApprovalReason | string | null | undefined): Label | null {
  return reason && Object.hasOwn(APPROVAL_REASON_LABEL, reason) ? APPROVAL_REASON_LABEL[reason as PostApprovalReason] : null;
}

export type ApproverViewerRole = "owner" | "member" | "client_user";

/**
 * Who approves a post the viewer can't approve (`can_approve: false`), from the viewer's role and why it waits
 * (`approval.reason`). The backend's approvers (`approverFor`): client mode, the client's user or the owner on its
 * behalf; team mode, the owner; approvals off, the owner or a member for an AI reason and nobody for another (a post
 * left waiting when approvals were switched off: schedule it again). So a client user waits for its agency, a member
 * for the owner (or the client), and an owner only for a post approvals-off left behind (null: nobody approves it).
 */
function approverOf(reason: string | null | undefined, role: ApproverViewerRole): string | null {
  if (role === "client_user") return "your agency";
  if (role === "owner") return null;
  return reason === "client" ? "your client (or the account owner on their behalf)" : "the account owner";
}

/** The line under a post the viewer can't approve: "The account owner approves this post." */
export function waitsForText(reason: string | null | undefined, role: ApproverViewerRole): string {
  const who = approverOf(reason, role);
  if (!who) return "Approvals are off at this location now, so it can't be approved. Open it and schedule it again.";
  return `${who.charAt(0).toUpperCase()}${who.slice(1)} approves this post.`;
}

/**
 * A 403 `not_an_approver` (`approval_reason`) in words: "You can't approve this post: the account owner approves
 * it." Without a role (outside React), who approves stays unnamed.
 */
export function notApproverText(reason: string | null | undefined, role: ApproverViewerRole | null | undefined): string {
  if (!role) return "You can't approve this post: someone else approves it.";
  const who = approverOf(reason, role);
  if (!who) return "This post can't be approved: approvals are off at this location now. Open it and schedule it again.";
  return `You can't approve this post: ${who} approves it.`;
}

/* -------------------------------------------------------------------------- */
/* Why an automatic series post is held                                         */
/* -------------------------------------------------------------------------- */

export const HELD_LABEL: Readonly<Record<SeriesHold, Label>> = {
  checks: { text: "Our checks flagged something in the text", tone: "warning" },
  auto_publish_off: { text: "Automatic publishing isn't switched on yet", tone: "neutral" },
  regulated_review_only: { text: "Posts for this kind of business always need a person's review", tone: "neutral" },
  client_consent_required: { text: "Waiting for the client to approve automatic posts", tone: "warning" },
  first_posts_review: { text: "One of the series' first posts: a person reviews it", tone: "info" },
  image_unavailable: { text: "No picture could be made for it", tone: "warning" },
  series_paused: { text: "Its series is paused", tone: "neutral" },
};

/** One hold in words; an unknown code says it waits for a person. */
export function heldLabel(code: SeriesHold | string): Label {
  return Object.hasOwn(HELD_LABEL, code) ? HELD_LABEL[code as SeriesHold] : { text: "Waiting for a person to review it", tone: "neutral" };
}

/** Every hold of a post (`approval.held`), in the order sent. */
export function heldLabels(held: readonly (SeriesHold | string)[] | null | undefined): Label[] {
  return (held ?? []).map(heldLabel);
}

/* -------------------------------------------------------------------------- */
/* What a series did                                                            */
/* -------------------------------------------------------------------------- */

export const SERIES_OUTCOME_LABEL: Readonly<Record<SeriesHistoryOutcome | SeriesNextOutcome, Label>> = {
  generated: { text: "Written", tone: "info" },
  held: { text: "Waiting for review", tone: "warning" },
  failed: { text: "Not written", tone: "critical" },
  expired: { text: "Not reviewed in time: back to drafts", tone: "warning" },
  paused_unreviewed: { text: "Paused: 2 posts in a row weren't reviewed in time", tone: "warning" },
  paused_needs_review: { text: "Paused: our checks held 2 posts in a row", tone: "warning" },
  paused_rejected: { text: "Paused: Google rejected one of its posts", tone: "critical" },
  // Generate next's run result (not a history entry): written, but it stayed a draft for a person to decide.
  not_handed_over: { text: "Written, but kept as a draft for you to check", tone: "warning" },
};

/** A history entry's or Generate next's outcome in words; null for an unknown one. */
export function seriesOutcomeLabel(outcome: SeriesHistoryOutcome | SeriesNextOutcome | string | null | undefined): Label | null {
  return outcome && Object.hasOwn(SERIES_OUTCOME_LABEL, outcome) ? SERIES_OUTCOME_LABEL[outcome as SeriesHistoryOutcome | SeriesNextOutcome] : null;
}

export const SERIES_PAUSE_LABEL: Readonly<Record<SeriesPauseReason, Label>> = {
  unreviewed: { text: "Paused because 2 posts in a row weren't reviewed in time", tone: "warning" },
  needs_review: { text: "Paused because our checks held 2 posts in a row", tone: "warning" },
  google_rejected: { text: "Paused because Google rejected one of its posts", tone: "critical" },
};

/** Why a series paused itself (`series.paused.reason`), or null. Resuming the series clears it. */
export function seriesPauseLabel(reason: SeriesPauseReason | string | null | undefined): Label | null {
  return reason && Object.hasOwn(SERIES_PAUSE_LABEL, reason) ? SERIES_PAUSE_LABEL[reason as SeriesPauseReason] : null;
}

/** The text for `auto_publish.switch` when automatic publishing can't run yet; null when it is `on`. */
export function autoPublishSwitchText(state: AiFeatureState | string | null | undefined): string | null {
  return state === "on" ? null : "Automatic publishing isn't switched on yet";
}

/* -------------------------------------------------------------------------- */
/* Why a post failed                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What to offer next to a problem: `reconnect` (Reconnect Google), `retry` (Retry, now or later), `edit` (change
 * the post), `billing` (fix billing, then retry), `support` (contact support), or null.
 */
export type PostProblemAction = "reconnect" | "retry" | "edit" | "billing" | "support" | null;

export type PostProblemWords = { text: string; action: PostProblemAction };

const PUBLISH_FAILED: PostProblemWords = { text: "The post couldn't be published. Retry.", action: "retry" };

/**
 * Every code a failed post (or one sent back to drafts) can carry, in the app's words. The stored `message` is the
 * backend's own text, written for its logs (it can name settings such as `MEDIA_PUBLIC_BASE_URL`, "the API" or "this
 * server"), so it is never shown, except Google's own words for `google_rejected_request`.
 */
const POST_ERROR_WORDS: Readonly<Record<string, PostProblemWords>> = {
  reconnect_required: { text: "Google access needs to be restored. Reconnect Google, then retry.", action: "reconnect" },
  gbp_not_connected: { text: "This location isn't connected to its Business Profile. Connect Google, then retry.", action: "reconnect" },
  gbp_unbound: { text: "The Business Profile was unlinked from this location. Connect it again, then retry.", action: "reconnect" },
  v4_access_pending: { text: "Google hasn't granted posting access to this profile yet. Retry once it has.", action: null },
  google_unavailable: { text: "Google didn't answer or is busy. Retry in a few minutes.", action: "retry" },
  google_rejected: { text: "Google rejected this post. Edit it and publish it again.", action: "edit" },
  not_configured: { text: "Posting to Google isn't switched on for your account yet. Contact support.", action: "support" },
  media_url_not_public: { text: "Google couldn't load the photo. Retry later, or remove the photo to publish now.", action: "retry" },
  media_unreachable: { text: "Google couldn't load the photo. Retry, or choose another photo.", action: "retry" },
  media_missing: { text: "The post's photo was deleted. Choose another one, then publish again.", action: "edit" },
  publish_interrupted: { text: "Publishing was interrupted. Check the profile on Google, then retry.", action: "retry" },
  post_incomplete: { text: "The post isn't complete. Edit it, then publish it again.", action: "edit" },
  checks_failed: { text: "Some words the AI wrote must change before it goes out. Edit them, then retry.", action: "edit" },
  location_removed: { text: "The location was removed.", action: null },
  organization_suspended: { text: "Your account is suspended, so the post couldn't go out. Contact support, then retry.", action: "support" },
  subscription_required: { text: "Your subscription needs attention. Fix billing, then retry.", action: "billing" },
  feature_not_included: { text: "Your plan doesn't include posts. Change your plan, then retry.", action: "billing" },
  review_expired: { text: "Nobody reviewed it in time, so it went back to drafts.", action: "edit" },
  series_changed: { text: "Its series was changed, so it went back to drafts.", action: "edit" },
  // Generate next: written, then interrupted before it was handed over (it stayed a draft).
  interrupted: { text: "It was interrupted before it was handed over. Check it, then schedule it.", action: "edit" },
  publish_failed: PUBLISH_FAILED,
};

/**
 * A failed or rejected post's `error` in words, with what to offer. `google_rejected_request` shows Google's own
 * words; an unknown code says the post couldn't be published (never the stored message: see `POST_ERROR_WORDS`).
 */
export function postErrorWords(error: { code: string; message?: string | null } | null | undefined): PostProblemWords | null {
  if (!error) return null;
  if (error.code === "google_rejected_request") {
    const message = error.message?.trim();
    return { text: message ? `Google refused the post: ${message}` : "Google refused the post.", action: "edit" };
  }
  return (Object.hasOwn(POST_ERROR_WORDS, error.code) ? POST_ERROR_WORDS[error.code] : undefined) ?? PUBLISH_FAILED;
}

/**
 * A post's problem: its error's words, or "Google rejected this post." for a rejected post without an error (one
 * imported already rejected, or rejected before 2026-11-17). Null for a post without a problem.
 */
export function postProblemWords(post: Pick<Post, "status" | "error">): PostProblemWords | null {
  if (post.error) return postErrorWords(post.error);
  if (post.status === "rejected") return { text: "Google rejected this post.", action: "edit" };
  if (post.status === "failed") return PUBLISH_FAILED;
  return null;
}
