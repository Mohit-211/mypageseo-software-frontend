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
 * - 2026-11-17 (G3): a draft saved or changed while the review has a reply on Google is an update
 *   (`draft.replaces_reply`); one written before that reply is "left behind" (sending it answers 409
 *   `draft_predates_reply`: save it again or delete it). A failed update keeps `sent` / `pending` and shows
 *   `send_error` + `send_error_code`, which go with the draft.
 */
import type { DraftCheck, GoogleReply, Review, ReviewDraft, SendErrorCode } from "@/api";
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

/** The review has a reply on Google (published, or waiting for Google's review). */
export function hasLiveReply(review: Pick<Review, "reply_state">): boolean {
  return review.reply_state === "sent" || review.reply_state === "pending";
}

/** The draft updates the reply on Google ("Replaces the reply on Google"): it is sent on its own, never in a send of several. */
export function isReplyUpdate(review: Pick<Review, "draft" | "reply_state">): boolean {
  return Boolean(review.draft?.replaces_reply) && hasLiveReply(review);
}

/**
 * The draft was written before the reply now on Google ("Written before the reply on Google"): `replaces_reply`
 * is false while the review has a reply there. Sending it as it is answers 409 `draft_predates_reply`; saving it
 * again makes it an update.
 */
export function isLeftBehind(review: Pick<Review, "draft" | "reply_state">): boolean {
  return Boolean(review.draft?.text) && review.draft?.replaces_reply !== true && hasLiveReply(review);
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
    send_error_code: null,
    sent_via: "user",
    // A person sent it: an automatic reply waiting for this review stops (the list, read again, says how).
    auto: review.auto && review.auto.state !== "sent" ? null : (review.auto ?? null),
    draft: null,
    ai_reply_eligible: false,
    ai_reply_skip_reason: "already_replied",
  };
}

/** An automatic reply that was waiting (held, scheduled, being written) stops once a person deletes or changes the draft. */
function autoTakenOver(auto: Review["auto"]): Review["auto"] {
  if (!auto || auto.state === "sent" || auto.state === "cancelled") return auto ?? null;
  return { ...auto, state: "cancelled", reasons: [], labels: [], scheduled_for: null };
}

/**
 * The review after its draft was deleted (`DELETE …/draft` answers `{ deleted, review_id }`, not the review): a
 * live reply stays as it is, else the review is `rejected` again (Google rejected its reply) or `none`. The error of
 * a failed send goes with the draft (2026-11-17, G3).
 */
export function withoutDraft(review: Review): Review {
  const base = { ...review, draft: null, send_error: null, send_error_code: null, auto: autoTakenOver(review.auto) };
  if (hasLiveReply(review)) return base;
  const resting = review.reply && review.reply_moderation?.state === "rejected" ? "rejected" : "none";
  return { ...base, reply_state: resting };
}

/**
 * A send Google didn't take: the draft is kept with the error and its kind (`send_error`, `send_error_code`),
 * until the list is read again. A failed update keeps `sent` / `pending`: the reply is still on Google (2026-11-17).
 */
export function asFailedSend(review: Review, error: string | null, code: SendErrorCode | null = null): Review {
  return { ...review, reply_state: hasLiveReply(review) ? review.reply_state : "failed", send_error: error, send_error_code: code };
}

/**
 * The review after a send found a reply on Google the app didn't show (409 `reply_changed_on_google`, or
 * `draft_predates_reply`) and the answer didn't carry the review: Google's reply is stored as sent, and the draft
 * is kept, left behind (it was written before that reply: saving it again makes it an update).
 */
export function withGoogleReply(review: Review, googleReply: GoogleReply | null): Review {
  if (!googleReply) return review;
  return {
    ...review,
    reply: { comment: googleReply.comment, update_time: googleReply.update_time },
    reply_state: "sent",
    reply_moderation: null,
    draft: review.draft ? { ...review.draft, replaces_reply: false } : null,
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
    sent_via: null,
    reply_moderation: null,
    // With no reply on Google, a draft waiting is a plain draft again (2026-11-17, G1).
    draft: review.draft ? { ...review.draft, replaces_reply: false } : null,
    ai_reply_eligible: skip === null,
    ai_reply_skip_reason: skip,
  };
}

/** Nothing left to do on the review: its reply is on Google with no draft over it, or it's gone from Google. */
export function replySettled(review: Review): boolean {
  if (review.deleted_on_google_at) return true;
  return (review.reply_state === "sent" || review.reply_state === "pending") && !review.draft;
}

/* -------------------------------------------------------------------------- */
/* Replies v3 (Phase 25b): the judge's score of the AI's text                   */
/* -------------------------------------------------------------------------- */

/** The judge's criteria (backend `replyRubric.ts`, rubrics `reply@2` and `reply_restricted@2`), in plain words. */
export const QUALITY_CRITERION_LABEL: Record<string, string> = {
  specific: "Answers what they said",
  personal: "Personal and warm",
  human: "Sounds like a person",
  detail: "Useful detail",
  service: "Names the service",
  tone: "Fits the rating",
  accuracy: "Facts check out",
  policy: "Within Google's rules",
  privacy: "Keeps privacy",
  practice: "About your practice",
  request: "Makes your change",
};

export type QualityNote = { key: string; label: string; score: number; note: string };

export type QualityView = {
  /** 1–5. */
  score: number;
  /** "4.4". */
  display: string;
  /** The score is of the AI's text before its targeted edit (`scored_text: "candidate"`). */
  beforeEdit: boolean;
  /** The text shown isn't the AI's any more (edited by a person): the score still describes the AI's text. */
  ofAiText: boolean;
  /** At least 4 of 5: the judge's pass mark. */
  good: boolean;
  /** The notes of the criteria scored under 4, lowest first. */
  notes: QualityNote[];
};

const humanKey = (key: string) => {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Other";
};

/**
 * What the draft's `quality` says, or null when there is nothing to show: a draft the user wrote, one made before
 * Phase 25b, or one no judge read (`score` null, more often under load).
 */
export function qualityView(draft: Pick<ReviewDraft, "quality" | "edited" | "source"> | null | undefined): QualityView | null {
  const quality = draft?.quality;
  const score = quality?.score;
  if (!quality || typeof score !== "number" || !Number.isFinite(score)) return null;
  const notes = (quality.criteria ?? [])
    .filter((criterion) => typeof criterion.score === "number" && criterion.score < 4 && Boolean(criterion.note?.trim()))
    .sort((a, b) => a.score - b.score)
    .map((criterion) => ({
      key: criterion.key,
      label: QUALITY_CRITERION_LABEL[criterion.key] ?? humanKey(criterion.key),
      score: criterion.score,
      note: criterion.note?.trim() ?? "",
    }));
  return {
    score,
    display: (Math.round(score * 10) / 10).toFixed(1),
    beforeEdit: quality.scored_text === "candidate",
    ofAiText: Boolean(draft?.edited) || draft?.source === "user",
    good: score >= 4,
    notes,
  };
}

const DAY_MS = 86_400_000;

/** "3 days ago" within a week (when `now` is known), otherwise "Oct 2, 2026". */
export function whenLabel(iso: string | null | undefined, now: number | undefined): string {
  if (!iso) return "";
  const time = Date.parse(iso);
  if (now !== undefined && Number.isFinite(time) && now - time < 7 * DAY_MS) return formatRelative(iso, now);
  return formatDate(iso, "");
}
