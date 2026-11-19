/**
 * Post writer v2 on screen (Phase 25c): what the checks found in a post's AI text, and how the AI wrote it.
 *
 * - `PostFindingsText`: the text with each finding's words highlighted while they are still in it. Must change
 *   (hard): red tint, solid underline; check (warn): amber tint, dashed underline; writing note: dotted
 *   underline. Each highlight carries its severity and message as text for screen readers (a hidden span after
 *   the words) and as a tooltip on hover; highlights are never tab stops (on a clamped card they could be cut off,
 *   and the same words are in the findings list), so colour is never the only signal.
 * - `PostFindingsList`: every finding as text, most serious first, with the quoted words (once: a message that
 *   already quotes them keeps its own); a finding whose words are gone is marked "Changed". `onShow` adds "Show
 *   in the text" (the editor selects the words in the box).
 * - `context` (the post as it is now): a hard finding that no longer blocks (the backend's standing rule) reads as
 *   one to check.
 * - `PostAiFacts`: a compact line: quality, the double-check, the keywords used, where the picture came from.
 */
import { Fragment, type ReactNode } from "react";
import { CheckCircle2, Info, OctagonX, PencilLine, ShieldAlert, ShieldCheck, ShieldQuestion, Tag, TriangleAlert, type LucideIcon } from "lucide-react";
import type { PostAi, PostAiFinding } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FINDING_SEVERITY_COPY,
  IMAGE_SOURCE_LABEL,
  POST_VERIFICATION_COPY,
  findingSegments,
  messageQuotesText,
  postVerification,
  qualityText,
  shownSeverity,
  sortFindings,
  type FindingSeverity,
  type PostVerification,
  type StandingContext,
} from "@/lib/posts/post-findings";
import { cn } from "@/lib/utils";

const SEVERITY_ICON: Record<FindingSeverity, LucideIcon> = { hard: OctagonX, warn: TriangleAlert, regenerate: PencilLine };
/** Icon colours (>= 3:1 on the card). */
const SEVERITY_ICON_TONE: Record<FindingSeverity, string> = { hard: "text-critical", warn: "text-warning", regenerate: "text-muted-foreground" };
/** Label colours (>= 4.5:1 on the card). */
const SEVERITY_TEXT_TONE: Record<FindingSeverity, string> = { hard: "text-critical", warn: "text-warning-foreground", regenerate: "text-muted-foreground" };
/** A tint and an underline whose style differs too (solid, dashed, dotted). */
const MARK_TONE: Record<FindingSeverity, string> = {
  hard: "bg-critical-surface underline decoration-critical decoration-2",
  warn: "bg-warning-surface underline decoration-warning decoration-dashed decoration-2",
  regenerate: "bg-transparent underline decoration-muted-foreground decoration-dotted decoration-[1.5px]",
};

/** The post's text with the findings' words highlighted. */
export function PostFindingsText({
  text,
  findings,
  context,
  className,
  clamp = false,
}: {
  text: string;
  findings: readonly PostAiFinding[];
  /** The post as it is now: a hard finding that no longer blocks reads as one to check. */
  context?: StandingContext | null;
  className?: string;
  /** Cut to four lines (cards). */
  clamp?: boolean;
}) {
  const segments = findingSegments(text, findings);
  return (
    <p className={cn("whitespace-pre-line break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]", clamp && "line-clamp-4", className)}>
      {segments.map((segment) => {
        const finding = segment.finding;
        if (!finding) return <Fragment key={segment.start}>{segment.text}</Fragment>;
        const severity = shownSeverity(finding, context);
        const copy = FINDING_SEVERITY_COPY[severity];
        return (
          <Tooltip key={segment.start}>
            <TooltipTrigger asChild>
              <mark className={cn("rounded-[3px] px-px text-foreground underline-offset-[3px] [box-decoration-break:clone]", MARK_TONE[severity])}>
                {segment.text}
                <span className="sr-only">
                  {" "}
                  ({copy.short}: {finding.message})
                </span>
              </mark>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <span className="font-semibold">{copy.label}:</span> {finding.message}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </p>
  );
}

/**
 * Every finding as text, most serious first. `text` is the post's current text: a finding whose words are no
 * longer in it shows as changed. `onShow` adds "Show in the text" to findings whose words are still there.
 */
export function PostFindingsList({
  findings,
  text,
  context,
  onShow,
  caption,
  className,
}: {
  findings: readonly PostAiFinding[];
  text: string;
  /** The post as it is now: a hard finding that no longer blocks reads as one to check. */
  context?: StandingContext | null;
  onShow?: (finding: PostAiFinding) => void;
  caption?: ReactNode;
  className?: string;
}) {
  if (findings.length === 0) return null;
  const rows = sortFindings(findings.map((finding) => ({ finding, severity: shownSeverity(finding, context) })));
  return (
    <div className={cn("min-w-0", className)}>
      {caption ? <p className="mb-1.5 text-xs text-muted-foreground">{caption}</p> : null}
      <ul aria-label="What the checks found" className="space-y-2">
        {rows.map(({ finding, severity }, index) => {
          const quote = finding.text?.trim();
          const changed = Boolean(quote) && !text.includes(finding.text ?? "");
          // The backend's grounding messages quote the words themselves: say them once.
          const ownQuote = quote && !messageQuotesText(finding) ? quote : null;
          const Icon = changed ? CheckCircle2 : SEVERITY_ICON[severity];
          return (
            <li key={`${finding.rule}-${finding.kind}-${index}`} className="flex min-w-0 gap-2">
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", changed ? "text-success" : SEVERITY_ICON_TONE[severity])} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
                  <span className={cn("font-semibold", changed ? "text-success" : SEVERITY_TEXT_TONE[severity])}>
                    {changed ? "Changed" : FINDING_SEVERITY_COPY[severity].label}
                  </span>
                  {ownQuote ? (
                    <span className={cn("min-w-0 break-words font-medium [overflow-wrap:anywhere]", changed ? "text-muted-foreground line-through" : "text-foreground")}>
                      “{ownQuote}”
                    </span>
                  ) : null}
                </p>
                <p className={cn("mt-0.5 break-words text-sm [overflow-wrap:anywhere]", changed ? "text-muted-foreground" : "text-foreground")}>{finding.message}</p>
                {onShow && quote && !changed ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 py-0.5 text-xs pointer-coarse:min-h-9"
                    onClick={() => onShow(finding)}
                  >
                    Show in the text
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const VERIFICATION_ICON: Record<PostVerification, LucideIcon> = { passed: ShieldCheck, flagged: ShieldAlert, unavailable: ShieldQuestion };

/** The AI double-check of the post's text. */
export function PostVerificationBadge({ verification, className }: { verification: PostVerification; className?: string }) {
  const copy = POST_VERIFICATION_COPY[verification];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <StatusBadge tone={copy.tone} icon={VERIFICATION_ICON[verification]} size="sm" className={className}>
            {copy.label}
          </StatusBadge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {copy.description}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * How the AI wrote the post, in one wrapping line: quality, the double-check, the keywords it used and where the
 * picture came from. Client users get a slim `ai` (no quality, verification or keywords): only what they have.
 */
export function PostAiFacts({ ai, showTopic = true, className }: { ai: PostAi; showTopic?: boolean; className?: string }) {
  const quality = qualityText(ai);
  const verification = postVerification(ai);
  const keywords = (ai.keywords_used ?? []).filter(Boolean);
  const source = ai.image?.source && ai.image.source !== "none" ? IMAGE_SOURCE_LABEL[ai.image.source] : null;
  const topic = showTopic ? ai.topic?.trim() : null;
  if (!quality && !verification && keywords.length === 0 && !source && !topic) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {topic ? (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1">
          <Info aria-hidden className="size-3.5 shrink-0" /> Topic: <span className="min-w-0 truncate font-medium text-foreground">{topic}</span>
        </span>
      ) : null}
      {quality ? <span className="font-medium text-foreground">{quality}</span> : null}
      {verification ? <PostVerificationBadge verification={verification} /> : null}
      {keywords.length ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Tag aria-hidden className="size-3.5 shrink-0" /> Keywords used: <span className="font-medium text-foreground">{keywords.join(", ")}</span>
        </span>
      ) : null}
      {source ? (
        <span>
          Picture: <span className="font-medium text-foreground">{source}</span>
        </span>
      ) : null}
    </div>
  );
}
