/**
 * The review's text and its AI analysis (Phase 18; analysis v2 since Phase 25b).
 * - `ReviewText`: the review as written, with the reviewer's own words for what they mentioned highlighted
 *   (`analysis.mentions[].quote`): green underline for praise, amber for a complaint, grey otherwise, and the same
 *   words listed in the panel below, so colour is never the only signal.
 * - `AnalysisPanel`: sentiment, severity, the summary and the suggested action, and (v2) what the reviewer
 *   mentioned, the risks it raises, how they feel, and whether they asked a question.
 */
import { Fragment } from "react";
import { AlertTriangle, CircleHelp, Sparkles } from "lucide-react";
import type { Review } from "@/api";
import { AiBadge } from "@/components/ai/ai-badge";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { emotionLabel, isAnalysisV2, mentionFeeling, mentionKindLabel, mentionSegments, mentionTone, riskLabel } from "@/lib/reviews/analysis-view";
import { cn } from "@/lib/utils";

const SENTIMENT_TONE: Record<string, "success" | "warning" | "neutral"> = { positive: "success", negative: "warning", mixed: "neutral", neutral: "neutral" };
const SEVERITY_TONE: Record<string, "critical" | "warning" | "neutral"> = { high: "critical", medium: "warning", low: "neutral" };

/** The underline of a highlighted quote, by how the reviewer felt (solid for praise, dashed for a complaint). */
const QUOTE_MARK: Record<"success" | "warning" | "neutral", string> = {
  success: "decoration-success decoration-2",
  warning: "decoration-warning decoration-dashed decoration-2",
  neutral: "decoration-muted-foreground decoration-dotted decoration-[1.5px]",
};

export function ReviewText({ review, className }: { review: Pick<Review, "comment" | "analysis">; className?: string }) {
  const comment = review.comment;
  if (!comment) {
    return <p className={cn("mt-3 whitespace-pre-line text-[15px] italic leading-relaxed text-muted-foreground", className)}>No written review, rating only.</p>;
  }
  const mentions = isAnalysisV2(review.analysis) ? (review.analysis?.mentions ?? []) : [];
  const segments = mentionSegments(comment, mentions);
  return (
    <p className={cn("mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground [overflow-wrap:anywhere]", className)}>
      {segments.map((segment) => {
        const mention = segment.mention;
        if (!mention) return <Fragment key={segment.start}>{segment.text}</Fragment>;
        const tone = mentionTone(mention.sentiment);
        return (
          <mark
            key={segment.start}
            title={`${mentionKindLabel(mention.kind)}: ${mention.text}`}
            className={cn("rounded-[2px] bg-transparent text-foreground underline underline-offset-[3px] [box-decoration-break:clone]", QUOTE_MARK[tone])}
          >
            {segment.text}
          </mark>
        );
      })}
    </p>
  );
}

export function AnalysisPanel({ analysis }: { analysis: NonNullable<Review["analysis"]> }) {
  const sentiment = analysis.sentiment?.toLowerCase() ?? null;
  const severity = analysis.severity?.toLowerCase() ?? null;
  const v2 = isAnalysisV2(analysis);
  const mentions = v2 ? (analysis.mentions ?? []).filter((mention) => mention?.text?.trim()) : [];
  const risks = v2 ? (analysis.risks ?? []).filter(Boolean) : [];
  return (
    <div className="mt-3 rounded-lg border border-ai/20 bg-ai-surface/50 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <AiBadge label="AI analysis" variant="soft" />
        {sentiment ? (
          <StatusBadge tone={SENTIMENT_TONE[sentiment] ?? "neutral"} size="sm">
            <span className="capitalize">{sentiment}</span>
          </StatusBadge>
        ) : null}
        {severity ? (
          <StatusBadge tone={SEVERITY_TONE[severity] ?? "neutral"} size="sm">
            <span className="capitalize">{severity}</span> severity
          </StatusBadge>
        ) : null}
        {v2 && analysis.emotion ? (
          <StatusBadge tone="neutral" size="sm">
            Feels {emotionLabel(analysis.emotion).toLowerCase()}
          </StatusBadge>
        ) : null}
        {v2 && analysis.asks_question ? (
          <StatusBadge tone="info" icon={CircleHelp} size="sm">
            Asks a question
          </StatusBadge>
        ) : null}
        {analysis.stale ? (
          <StatusBadge tone="warning" size="sm">
            The review changed since
          </StatusBadge>
        ) : null}
      </div>
      {analysis.summary ? <p className="mt-2 text-sm font-medium text-foreground">{analysis.summary}</p> : null}
      {mentions.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted-foreground">What they mentioned</p>
          <ul aria-label="What the reviewer mentioned" className="mt-1 flex flex-wrap gap-1.5">
            {mentions.map((mention, index) => {
              // "Complaint: prices have crept", not "… · complaint" again: the kind already says it.
              const feeling = mentionFeeling(mention);
              return (
                <li
                  key={`${mention.kind}-${mention.text}-${index}`}
                  className="inline-flex max-w-full items-start gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{mentionKindLabel(mention.kind)}:</span>
                  <span className="min-w-0 break-words">
                    {mention.service ? `${mention.text} (${mention.service})` : mention.text}
                    {feeling ? ` · ${feeling}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {risks.length > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-semibold">
            <AlertTriangle aria-hidden className="size-3.5 text-warning" /> Handle with care:
          </span>
          {risks.map((risk) => (
            <StatusBadge key={risk} tone="warning" size="sm">
              {riskLabel(risk)}
            </StatusBadge>
          ))}
        </p>
      ) : null}
      {analysis.suspicious_indicators.length > 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Suspicious indicators:</span> {analysis.suspicious_indicators.join("; ")}
        </p>
      ) : null}
      {analysis.recommended_action ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-ai" />
          <span>
            <span className="font-medium text-foreground">Suggested:</span> {analysis.recommended_action}
          </span>
        </p>
      ) : null}
    </div>
  );
}
