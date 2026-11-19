/**
 * Sending several replies (Phase 25a): `POST reviews/send` checks every text again and answers per
 * review `sent`, `failed` or `skipped` with a reason. These helpers turn the answer into the results
 * panel shown after "Send all" and "Send selected": "Sent N · Skipped M", grouped by what to do next,
 * in plain words.
 *
 * - `checks_failed`: a hard finding; the text must change ("Can't be sent").
 * - `needs_review`: a warning; one review sent on its own asks "Send anyway?" ("Needs a look").
 * - `reply_changed_on_google`: Google has a reply the app didn't show; nothing was sent.
 * - `deleted_on_google`, `no_draft`, `not_found`: nothing to send.
 * - `failed`: Google didn't take it (its `reason` is the error message; the draft is kept). Since 2026-11-17 its
 *   `code` says what kind of failure it was and what to offer: `reconnect_required` (Reconnect Google),
 *   `google_unavailable` (try again later), `google_rejected_request` (show the reason), `not_configured` (contact
 *   support), `send_failed`.
 * - 2026-11-17: `replaces_published_reply` (a draft over a reply on Google: updates go one at a time) and
 *   `deadline` (not sent yet, Google was slow or the time was up: "Send the rest" sends exactly those again).
 * - `moderation_unavailable` is a note only: it never holds a reply back.
 * Sent replies come back `pending` ("Waiting for Google") until Google publishes or rejects them.
 */
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isApiError, type DraftCheck, type GoogleReply, type Review, type SendErrorCode, type SendRepliesResponse, type SendResult } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { checkDetailText, replyAuthorizationFromError, sendBlockFromError, sortChecks } from "./reply-checks";
import { setCachedReplyAuthorization } from "./review-cache";
import { scrollToReplyAuthorization } from "./review-spotlight";
import { reviewsSummaryQuery } from "./use-reviews";

export type SendGroupKey =
  | "checks_failed"
  | "needs_review"
  | "reply_changed_on_google"
  | "draft_predates_reply"
  | "replaces_published_reply"
  | "deadline"
  | "failed"
  | "deleted_on_google"
  | "no_draft"
  | "not_found"
  | "other";

/** One review that wasn't sent. */
export type SendIssue = {
  reviewId: string;
  /** "Sam Lee", "Anonymous" or "A Google user". */
  reviewer: string;
  rating: number | null;
  /** One line about it: the first finding's `detail`, or what Google answered. */
  detail: string | null;
  /** The words of the draft the first finding is about, or Google's reply. */
  quote: string | null;
  /** More findings than the one shown. */
  moreFindings: number;
  findings: DraftCheck[];
  googleReply: GoogleReply | null;
  /** A failed send's kind (2026-11-17), when the answer gave one. */
  code: SendErrorCode | null;
};

/** What a group of failed sends offers, from their codes: Reconnect Google, contact support. */
export type SendGroupAction = "reconnect" | "support";

export type SendGroup = {
  key: SendGroupKey;
  title: string;
  /** What to do, in one sentence. */
  hint: string | null;
  tone: StatusTone;
  /** "Open it" makes sense (the review still waits for something from the user). */
  openable: boolean;
  items: SendIssue[];
  /** Buttons for the whole group (failed sends: from their codes). */
  actions: SendGroupAction[];
};

export type SendSummary = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Sent although the automatic content check couldn't run on the text (a note, never a block). */
  unchecked: number;
  /** Most urgent first. */
  groups: SendGroup[];
  /** A later batch couldn't be sent at all (what was sent before it is counted). */
  interrupted: string | null;
  /** The reviews skipped as `deadline` (not sent yet): "Send the rest" sends exactly these again. */
  resendIds: string[];
};

const GROUPS: Record<SendGroupKey, Omit<SendGroup, "key" | "items" | "actions">> = {
  checks_failed: {
    title: "Can't be sent: fix the highlighted parts",
    hint: "Each of these breaks a reply rule. Open it, change the highlighted words, then send it.",
    tone: "critical",
    openable: true,
  },
  needs_review: {
    title: "Needs a look: open it and send it on its own",
    hint: "A check found something to read before it goes out. Open the review, read the note, then send it from there.",
    tone: "warning",
    openable: true,
  },
  reply_changed_on_google: {
    title: "Google already has a reply",
    hint: "Someone replied on Google since the last check, so your draft wasn't sent. Open the review to keep Google's reply or replace it with your draft.",
    tone: "warning",
    openable: true,
  },
  draft_predates_reply: {
    title: "Written before the reply on Google",
    hint: "Google has a newer reply than this draft. Open the review to replace Google's reply with your draft, or delete the draft.",
    tone: "warning",
    openable: true,
  },
  replaces_published_reply: {
    title: "Updates of a reply on Google: send each one on its own",
    hint: "These drafts replace a reply that is already on Google, so they go one at a time. Open each one and send it from its review.",
    tone: "info",
    openable: true,
  },
  deadline: {
    title: "Not sent yet",
    hint: "Google was slow, so these weren't sent and nothing changed on Google. Send them again.",
    tone: "warning",
    openable: false,
  },
  failed: {
    title: "Google didn't accept it",
    hint: "The draft is kept. Open the review to send it again.",
    tone: "critical",
    openable: true,
  },
  deleted_on_google: {
    title: "Deleted on Google",
    hint: "The review is no longer on Google, so there's nothing to reply to.",
    tone: "neutral",
    openable: false,
  },
  no_draft: { title: "No draft to send", hint: "The draft was removed before it could be sent.", tone: "neutral", openable: false },
  not_found: { title: "Not found", hint: "The review may have been removed since the list loaded.", tone: "neutral", openable: false },
  other: { title: "Not sent", hint: null, tone: "neutral", openable: true },
};

const ORDER: readonly SendGroupKey[] = [
  "deadline",
  "checks_failed",
  "needs_review",
  "reply_changed_on_google",
  "draft_predates_reply",
  "replaces_published_reply",
  "failed",
  "deleted_on_google",
  "no_draft",
  "not_found",
  "other",
];

const SKIP_GROUP: Record<string, SendGroupKey> = {
  checks_failed: "checks_failed",
  needs_review: "needs_review",
  reply_changed_on_google: "reply_changed_on_google",
  draft_predates_reply: "draft_predates_reply",
  replaces_published_reply: "replaces_published_reply",
  deadline: "deadline",
  deleted_on_google: "deleted_on_google",
  no_draft: "no_draft",
  not_found: "not_found",
};

function groupOf(result: SendResult): SendGroupKey | null {
  if (result.status === "sent") return null;
  if (result.status === "failed") return "failed";
  return (result.reason && SKIP_GROUP[result.reason]) || "other";
}

/** The reviewer's name as cards show it. */
export function reviewerName(review: { reviewer?: Review["reviewer"] | undefined } | null | undefined): string {
  if (review?.reviewer?.is_anonymous) return "Anonymous";
  return review?.reviewer?.display_name?.trim() || "A Google user";
}

/** Words for each failed send's kind (2026-11-17, G4). `google_rejected_request` shows Google's own reason instead. */
const FAILURE_TEXT: Record<SendErrorCode, string> = {
  reconnect_required: "The Google connection needs attention. Reconnect Google, then send it again.",
  google_unavailable: "Google didn't answer or was busy. Try again later.",
  google_rejected_request: "Google refused the reply.",
  not_configured: "Replies can't be sent to Google from this account right now. Contact support.",
  send_failed: "Google didn't accept the reply. Try again in a few minutes.",
};

const SEND_ERROR_CODES = new Set<string>(Object.keys(FAILURE_TEXT));

/** The failure kind of a result or review, when it is one of the known ones. */
export function sendErrorCodeOf(code: string | null | undefined): SendErrorCode | null {
  return code && SEND_ERROR_CODES.has(code) ? (code as SendErrorCode) : null;
}

/** A technical message (status codes, internals) that is never shown as it is. */
const TECHNICAL = /server|request failed|network|timeout|\(\d{3}\)|configured|internal|_/i;

/**
 * Why Google didn't take a reply, in plain words. A failed send's `reason` (and a review's `send_error`) is the
 * error message; its `code` (2026-11-17) decides the words: Google's own reason only for
 * `google_rejected_request`, and never a technical message. Without a code (an older answer) the message decides.
 */
export function sendFailureText(reason: string | null | undefined, code?: string | null): string {
  const text = reason?.trim() ?? "";
  const kind = sendErrorCodeOf(code);
  if (kind === "google_rejected_request") {
    return text && !TECHNICAL.test(text) ? `Google refused the reply: ${text.replace(/[.\s]+$/, "")}.` : FAILURE_TEXT.google_rejected_request;
  }
  if (kind) return FAILURE_TEXT[kind];
  if (/connect|authori[sz]ation|reconnect/i.test(text)) return FAILURE_TEXT.reconnect_required;
  if (!text || TECHNICAL.test(text)) return FAILURE_TEXT.send_failed;
  return text;
}

/** What a failed send offers besides sending again: Reconnect Google, or contact support. Null otherwise. */
export function sendFailureAction(code: string | null | undefined): SendGroupAction | null {
  const kind = sendErrorCodeOf(code);
  return kind === "reconnect_required" ? "reconnect" : kind === "not_configured" ? "support" : null;
}

function issueOf(key: SendGroupKey, result: SendResult, review: { reviewer?: Review["reviewer"]; rating?: Review["rating"] } | undefined): SendIssue {
  const findings = sortChecks(result.findings ?? []);
  const first = findings[0];
  const googleReply = result.google_reply ?? null;
  const code = result.status === "failed" ? sendErrorCodeOf(result.code) : null;
  let detail: string | null = null;
  let quote: string | null = null;
  if (key === "checks_failed" || key === "needs_review") {
    detail = first ? checkDetailText(first) : null;
    quote = first?.span?.text?.trim() || null;
  } else if (key === "reply_changed_on_google" || key === "draft_predates_reply") {
    quote = googleReply?.comment?.trim() || null;
  } else if (key === "failed") {
    detail = sendFailureText(result.reason, code);
  }
  return {
    reviewId: result.review_id,
    reviewer: reviewerName(review),
    rating: review?.rating ?? null,
    detail,
    quote,
    moreFindings: Math.max(0, findings.length - 1),
    findings,
    googleReply,
    code,
  };
}

/** The reviews a send was about, for names and ratings: the reviews themselves, or what an earlier panel showed. */
export type SentReviewInfo = Pick<Review, "review_id"> & { reviewer?: Review["reviewer"]; rating?: Review["rating"] };

/** Groups a send's results (several batches merged) for the results panel. `reviews`: the reviews sent, for names and ratings. */
export function summarizeSend(response: SendRepliesResponse, reviews: readonly SentReviewInfo[], interrupted: string | null = null): SendSummary {
  const byId = new Map(reviews.map((review) => [review.review_id, review]));
  const grouped = new Map<SendGroupKey, SendIssue[]>();
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let unchecked = 0;
  for (const result of response.results) {
    if (result.status === "sent") {
      sent += 1;
      if (result.moderation_unavailable) unchecked += 1;
      continue;
    }
    if (result.status === "failed") failed += 1;
    else skipped += 1;
    const key = groupOf(result) ?? "other";
    const items = grouped.get(key) ?? [];
    items.push(issueOf(key, result, byId.get(result.review_id)));
    grouped.set(key, items);
  }
  const groups = ORDER.filter((key) => grouped.has(key)).map((key): SendGroup => {
    const items = grouped.get(key) ?? [];
    const actions = key === "failed" ? [...new Set(items.map((item) => sendFailureAction(item.code)).filter((action): action is SendGroupAction => action !== null))] : [];
    return { key, ...GROUPS[key], items, actions };
  });
  return {
    attempted: response.results.length,
    sent,
    skipped,
    failed,
    unchecked,
    groups,
    interrupted,
    resendIds: grouped.get("deadline")?.map((item) => item.reviewId) ?? [],
  };
}

/** A results panel's reviews as name sources for the next send (e.g. "Send the rest"). */
export function sentInfoFrom(summary: SendSummary): SentReviewInfo[] {
  return summary.groups.flatMap((group) =>
    group.items.map((item) => ({
      review_id: item.reviewId,
      reviewer: { display_name: item.reviewer, is_anonymous: item.reviewer === "Anonymous" },
      rating: item.rating,
    })),
  );
}

/**
 * A send of exactly one review answers with an error instead of a result (422 `checks_failed`, 409
 * `confirm_warnings_required`, 409 `reply_changed_on_google`, 409 `draft_predates_reply`): the result a send of
 * several would have given, so "Send selected" with one draft (or a last batch of one) shows the same panel.
 * Null for any other error (409 `reply_authorization_required` included).
 */
export function singleSendResult(error: unknown, reviewId: string): SendResult | null {
  const block = sendBlockFromError(error);
  if (!block) return null;
  switch (block.kind) {
    case "checks_failed":
      return { review_id: reviewId, status: "skipped", reason: "checks_failed", findings: block.findings };
    case "confirm_warnings_required":
      return { review_id: reviewId, status: "skipped", reason: "needs_review", findings: block.findings };
    case "reply_changed_on_google":
      return { review_id: reviewId, status: "skipped", reason: "reply_changed_on_google", google_reply: block.googleReply };
    case "draft_predates_reply":
      return { review_id: reviewId, status: "skipped", reason: "draft_predates_reply", google_reply: block.googleReply };
    default:
      return null;
  }
}

/** "Sent 12 · Skipped 3 · 1 failed" (the panel's title). */
export function sendSummaryTitle(summary: Pick<SendSummary, "sent" | "skipped" | "failed">): string {
  const parts = [summary.sent > 0 ? `Sent ${summary.sent.toLocaleString()}` : "Nothing sent"];
  if (summary.skipped > 0) parts.push(`Skipped ${summary.skipped.toLocaleString()}`);
  if (summary.failed > 0) parts.push(`Failed ${summary.failed.toLocaleString()}`);
  return parts.join(" · ");
}

/** What happens to a sent reply now (Google reviews every reply before it shows): the card, its toast and every send of several say it. */
export const SENT_REPLIES_NOTE = "Google reviews every reply before it shows. This usually takes minutes, sometimes a day.";

/** One toast for a refused send: a card and a send of several refused together show it once. */
const AUTHORIZATION_TOAST_ID = "reply-authorization-required";

/**
 * A send refused with 409 `reply_authorization_required` (an agency without the client's
 * authorization), from a card or a send of several: puts the authorization from the answer into the
 * cached summary, so the banner and every Send button update at once, reads the summary again and
 * points to the banner. True when the error was that one (nothing else to show).
 */
export function noteReplyAuthorizationRequired(queryClient: QueryClient, locationId: string, error: unknown): boolean {
  if (!isApiError(error) || error.reason !== "reply_authorization_required") return false;
  setCachedReplyAuthorization(queryClient, locationId, replyAuthorizationFromError(error));
  void queryClient.invalidateQueries({ queryKey: reviewsSummaryQuery(locationId).queryKey });
  toast.warning("Replies need your client's authorization first", {
    id: AUTHORIZATION_TOAST_ID,
    description: "Nothing was sent. The note at the top of the page says who can give it.",
    action: { label: "Show me", onClick: () => scrollToReplyAuthorization() },
  });
  return true;
}
