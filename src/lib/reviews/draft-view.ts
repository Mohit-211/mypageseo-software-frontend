/**
 * Replies v2 on the review card (Phase 25a), as pure functions: which findings to show on a draft, what
 * the review looks like right after a send or a deleted draft (until the list is read again), and
 * whether "Change it" can run.
 *
 * Backend rules these mirror (docs/API.md "Reviews and AI (Phase 18)"):
 * - saving a draft keeps `reply_state` when the reply on Google is live (`sent`, `pending`); a draft is
 *   then shown under the reply it would replace;
 * - deleting a draft leaves a live reply as it is, else shows `rejected` again (a rejected reply is
 *   kept with Google's reason) or `none`;
 * - a send stores the text as the reply, clears the draft and waits for Google (`pending`);
 * - "Change it" refuses reviews AI can't reply to (`flagged`, `no_rating`, `deleted_on_google`), but
 *   not `already_replied` (a draft over a live reply).
 */
import type { DraftCheck, GoogleReply, Review } from "@/api";
import { formatDate, formatRelative } from "@/lib/datetime";
import { sortChecks } from "./reply-checks";

/** A finding shown on a draft: one of `draft.checks`, or one a send found on the same text (`atSend`). */
export type DisplayCheck = DraftCheck & { atSend?: boolean };

const findingKey = (check: DraftCheck) => [check.rule, check.kind, check.severity, check.span?.start ?? "", check.span?.end ?? ""].join("|");

/**
 * The draft's own checks plus the findings a send answered with for the same text (422 `checks_failed`,
 * 409 `confirm_warnings_required`), each listed once, most serious first. Findings only the send found
 * (moderation of an edited text, a copy of a reply sent since) are marked `atSend`.
 */
export function mergeSendFindings(checks: readonly DraftCheck[] | null | undefined, found: readonly DraftCheck[] | null | undefined): DisplayCheck[] {
  const seen = new Set((checks ?? []).map(findingKey));
  const extra: DisplayCheck[] = [];
  for (const check of found ?? []) {
    const key = findingKey(check);
    if (seen.has(key)) continue;
    seen.add(key);
    extra.push({ ...check, atSend: true });
  }
  return sortChecks([...(checks ?? []), ...extra]) as DisplayCheck[];
}

/** True when any finding is `hard`: such a text is never sent. */
export function hasHardFinding(checks: readonly DraftCheck[] | null | undefined): boolean {
  return (checks ?? []).some((check) => check.severity === "hard");
}

/** The reply text on a review (the API sends an object; very old rows a string). */
export function replyTextOf(reply: Review["reply"]): string | null {
  if (!reply) return null;
  return typeof reply === "string" ? reply : reply.comment;
}

/** Google rejected the last reply we sent (also true for a new draft over it: `reply_moderation` keeps the reason). */
export function lastReplyRejected(review: Review): boolean {
  return review.reply_state === "rejected" || review.reply_moderation?.state === "rejected";
}

/** The reply people can see on Google (`sent`) or soon will (`pending`); null when there's none or Google rejected it. */
export function publicReplyText(review: Review): string | null {
  return lastReplyRejected(review) ? null : replyTextOf(review.reply);
}

/** The reply Google rejected (not public), with Google's reason, or null. */
export function rejectedReply(review: Review): { text: string | null; reason: string | null; checkedAt: string | null } | null {
  if (!lastReplyRejected(review)) return null;
  const moderation = review.reply_moderation ?? null;
  return { text: replyTextOf(review.reply), reason: moderation?.reason?.trim() || null, checkedAt: moderation?.checked_at ?? null };
}

/** Skip reasons for which the AI rewrites nothing (`POST …/draft/revise` answers 400 `not_eligible` / `deleted_on_google`). */
const NO_AI_REWRITE = new Set(["flagged", "suspicious", "no_rating", "deleted_on_google"]);

/** "Change it" applies: there's a draft, the review is still on Google and AI may write a reply to it. */
export function canReviseDraft(review: Review): boolean {
  return Boolean(review.draft?.text?.trim()) && !review.deleted_on_google_at && !NO_AI_REWRITE.has(review.ai_reply_skip_reason ?? "");
}

/**
 * The review right after a successful send, until the list is read again: the text is on Google,
 * waiting for its review. `at` defaults to now (call it from an event handler, never during render).
 */
export function asSentReview(review: Review, text: string, at: string = new Date().toISOString()): Review {
  return {
    ...review,
    reply: { comment: text, update_time: at },
    reply_state: "pending",
    reply_moderation: { state: "pending", reason: null, checked_at: null },
    sent_at: at,
    send_error: null,
    draft: null,
    ai_reply_eligible: false,
    ai_reply_skip_reason: "already_replied",
  };
}

/** The review after its draft was deleted (`DELETE …/draft` answers `{ deleted, review_id }`, not the review). */
export function withoutDraft(review: Review): Review {
  const live = review.reply_state === "sent" || review.reply_state === "pending";
  if (live) return { ...review, draft: null };
  const resting = review.reply && review.reply_moderation?.state === "rejected" ? "rejected" : "none";
  return { ...review, draft: null, reply_state: resting, send_error: null };
}

/** A send Google didn't take: the draft is kept with the error (backend `sendFailed`), until the list is read again. */
export function asFailedSend(review: Review, error: string | null): Review {
  return { ...review, reply_state: "failed", send_error: error };
}

/**
 * The review after a send found a reply on Google the app didn't show (409 `reply_changed_on_google`)
 * and the answer didn't carry the review: Google's reply is stored as sent, the draft is kept.
 */
export function withGoogleReply(review: Review, googleReply: GoogleReply | null): Review {
  if (!googleReply) return review;
  return {
    ...review,
    reply: { comment: googleReply.comment, update_time: googleReply.update_time },
    reply_state: "sent",
    reply_moderation: null,
    ai_reply_eligible: false,
    ai_reply_skip_reason: review.deleted_on_google_at ? "deleted_on_google" : review.rating === null ? "no_rating" : "already_replied",
  };
}

/**
 * The review after its reply was removed from Google (`DELETE …/reply` answers `{ deleted, review_id }`):
 * no reply, a draft still waiting if there is one, and AI may draft again (backend `replyDraftEligibility`).
 */
export function withoutReply(review: Review): Review {
  const skip = review.deleted_on_google_at ? "deleted_on_google" : review.rating === null ? "no_rating" : review.flag_level === "suspicious" ? "flagged" : null;
  return {
    ...review,
    reply: null,
    reply_state: review.draft ? "draft" : "none",
    sent_at: null,
    reply_moderation: null,
    ai_reply_eligible: skip === null,
    ai_reply_skip_reason: skip,
  };
}

/** Nothing left to do on the review: its reply is on Google with no draft over it, or it's gone from Google. */
export function replySettled(review: Review): boolean {
  if (review.deleted_on_google_at) return true;
  return (review.reply_state === "sent" || review.reply_state === "pending") && !review.draft;
}

const DAY_MS = 86_400_000;

/** "3 days ago" within a week (when `now` is known), otherwise "Oct 2, 2026". */
export function whenLabel(iso: string | null | undefined, now: number | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (now !== undefined && Number.isFinite(time) && now - time < 7 * DAY_MS) return formatRelative(iso, now);
  return formatDate(iso, "");
}
