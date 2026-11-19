/**
 * Post writer v2 on screen (Phase 25c; 2026-11-16 "Post writer v2" items 3 and 4): how the AI wrote a post
 * (`post.ai`), what the checks found in its text, and what blocks it from going out.
 *
 * - Findings: `post.ai.findings` are the checks' findings on the text as the AI wrote it. Highlight each `text`
 *   while it is still in the post (an edit may have moved or removed it); a `hard` one must change before the
 *   post goes out: scheduling, publishing, retrying and approving answer 422 `checks_failed` (+ `findings`)
 *   until a person changes those words. `standingHardFindings` is the backend's rule for what still blocks (one
 *   helper for the card, the editor and the review queue).
 * - Post rules: `offer_not_allowed_for_regulated` (field `type`) and `cta_not_allowed_for_regulated` (field
 *   `cta.type`) block every post, a person's too. The saved post's own `issues` never list them (nor
 *   `offer_not_allowed_for_lodging`): the editor's live check (`POST …/posts/validate`) and a 422
 *   `post_incomplete` do.
 * - Pictures: where a picture came from, its label ("AI-generated image, not a photo of your business",
 *   "Enhanced from your photo") and why no picture was made ("No picture this time: …").
 *
 * Pure: no React, no clock.
 */
import { apiErrorData, isApiError, type Post, type PostAi, type PostAiFinding, type PostDeclinedInstruction, type PostImageSource, type PostIssue } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";

/* -------------------------------------------------------------------------- */
/* Findings                                                                     */
/* -------------------------------------------------------------------------- */

export type FindingSeverity = "hard" | "warn" | "regenerate";

/** How each severity reads: `hard` red (must change), `warn` amber (check), a writing note muted. */
export const FINDING_SEVERITY_COPY: Readonly<Record<FindingSeverity, { label: string; short: string; tone: StatusTone }>> = {
  hard: { label: "Must change before it goes out", short: "Must change", tone: "critical" },
  warn: { label: "Check before it goes out", short: "Check", tone: "warning" },
  regenerate: { label: "Writing note", short: "Note", tone: "neutral" },
};

const SEVERITY_RANK: Readonly<Record<FindingSeverity, number>> = { hard: 0, warn: 1, regenerate: 2 };

/** A finding's severity, an unknown one read as a writing note. */
export function findingSeverity(finding: Pick<PostAiFinding, "severity">): FindingSeverity {
  if (finding.severity === "hard") return "hard";
  if (finding.severity === "warn") return "warn";
  return "regenerate";
}

/** Most serious first, then in the order the checks gave them (a new array). */
export function sortFindings<T extends Pick<PostAiFinding, "severity">>(findings: readonly T[]): T[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => SEVERITY_RANK[findingSeverity(a.finding)] - SEVERITY_RANK[findingSeverity(b.finding)] || a.index - b.index)
    .map((entry) => entry.finding);
}

/** Where a finding's words are in `text` (their first place), or null: a whole-text finding, or words an edit removed. */
export function locateFinding(text: string, finding: Pick<PostAiFinding, "text">): { start: number; end: number } | null {
  const words = finding.text;
  if (!words) return null;
  const start = text.indexOf(words);
  return start >= 0 ? { start, end: start + words.length } : null;
}

/**
 * The findings that still apply to `text`: those whose words are still in it, and whole-text findings (no
 * `text`), which only the server can clear. A finding whose words are gone was changed.
 */
export function findingsInText<T extends Pick<PostAiFinding, "text">>(findings: readonly T[] | null | undefined, text: string): T[] {
  return (findings ?? []).filter((finding) => !finding.text || text.includes(finding.text));
}

/**
 * Several lists of findings as one (the post's own and a 422 `checks_failed`'s), each finding once, in order: the
 * same rule, kind, words and message are the same finding, whatever severity each list gives it (the first wins).
 */
export function mergeFindings(...lists: readonly (readonly PostAiFinding[] | null | undefined)[]): PostAiFinding[] {
  const seen = new Set<string>();
  const merged: PostAiFinding[] = [];
  for (const finding of lists.flatMap((list) => list ?? [])) {
    const key = `${finding.rule}|${finding.kind}|${finding.text ?? ""}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }
  return merged;
}

/** The findings whose words a person already changed (no longer in `text`). */
export function changedFindings<T extends Pick<PostAiFinding, "text">>(findings: readonly T[] | null | undefined, text: string): T[] {
  return (findings ?? []).filter((finding) => Boolean(finding.text) && !text.includes(finding.text ?? ""));
}

/**
 * Hard findings the backend leaves to the post's own settings (its button, its type: the live check covers those on
 * every post) or that only hold an automatic post for a person: a person may go ahead with them. The backend's
 * `NOT_TEXT_FINDINGS` (`src/modules/posts/domain/checks.ts`), as `rule:kind`.
 */
const NOT_TEXT_FINDINGS: ReadonlySet<string> = new Set([
  "regulated:review_only",
  "contest:no_terms",
  "lodging:button_url",
  "button:regulated_button",
  "button:informational_button",
  "length:too_long",
]);

/** What decides whether a hard finding still stands: the post as it is now. */
export type StandingContext = {
  /** The post's text now (the editor's form, else the saved summary). */
  summary: string | null | undefined;
  /** The post's type now: an `offer` finding (an Offer post a lodging business can't make) stands only on an Offer post. */
  type: string;
  /**
   * A person changed the AI's text (`ai.edited`, or the editor's unsaved change, which the save records). Undefined
   * when unknown (a client user's slim `ai`): whole-text findings then don't block here, the server's 422 decides.
   */
  edited?: boolean | undefined;
};

/**
 * Whether one finding still blocks the post (the backend's `standingHardFindings`, `checks.ts`): a hard one, not
 * left to the post's settings; with words (`text`), while they are in the text (exact); without (moderation, a
 * copy), while nobody changed the AI's text, and an `offer` one only on an Offer post.
 */
export function findingStands(finding: PostAiFinding, context: StandingContext): boolean {
  if (findingSeverity(finding) !== "hard" || NOT_TEXT_FINDINGS.has(`${finding.rule}:${finding.kind}`)) return false;
  if (finding.text) return (context.summary ?? "").includes(finding.text);
  if (context.edited !== false) return false;
  return finding.kind !== "offer" || context.type === "offer";
}

/** A saved post as it is: its text, type and whether a person changed the AI's text (`ai.edited`). */
export function postStandingContext(post: Pick<Post, "summary" | "type" | "ai">): StandingContext {
  return { summary: post.summary, type: post.type, edited: post.ai?.edited };
}

/**
 * The hard findings that still stand: while one is left, scheduling, publishing, retrying and approving the post
 * answer 422 `checks_failed`. `context.edited` overrides `ai.edited` when set (the editor's unsaved change of the
 * text); without either (a client user's slim `ai`), only findings with words block here.
 */
export function standingHardFindings(
  ai: Pick<PostAi, "findings" | "edited"> | null | undefined,
  context: StandingContext,
): PostAiFinding[] {
  if (!ai) return [];
  const edited = context.edited ?? ai.edited;
  return (ai.findings ?? []).filter((finding) => findingStands(finding, { ...context, edited }));
}

/**
 * How a finding reads now: a hard one that no longer stands (left to the post's settings, or whole-text after a
 * person's edit) reads as one to check, as it no longer blocks anything.
 */
export function shownSeverity(finding: PostAiFinding, context: StandingContext | null | undefined): FindingSeverity {
  const severity = findingSeverity(finding);
  return severity === "hard" && context && !findingStands(finding, context) ? "warn" : severity;
}

/** True when a finding's message already quotes its words (the backend's grounding messages do): don't quote them twice. */
export function messageQuotesText(finding: Pick<PostAiFinding, "text" | "message">): boolean {
  const words = finding.text?.trim();
  return Boolean(words) && finding.message.includes(words ?? "");
}

export type FindingSegment = { text: string; finding: PostAiFinding | null; start: number };

/**
 * `text` cut into runs, each with the finding that owns it (or null). A more serious finding wins where two
 * overlap, and at equal severity the shorter (more specific) one stays visible.
 */
export function findingSegments(text: string, findings: readonly PostAiFinding[] | null | undefined): FindingSegment[] {
  const owner: (PostAiFinding | null)[] = new Array<PostAiFinding | null>(text.length).fill(null);
  const located = (findings ?? [])
    .map((finding) => ({ finding, range: locateFinding(text, finding) }))
    .filter((entry): entry is { finding: PostAiFinding; range: { start: number; end: number } } => entry.range !== null)
    // The least serious and the longest first, so the more serious and the more specific paint over them.
    .sort(
      (a, b) =>
        SEVERITY_RANK[findingSeverity(b.finding)] - SEVERITY_RANK[findingSeverity(a.finding)] ||
        b.range.end - b.range.start - (a.range.end - a.range.start),
    );
  for (const { finding, range } of located) {
    for (let i = range.start; i < range.end; i += 1) owner[i] = finding;
  }
  const segments: FindingSegment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || owner[i] !== owner[start]) {
      segments.push({ text: text.slice(start, i), finding: owner[start] ?? null, start });
      start = i;
    }
  }
  return segments.length ? segments : [{ text, finding: null, start: 0 }];
}

function isFinding(value: unknown): value is PostAiFinding {
  return Boolean(value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string");
}

/** True for a 422 `checks_failed`: the post's AI text still has a hard finding. */
export function isChecksFailed(error: unknown): boolean {
  return isApiError(error) && error.reason === "checks_failed";
}

/**
 * The findings of a 422 `checks_failed` (empty for any other error). The backend lists the hard findings that still
 * stand (`StandingFinding`: rule, kind, message, text), without a severity: each reads as hard ("Must change").
 */
export function checksFailedFindings(error: unknown): PostAiFinding[] {
  if (!isChecksFailed(error)) return [];
  const findings = apiErrorData(error).findings;
  return Array.isArray(findings)
    ? findings.filter(isFinding).map((finding) => ({ ...finding, severity: typeof finding.severity === "string" ? finding.severity : "hard" }))
    : [];
}

/** The issues of a 422 `post_incomplete` (empty for any other error). */
export function incompleteIssues(error: unknown): PostIssue[] {
  if (!isApiError(error) || error.reason !== "post_incomplete") return [];
  const issues = apiErrorData(error).issues;
  return Array.isArray(issues) ? issues.filter((issue): issue is PostIssue => Boolean(issue) && typeof issue === "object" && typeof issue.code === "string") : [];
}

/* -------------------------------------------------------------------------- */
/* Post rules                                                                   */
/* -------------------------------------------------------------------------- */

/** An Offer post isn't allowed for this business (field `type`): lodging, or a regulated product or service. */
export const OFFER_RULE_CODES: ReadonlySet<string> = new Set(["offer_not_allowed_for_lodging", "offer_not_allowed_for_regulated"]);

/** An Order or Shop button isn't allowed for this business (field `cta.type`). */
export const CTA_RULE_CODE = "cta_not_allowed_for_regulated";

/** The buttons the regulated rule refuses. */
export const REGULATED_CTA_TYPES: ReadonlySet<string> = new Set(["ORDER", "SHOP"]);

/** Plain words for the post rules (the live check's own message is used when it has one). */
export const POST_RULE_WORDS: Readonly<Record<string, string>> = {
  offer_not_allowed_for_lodging: "Google doesn't allow Offer posts for hotels and other lodging. Use an Update or Event post instead.",
  offer_not_allowed_for_regulated: "This business sells a regulated product or service, so its posts give information and never offers. Use an Update or Event post.",
  cta_not_allowed_for_regulated: "This business sells a regulated product, so its posts can't have an Order or Buy button. Pick another button.",
};

/* -------------------------------------------------------------------------- */
/* How the AI wrote it                                                          */
/* -------------------------------------------------------------------------- */

/** The judge's grade in words ("Quality 4 of 5"), or null when no judge ran. */
export function qualityText(ai: Pick<PostAi, "quality"> | null | undefined): string | null {
  const score = ai?.quality?.score;
  return typeof score === "number" && Number.isFinite(score) ? `Quality ${Math.round(score)} of 5` : null;
}

export type PostVerification = "passed" | "flagged" | "unavailable";

/** The AI double-check of the post's text: a person should read a flagged or unchecked one closely. */
export const POST_VERIFICATION_COPY: Readonly<Record<PostVerification, { label: string; description: string; tone: StatusTone }>> = {
  passed: { label: "Double-checked", description: "An AI checker read the facts in this post and found nothing to fix.", tone: "success" },
  flagged: { label: "Flagged by the double-check", description: "The checks raised something in this post. Read it closely before it goes out.", tone: "warning" },
  unavailable: { label: "Not double-checked", description: "The AI checker couldn't run on this post. Read it closely before it goes out.", tone: "warning" },
};

/** The double-check's state, when the server sent a known one. */
export function postVerification(ai: Pick<PostAi, "verification"> | null | undefined): PostVerification | null {
  const value = ai?.verification;
  return value === "passed" || value === "flagged" || value === "unavailable" ? value : null;
}

/* -------------------------------------------------------------------------- */
/* Pictures                                                                     */
/* -------------------------------------------------------------------------- */

/** Where a post's picture came from. */
export const IMAGE_SOURCE_LABEL: Readonly<Record<PostImageSource, string>> = {
  library: "From your photo library",
  enhanced: "Enhanced from your photo",
  ai: "AI-generated image",
  none: "No picture",
};

export const AI_IMAGE_LABEL = "AI-generated image, not a photo of your business";
export const ENHANCED_LABEL = "Enhanced from your photo";

/** The label to show next to a picture: the photo's own `label`, else one from its kind (null for an upload). */
export function mediaLabel(media: { kind?: string | null; label?: string | null; ai_generated?: boolean } | null | undefined): string | null {
  if (!media) return null;
  if (media.label) return media.label;
  if (media.kind === "ai" || media.ai_generated) return AI_IMAGE_LABEL;
  if (media.kind === "enhanced") return ENHANCED_LABEL;
  return null;
}

/**
 * Why no picture was made, most telling first (`media: null` with `reasons`). Not a failure: the post is text
 * only. The library reasons only explain why no photo of the business was used.
 */
const NO_PICTURE_WORDS: readonly [string, string][] = [
  ["insufficient_tokens", "there weren't enough tokens for an AI image"],
  ["ai_org_budget_reached", "AI is paused for your organization today"],
  ["ai_budget_reached", "AI is paused for today"],
  ["ai_not_configured", "AI images aren't switched on yet"],
  ["moderation_blocked", "the picture didn't pass the safety check"],
  ["moderation_unavailable", "the safety check couldn't run, so no picture could be vetted"],
  ["judge_rejected", "none of the pictures passed the quality check"],
  ["judge_unavailable", "the quality check couldn't run"],
  ["ai_images_off", "no photo from your library fit, and AI images are switched off in AI Settings"],
  ["candidates_failed", "the pictures couldn't be made"],
  ["prescreen_failed", "the pictures weren't sharp or bright enough"],
  ["finish_failed", "the picture couldn't be finished"],
  ["ai_failed", "the picture couldn't be made"],
  ["library_failed", "your photo library couldn't be read"],
];

/** "No picture this time: none of the pictures passed the quality check." */
export function noPictureText(reasons: readonly string[] | null | undefined): string {
  const list = reasons ?? [];
  const found = NO_PICTURE_WORDS.find(([code]) => list.includes(code));
  return found ? `No picture this time: ${found[1]}.` : "No picture could be made this time.";
}

const LOGO_SKIPPED_WORDS: Readonly<Record<string, string>> = {
  logo_busy: "every corner of the picture was too busy",
  logo_low_contrast: "it wouldn't stand out on the picture",
  logo_too_small: "it would have been too small to read",
  logo_in_photo: "the photo already shows your logo",
};

/** Why the logo was left off a picture (`logo: "skipped"`), or null. */
export function logoSkippedText(logo: string | null | undefined, reasons: readonly string[] | null | undefined): string | null {
  if (logo !== "skipped") return null;
  const code = (reasons ?? []).find((reason) => Object.hasOwn(LOGO_SKIPPED_WORDS, reason));
  return code ? `Your logo was left off: ${LOGO_SKIPPED_WORDS[code]}.` : "Your logo was left off this picture.";
}

/**
 * Why an unattached picture wasn't put on the post (`attach_error`). A picture asked from a description has no
 * error: it is never attached, the person adds it.
 */
export function unattachedText(attachError: string | null | undefined): string {
  if (attachError === "invalid_status") return "The post is on Google, so the picture wasn't added to it.";
  if (attachError) return "The post changed while the picture was made, so it wasn't added.";
  return "The picture is ready.";
}

/* -------------------------------------------------------------------------- */
/* What the AI left out                                                         */
/* -------------------------------------------------------------------------- */

const DECLINED_WORDS: Readonly<Record<string, string>> = {
  contact_details: "posts can't carry phone numbers, links or emails",
  google_rules: "Google's post rules don't allow hashtags, emoji or capitals",
};

/** The writer's own short reason, as a clause ("No fact says so." → "no fact says so"). */
function reasonClause(reason: string | null | undefined): string {
  const text = reason?.trim().replace(/[.!]+$/, "") ?? "";
  if (!text || /^[a-z]+(_[a-z]+)+$/.test(text)) return "the business's facts don't support it";
  return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

/** "We left out: “Call 555-0100” (posts can't carry phone numbers, links or emails); …", or null when nothing was left out. */
export function declinedText(declined: readonly PostDeclinedInstruction[] | null | undefined): string | null {
  const parts = (declined ?? [])
    .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
    .map((entry) => `“${entry.text.trim()}” (${DECLINED_WORDS[entry.reason] ?? reasonClause(entry.reason)})`);
  return parts.length ? `We left out: ${parts.join("; ")}.` : null;
}

/** The parts declined in a 400 `instructions_declined` or a failed run's data (empty for another error). */
export function declinedFromError(error: unknown): PostDeclinedInstruction[] {
  if (!isApiError(error) || error.reason !== "instructions_declined") return [];
  const list = apiErrorData(error).declined_instructions;
  return Array.isArray(list) ? list.filter((entry): entry is PostDeclinedInstruction => Boolean(entry) && typeof entry === "object" && typeof entry.text === "string") : [];
}

/** The statements the AI couldn't use (`proposed_facts`) in an `instructions_declined` error (empty otherwise). */
export function proposedFactsFromError(error: unknown): string[] {
  if (!isApiError(error) || error.reason !== "instructions_declined") return [];
  const list = apiErrorData(error).proposed_facts;
  return Array.isArray(list) ? list.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}
