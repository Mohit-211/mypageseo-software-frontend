/**
 * Replies v2 (Phase 25a): what the reply checks found on a draft, and where the draft came from.
 *
 * - `DraftText`: the draft with each finding's words highlighted. Hard (can't be sent): red tint and a
 *   solid underline; warn (check before sending): amber tint and a dashed underline; writing note: a
 *   dotted underline. Each highlight can be focused, shows its finding on hover or focus, and points to
 *   its line in `DraftFindings` (`aria-describedby`), so colour is never the only signal.
 * - `DraftFindings`: every finding as text (icon, severity, the quoted words, the detail), most serious
 *   first; whole-text findings (span null) without a quote; findings only a send found are marked.
 * - `VerificationBadge`: the AI double-check of the AI's text (`draft.verification`).
 * - `DraftProvenance`: the keyword the reply uses and the "Change it" request it followed.
 * - `DraftNote`: a one-line note in a status colour (no public reply advised, last reply rejected…).
 */
import { Fragment, type ReactNode } from "react";
import {
  Info,
  OctagonX,
  PencilLine,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Tag,
  TriangleAlert,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import type { DraftCheckSeverity, DraftVerification, ReviewDraft } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DisplayCheck } from "@/lib/reviews/draft-view";
import { SEVERITY_COPY, VERIFICATION_COPY, checkDetailText, findingSourceLabel, highlightSegments } from "@/lib/reviews/reply-checks";
import { cn } from "@/lib/utils";

const SEVERITY_ICON: Record<DraftCheckSeverity, LucideIcon> = { hard: OctagonX, warn: TriangleAlert, regenerate: PencilLine };

/** Icon colours (>= 3:1 on the card). */
const SEVERITY_ICON_TONE: Record<DraftCheckSeverity, string> = { hard: "text-critical", warn: "text-warning", regenerate: "text-muted-foreground" };

/** Label colours (>= 4.5:1 on the card). */
const SEVERITY_TEXT_TONE: Record<DraftCheckSeverity, string> = { hard: "text-critical", warn: "text-warning-foreground", regenerate: "text-muted-foreground" };

/** The highlight per severity: a tint and an underline whose style differs too (solid, dashed, dotted). */
const MARK_TONE: Record<DraftCheckSeverity, string> = {
  hard: "bg-critical-surface underline decoration-critical decoration-2",
  warn: "bg-warning-surface underline decoration-warning decoration-dashed decoration-2",
  regenerate: "bg-transparent underline decoration-muted-foreground decoration-dotted decoration-[1.5px]",
};

/** A finding in plain words (the highlight's tooltip, the findings list and the "Send anyway?" dialog all show it). */
const detailOf = (check: DisplayCheck) => checkDetailText(check);

/** The draft as it would be sent, its findings highlighted. `findingId(i)` is the id of the i-th line of `DraftFindings`. */
export function DraftText({
  text,
  checks,
  findingId,
  className,
}: {
  text: string;
  checks: readonly DisplayCheck[];
  findingId?: (index: number) => string;
  className?: string;
}) {
  const segments = highlightSegments(text, checks);
  return (
    <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]", className)}>
      {segments.map((segment) => {
        const check = segment.check as DisplayCheck | null;
        if (!check) return <Fragment key={segment.start}>{segment.text}</Fragment>;
        const index = checks.indexOf(check);
        return (
          <Tooltip key={segment.start}>
            <TooltipTrigger asChild>
              <mark
                tabIndex={0}
                aria-describedby={findingId && index >= 0 ? findingId(index) : undefined}
                className={cn(
                  "rounded-[3px] px-px text-foreground underline-offset-[3px] outline-hidden [box-decoration-break:clone] focus-visible:ring-2 focus-visible:ring-ring",
                  MARK_TONE[check.severity],
                )}
              >
                {segment.text}
              </mark>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="font-semibold">{SEVERITY_COPY[check.severity].label}:</span> {detailOf(check)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </p>
  );
}

/** Every finding as text, most serious first (the list `DraftText`'s highlights point to). */
export function DraftFindings({
  checks,
  findingId,
  caption,
  className,
}: {
  checks: readonly DisplayCheck[];
  findingId?: (index: number) => string;
  /** A short line above the list, e.g. that it describes the saved text. */
  caption?: ReactNode;
  className?: string;
}) {
  if (checks.length === 0) return null;
  return (
    <div className={cn("min-w-0", className)}>
      {caption ? <p className="mb-1.5 text-xs text-muted-foreground">{caption}</p> : null}
      <ul aria-label="What the checks found" className="space-y-2">
        {checks.map((check, index) => {
          const Icon = SEVERITY_ICON[check.severity];
          const quote = check.span?.text?.trim();
          // Phase 25b: the judge's failed gates (facts, Google's rules, privacy, the change asked for) say so.
          const source = findingSourceLabel(check);
          return (
            <li key={`${check.rule}-${check.kind}-${check.span?.start ?? "all"}-${index}`} id={findingId?.(index)} className="flex min-w-0 gap-2">
              <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", SEVERITY_ICON_TONE[check.severity])} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
                  <span className={cn("font-semibold", SEVERITY_TEXT_TONE[check.severity])}>{SEVERITY_COPY[check.severity].label}</span>
                  {source ? <span className="text-muted-foreground">· {source}</span> : null}
                  {quote ? <span className="min-w-0 break-words font-medium text-foreground [overflow-wrap:anywhere]">“{quote}”</span> : null}
                  {check.atSend ? <span className="text-muted-foreground">· Found when sending</span> : null}
                </p>
                <p className="mt-0.5 break-words text-sm text-foreground">{detailOf(check)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const VERIFICATION_ICON: Record<DraftVerification, LucideIcon> = { passed: ShieldCheck, flagged: ShieldAlert, unavailable: ShieldQuestion };

/** The AI double-check of the AI's text: "Double-checked", "Flagged by the double-check" or "Not double-checked". */
export function VerificationBadge({ verification, className }: { verification: DraftVerification; className?: string }) {
  const copy = VERIFICATION_COPY[verification];
  return (
    <span title={copy.description} className={cn("inline-flex", className)}>
      <StatusBadge tone={copy.tone} icon={VERIFICATION_ICON[verification]} size="sm">
        {copy.label}
      </StatusBadge>
      <span className="sr-only">. {copy.description}</span>
    </span>
  );
}

/** Where the draft came from: the tracked keyword it uses, the "Change it" request it followed. Null when there's nothing to say. */
export function DraftProvenance({ draft, className }: { draft: ReviewDraft; className?: string }) {
  const keywords = (draft.keywords_used ?? []).filter((keyword) => keyword.trim());
  const instructions = draft.instructions?.trim();
  if (keywords.length === 0 && !instructions) return null;
  return (
    <ul aria-label="About this draft" className={cn("flex flex-wrap gap-1.5", className)}>
      {keywords.map((keyword) => (
        <li
          key={keyword}
          className="inline-flex max-w-full items-start gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          <Tag aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 break-words">
            Uses your keyword: <span className="font-medium text-foreground">{keyword}</span>
          </span>
        </li>
      ))}
      {instructions ? (
        <li className="inline-flex max-w-full items-start gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground">
          <WandSparkles aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            Changed as asked: <span className="text-foreground">“{instructions}”</span>
          </span>
        </li>
      ) : null}
    </ul>
  );
}

const NOTE_TONE = {
  info: { box: "border-info/25 bg-info-surface", icon: "text-info" },
  warning: { box: "border-warning/35 bg-warning-surface", icon: "text-warning" },
  critical: { box: "border-critical/25 bg-critical-surface", icon: "text-critical" },
  neutral: { box: "border-border bg-card", icon: "text-muted-foreground" },
} as const;

const NOTE_ICON: Record<keyof typeof NOTE_TONE, LucideIcon> = { info: Info, warning: TriangleAlert, critical: OctagonX, neutral: Info };

/** A short note in a status colour, with an icon (the text stays in ink). `role="alert"` for a message that just appeared. */
export function DraftNote({
  tone = "info",
  icon,
  role,
  children,
  className,
}: {
  tone?: keyof typeof NOTE_TONE;
  icon?: LucideIcon;
  role?: "alert" | "status";
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon ?? NOTE_ICON[tone];
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm text-foreground", NOTE_TONE[tone].box, className)}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", NOTE_TONE[tone].icon)} />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}
