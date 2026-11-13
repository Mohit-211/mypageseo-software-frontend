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
 * - `failed`: Google didn't take it (its `reason` is the error message; the draft is kept).
 * - `moderation_unavailable` is a note only: it never holds a reply back.
 * Sent replies come back `pending` ("Waiting for Google") until Google publishes or rejects them.
 */
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isApiError, type DraftCheck, type GoogleReply, type Review, type SendRepliesResponse, type SendResult } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import { checkDetailText, replyAuthorizationFromError, sendBlockFromError, sortChecks } from "./reply-checks";
import { setCachedReplyAuthorization } from "./review-cache";
import { scrollToReplyAuthorization } from "./review-spotlight";
import { reviewsSummaryQuery } from "./use-reviews";

export type SendGroupKey =
  | "checks_failed"
  | "needs_review"
  | "reply_changed_on_google"
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
};

export type SendGroup = {
  key: SendGroupKey;
  title: string;
  /** What to do, in one sentence. */
  hint: string | null;
  tone: StatusTone;
  /** "Open it" makes sense (the review still waits for something from the user). */
  openable: boolean;
  items: SendIssue[];
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
};

const GROUPS: Record<SendGroupKey, Omit<SendGroup, "key" | "items">> = {
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

const ORDER: readonly SendGroupKey[] = ["checks_failed", "needs_review", "reply_changed_on_google", "failed", "deleted_on_google", "no_draft", "not_found", "other"];

const SKIP_GROUP: Record<string, SendGroupKey> = {
  checks_failed: "checks_failed",
  needs_review: "needs_review",
  reply_changed_on_google: "reply_changed_on_google",
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
export function reviewerName(review: Pick<Review, "reviewer"> | null | undefined): string {
  if (review?.reviewer?.is_anonymous) return "Anonymous";
  return review?.reviewer?.display_name?.trim() || "A Google user";
}

/**
 * Why Google didn't take a reply, in plain words. A failed send's `reason` is the error message
 * (e.g. "Google Business Profile request failed (500)."), never shown as it is when it's technical.
 */
export function sendFailureText(reason: string | null | undefined): string {
  const text = reason?.trim() ?? "";
  if (/connect|authori[sz]ation|reconnect/i.test(text)) return "The Google connection needs attention. Reconnect Google, then send it again.";
  if (!text || /server|request failed|network|timeout|\(\d{3}\)|configured|internal|_/i.test(text)) return "Google didn't accept the reply. Try again in a few minutes.";
  return text;
}

function issueOf(key: SendGroupKey, result: SendResult, review: Review | undefined): SendIssue {
  const findings = sortChecks(result.findings ?? []);
  const first = findings[0];
  const googleReply = result.google_reply ?? null;
  let detail: string | null = null;
  let quote: string | null = null;
  if (key === "checks_failed" || key === "needs_review") {
    detail = first ? checkDetailText(first) : null;
    quote = first?.span?.text?.trim() || null;
  } else if (key === "reply_changed_on_google") {
    quote = googleReply?.comment?.trim() || null;
  } else if (key === "failed") {
    detail = sendFailureText(result.reason);
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
  };
}

/** Groups a send's results (several batches merged) for the results panel. `reviews`: the reviews sent, for names and ratings. */
export function summarizeSend(response: SendRepliesResponse, reviews: readonly Review[], interrupted: string | null = null): SendSummary {
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
  return {
    attempted: response.results.length,
    sent,
    skipped,
    failed,
    unchecked,
    groups: ORDER.filter((key) => grouped.has(key)).map((key) => ({ key, ...GROUPS[key], items: grouped.get(key) ?? [] })),
    interrupted,
  };
}

/**
 * A send of exactly one review answers with an error instead of a result (422 `checks_failed`, 409
 * `confirm_warnings_required`, 409 `reply_changed_on_google`): the result a send of several would
 * have given, so "Send selected" with one draft (or a last batch of one) shows the same panel.
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
