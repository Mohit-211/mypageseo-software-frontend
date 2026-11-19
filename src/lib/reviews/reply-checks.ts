/**
 * Replies v2 (Phase 25a): pure helpers shared by the review card, the send flows and the bulk results.
 *
 * - Checks: every draft carries `draft.checks` (also re-run on each save) and a send answers with
 *   `findings` of the same shape. `hard` can't be sent (red), `warn` needs a look (amber), `regenerate`
 *   is a writing note (never blocks).
 * - Google's limit is 4,096 bytes of UTF-8 (an emoji counts 4), not characters.
 * - A blocked send carries details in the error body: `findings`, `google_reply`, `review`,
 *   `reply_authorization`.
 */
import { apiErrorData, isApiError } from "@/api";
import type {
  DeclinedInstruction,
  DraftCheck,
  DraftCheckSeverity,
  DraftVerification,
  GoogleReply,
  ReplyAuthorization,
  ReplyState,
  Review,
} from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";

/** Google's reply limit (UTF-8 bytes). */
export const REPLY_MAX_BYTES = 4096;

/** "Change it" request length (characters). */
export const CHANGE_IT_MAX_CHARS = 500;

/** The version of the reply-authorization consent text the app shows (sent as `consent_version`). */
export const REPLY_AUTH_CONSENT_VERSION = "2026-11-13";

const encoder = new TextEncoder();

/** Bytes the text takes in UTF-8 (what Google counts). */
export function utf8Length(text: string): number {
  return encoder.encode(text).length;
}

/* -------------------------------------------------------------------------- */
/* Severities                                                                   */
/* -------------------------------------------------------------------------- */

const SEVERITY_RANK: Record<DraftCheckSeverity, number> = { hard: 0, warn: 1, regenerate: 2 };

export const SEVERITY_COPY: Record<DraftCheckSeverity, { label: string; short: string; tone: StatusTone }> = {
  hard: { label: "Can't be sent", short: "Must fix", tone: "critical" },
  warn: { label: "Check before sending", short: "Check", tone: "warning" },
  regenerate: { label: "Writing note", short: "Note", tone: "neutral" },
};

/** Most serious first, then in text order (whole-text findings first). */
export function sortChecks(checks: readonly DraftCheck[]): DraftCheck[] {
  return [...checks].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (a.span?.start ?? -1) - (b.span?.start ?? -1),
  );
}

export function checksBySeverity(checks: readonly DraftCheck[] | null | undefined) {
  const list = checks ?? [];
  return {
    hard: list.filter((check) => check.severity === "hard"),
    warn: list.filter((check) => check.severity === "warn"),
    notes: list.filter((check) => check.severity === "regenerate"),
  };
}

/** The most serious severity present, or null. */
export function worstSeverity(checks: readonly DraftCheck[] | null | undefined): DraftCheckSeverity | null {
  let worst: DraftCheckSeverity | null = null;
  for (const check of checks ?? []) if (worst === null || SEVERITY_RANK[check.severity] < SEVERITY_RANK[worst]) worst = check.severity;
  return worst;
}

/* -------------------------------------------------------------------------- */
/* Highlighting                                                                 */
/* -------------------------------------------------------------------------- */

export type HighlightSegment = { text: string; check: DraftCheck | null; start: number };

/**
 * Splits `text` into plain and highlighted runs for the checks' spans. Offsets are UTF-16 (as
 * JavaScript counts). A span whose offsets don't match the text (it was made on another version) is
 * looked up by its own `text` instead, else left out of the highlight (its finding is still listed).
 * Where spans overlap the most serious one wins.
 */
export function highlightSegments(text: string, checks: readonly DraftCheck[] | null | undefined): HighlightSegment[] {
  const owner: (DraftCheck | null)[] = new Array<DraftCheck | null>(text.length).fill(null);
  // Paint the least serious first and, within one severity, the longest first, so a more serious
  // span always wins and, at equal severity, the shorter (more specific) one stays visible: "45"
  // inside a flagged sentence keeps its own highlight.
  const located = (checks ?? [])
    .map((check) => ({ check, range: locateSpan(text, check) }))
    .filter((entry): entry is { check: DraftCheck; range: { start: number; end: number } } => entry.range !== null)
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.check.severity] - SEVERITY_RANK[a.check.severity] ||
        b.range.end - b.range.start - (a.range.end - a.range.start),
    );
  for (const { check, range } of located) {
    for (let i = range.start; i < range.end; i += 1) {
      const current = owner[i] ?? null;
      if (current === null || SEVERITY_RANK[check.severity] <= SEVERITY_RANK[current.severity]) owner[i] = check;
    }
  }
  const segments: HighlightSegment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || owner[i] !== owner[start]) {
      segments.push({ text: text.slice(start, i), check: owner[start] ?? null, start });
      start = i;
    }
  }
  return segments.length ? segments : [{ text, check: null, start: 0 }];
}

function locateSpan(text: string, check: DraftCheck): { start: number; end: number } | null {
  const span = check.span;
  if (!span) return null;
  const { start, end } = span;
  if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length) {
    if (!span.text || text.slice(start, end) === span.text) return { start, end };
  }
  if (span.text) {
    const found = text.indexOf(span.text);
    if (found >= 0) return { start: found, end: found + span.text.length };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Verification, reply states, declined parts                                   */
/* -------------------------------------------------------------------------- */

export const VERIFICATION_COPY: Record<DraftVerification, { label: string; description: string; tone: StatusTone }> = {
  passed: { label: "Double-checked", description: "An AI checker read this draft and found nothing to fix.", tone: "success" },
  flagged: { label: "Flagged by the double-check", description: "The AI checker or the automatic content check raised something: see the notes.", tone: "warning" },
  unavailable: { label: "Not double-checked", description: "The AI checker couldn't run on this draft. Read it carefully before sending.", tone: "warning" },
};

export const REPLY_STATE_COPY: Partial<Record<ReplyState, { label: string; tone: StatusTone }>> = {
  pending: { label: "Waiting for Google", tone: "info" },
  rejected: { label: "Rejected by Google", tone: "critical" },
};

export const DECLINED_REASON_COPY: Record<string, string> = {
  offer: "offers, discounts or refunds",
  contact_details: "other contact details",
  name: "people's names",
  date: "dates or times",
  treatment: "treatments or services",
};

/** "We left out: “Offer them 20% off” (offers, discounts or refunds)". */
export function declinedSummary(declined: readonly DeclinedInstruction[]): string {
  return declined.map((part) => `“${part.text}” (${DECLINED_REASON_COPY[part.reason] ?? "against the reply rules"})`).join("; ");
}

/* -------------------------------------------------------------------------- */
/* Details on a blocked send                                                    */
/* -------------------------------------------------------------------------- */

function isCheck(value: unknown): value is DraftCheck {
  if (!value || typeof value !== "object") return false;
  const check = value as Partial<DraftCheck>;
  // The backend types `detail` as string | null: a finding without one is still a finding.
  return typeof check.severity === "string" && typeof check.rule === "string" && (typeof check.detail === "string" || check.detail == null);
}

/**
 * Which check found it, when that helps reading it (Phase 25b): the judge's failed gates are `verifier`
 * warnings of kind `accuracy`, `policy`, `privacy` or (after "Change it") `request`. Null for the other rules,
 * whose `detail` says it all.
 */
export const VERIFIER_KIND_LABEL: Record<string, string> = {
  accuracy: "Double-check: facts",
  policy: "Double-check: Google's rules",
  privacy: "Double-check: privacy",
  request: "Double-check: your change",
  unavailable: "Not double-checked",
};

export function findingSourceLabel(check: Pick<DraftCheck, "rule" | "kind">): string | null {
  if (check.rule === "verifier") return VERIFIER_KIND_LABEL[check.kind] ?? "Double-check";
  if (check.rule === "moderation") return "Content check";
  if (check.rule === "restricted" && check.kind === "no_public_reply") return "Law firm";
  return null;
}

/** The `findings` of a 422 `checks_failed` / 409 `confirm_warnings_required`. */
export function findingsFromError(error: unknown): DraftCheck[] {
  const findings = apiErrorData(error).findings;
  return Array.isArray(findings) ? findings.filter(isCheck).map((check) => ({ ...check, detail: check.detail ?? "" })) : [];
}

/**
 * The sentence to show for a finding, in plain words. Moderation findings arrive as raw category
 * names from the automatic content check ("Moderation: harassment/threatening, violence/graphic."),
 * so they get one plain sentence instead; a finding without a detail falls back to its severity.
 */
export function checkDetailText(check: DraftCheck): string {
  if (check.rule === "moderation") {
    return "The automatic content check flagged this wording as possibly offensive, threatening or explicit. Rewrite it before sending.";
  }
  if (check.rule === "verifier" && check.kind === "unavailable") {
    return "Nothing double-checked this draft. Read it carefully before sending.";
  }
  const detail = check.detail?.trim();
  return detail || SEVERITY_COPY[check.severity].label;
}

/** Google's reply in a 409 `reply_changed_on_google`. */
export function googleReplyFromError(error: unknown): GoogleReply | null {
  const reply = apiErrorData(error).google_reply;
  return reply && typeof reply === "object" ? (reply as GoogleReply) : null;
}

/** The updated review some blocked sends return (409 `reply_changed_on_google`). */
export function reviewFromError(error: unknown): Review | null {
  const review = apiErrorData(error).review;
  return review && typeof review === "object" && "review_id" in review ? (review as Review) : null;
}

/** The authorization in a 409 `reply_authorization_required`. */
export function replyAuthorizationFromError(error: unknown): ReplyAuthorization | null {
  const auth = apiErrorData(error).reply_authorization;
  return auth && typeof auth === "object" ? (auth as ReplyAuthorization) : null;
}

/** The `declined_instructions` of a 400 `instructions_declined`. */
export function declinedFromError(error: unknown): DeclinedInstruction[] {
  const declined = apiErrorData(error).declined_instructions;
  return Array.isArray(declined) ? (declined as DeclinedInstruction[]).filter((part) => part && typeof part.text === "string") : [];
}

export type SendBlock =
  | { kind: "checks_failed"; findings: DraftCheck[] }
  | { kind: "confirm_warnings_required"; findings: DraftCheck[] }
  | { kind: "reply_changed_on_google"; googleReply: GoogleReply | null; review: Review | null }
  /** 2026-11-17 (G3): the draft was written before the reply now on Google: save it again (an update) or delete it. */
  | { kind: "draft_predates_reply"; googleReply: GoogleReply | null }
  | { kind: "reply_authorization_required"; authorization: ReplyAuthorization | null };

/** A single-review send the checks or Google held back, as data the card can show; null for other errors. */
export function sendBlockFromError(error: unknown): SendBlock | null {
  if (!isApiError(error)) return null;
  switch (error.reason) {
    case "checks_failed":
      return { kind: "checks_failed", findings: findingsFromError(error) };
    case "confirm_warnings_required":
      return { kind: "confirm_warnings_required", findings: findingsFromError(error) };
    case "reply_changed_on_google":
      return { kind: "reply_changed_on_google", googleReply: googleReplyFromError(error), review: reviewFromError(error) };
    case "draft_predates_reply":
      return { kind: "draft_predates_reply", googleReply: googleReplyFromError(error) };
    case "reply_authorization_required":
      return { kind: "reply_authorization_required", authorization: replyAuthorizationFromError(error) };
    default:
      return null;
  }
}
