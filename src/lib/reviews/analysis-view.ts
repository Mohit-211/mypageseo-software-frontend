/**
 * The review's analysis v2 (Phase 25b, `analysis.version` 2), as pure helpers: what the reviewer mentioned
 * (`mentions`, each with its `quote` from the review: highlighted in the review's text), `risks`, `emotion` and
 * `asks_question`. An analysis made before has `version: 1`, `mentions: []`, `risks: []` and the rest null; Analyze
 * makes it again (charged as any analysis), and reuses a current v2 for free.
 */
import type { Review, ReviewMention } from "@/api";
import type { StatusTone } from "@/components/layout/shared/module-tone";

export const MENTION_KIND_LABEL: Record<string, string> = {
  service: "Service",
  product: "Product",
  staff: "Staff",
  outcome: "Result",
  complaint: "Complaint",
  question: "Question",
};

export const RISK_LABEL: Record<string, string> = {
  safety: "Safety",
  injury: "Injury",
  legal: "Legal",
  discrimination: "Discrimination",
  health: "Health",
  billing: "Billing or refund",
  staff_conduct: "Staff conduct",
  competitor: "Competitor",
  personal_data: "Personal data",
};

export const EMOTION_LABEL: Record<string, string> = {
  delighted: "Delighted",
  grateful: "Grateful",
  satisfied: "Satisfied",
  neutral: "Neutral",
  disappointed: "Disappointed",
  frustrated: "Frustrated",
  angry: "Angry",
  worried: "Worried",
};

/** A mention's colour by how the reviewer felt about it (always with words next to it). */
export function mentionTone(sentiment: string | null | undefined): Extract<StatusTone, "success" | "warning" | "neutral"> {
  if (sentiment === "positive") return "success";
  if (sentiment === "negative") return "warning";
  return "neutral";
}

const label = (map: Record<string, string>, value: string) => map[value] ?? `${value.charAt(0).toUpperCase()}${value.slice(1).replace(/_/g, " ")}`;

export const mentionKindLabel = (kind: string) => label(MENTION_KIND_LABEL, kind);
export const riskLabel = (risk: string) => label(RISK_LABEL, risk);
export const emotionLabel = (emotion: string) => label(EMOTION_LABEL, emotion);

/**
 * How the reviewer felt about a mention, as a word after it ("praise", "complaint"), or null when there is nothing
 * to add: a neutral mention, or a complaint, whose kind already says it ("Complaint: prices have crept", never
 * "… · complaint" again).
 */
export function mentionFeeling(mention: Pick<ReviewMention, "kind" | "sentiment">): "praise" | "complaint" | null {
  if (mention.sentiment === "positive") return "praise";
  if (mention.sentiment === "negative") return mention.kind === "complaint" ? null : "complaint";
  return null;
}

/** The analysis is v2 (has what the reviewer mentioned, risks, emotion). */
export function isAnalysisV2(analysis: Review["analysis"] | null | undefined): boolean {
  return (analysis?.version ?? 1) >= 2;
}

/**
 * Analyze can add something: the review has text, and it has no analysis, one made before the review changed, or
 * one made before Phase 25b (v1: Analyze makes a v2, with what the reviewer mentioned).
 */
export function canAnalyzeReview(review: Pick<Review, "comment" | "analysis">): boolean {
  if (!review.comment?.trim()) return false;
  return !review.analysis || review.analysis.stale || !isAnalysisV2(review.analysis);
}

export type MentionSegment = { text: string; start: number; mention: ReviewMention | null };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function locate(text: string, quote: string): { start: number; end: number } | null {
  const wanted = quote.trim();
  if (!wanted) return null;
  const exact = text.indexOf(wanted);
  if (exact >= 0) return { start: exact, end: exact + wanted.length };
  // The same words with other capitals or spacing (the AI may tidy a quote a little).
  const loose = new RegExp(wanted.split(/\s+/).map(escapeRegExp).join("\\s+"), "iu").exec(text);
  return loose ? { start: loose.index, end: loose.index + loose[0].length } : null;
}

/**
 * Splits the review's text into plain runs and the quotes of what the reviewer mentioned. A quote that isn't in the
 * text (the review changed, or the AI reworded it) is left out; where quotes overlap, the more important mention
 * (earlier in the list) wins.
 */
export function mentionSegments(text: string, mentions: readonly ReviewMention[] | null | undefined): MentionSegment[] {
  if (!text) return [];
  const owner: (ReviewMention | null)[] = new Array<ReviewMention | null>(text.length).fill(null);
  for (const mention of mentions ?? []) {
    const range = mention?.quote ? locate(text, mention.quote) : null;
    if (!range) continue;
    for (let i = range.start; i < range.end; i += 1) owner[i] ??= mention;
  }
  const segments: MentionSegment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || owner[i] !== owner[start]) {
      segments.push({ text: text.slice(start, i), start, mention: owner[start] ?? null });
      start = i;
    }
  }
  return segments;
}
