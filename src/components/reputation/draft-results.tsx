/**
 * What a "Draft selected", "Draft all" page or Analyze left undone (Phase 25b, 2026-11-17): "6 replies drafted ·
 * 2 not drafted", then the reviews the AI skipped, grouped by why, in plain words: not written in time (`deadline`:
 * "Draft them again"), the AI couldn't write a usable reply (`ai_failed`: try again), AI paused or off, changed by
 * someone meanwhile (`draft_changed`), and the old reasons. A run that stopped part way (a 402 after earlier
 * requests worked) says why, with what wasn't tried and, for the 402, the next step by role: "Buy tokens" for the
 * owner, "Ask the account owner to add tokens." for anyone else (as the toast of a 402 at once does). Shown in place
 * of a toast until dismissed; it takes focus when a new result arrives.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Coins, PencilLine, RotateCw, Sparkles, X, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { draftRunTitle, type DraftRunResult, type DraftSkipGroup, type DraftSkipKey } from "@/lib/reviews/draft-results";
import { outOfTokensNextStep } from "@/lib/reviews/review-errors";
import { cn } from "@/lib/utils";
import { ReviewStars } from "./review-stars";

const GROUP_ICON: Partial<Record<DraftSkipKey, LucideIcon>> = {
  deadline: Clock,
  ai_failed: AlertTriangle,
  ai_paused: Sparkles,
  ai_off: Sparkles,
  draft_changed: PencilLine,
};

/** Reviews listed per group before "Show N more". */
const VISIBLE = 4;

export function DraftResultsPanel({
  result,
  stoppedText,
  onRetry,
  retrying = false,
  onOpenReview,
  onDismiss,
  footer,
  className,
}: {
  result: DraftRunResult;
  /** Why the run stopped part way (`result.stopped`), in words, when it did. */
  stoppedText?: string | null;
  /** "Draft them again" for the reviews worth another try (`result.retryIds`); hidden without it. */
  onRetry?: ((ids: string[]) => void) | undefined;
  retrying?: boolean;
  /** "Open it": scrolls to the review or pins it (`?review=`). */
  onOpenReview?: ((reviewId: string) => void) | undefined;
  onDismiss: () => void;
  /** Extra lines under the groups (e.g. "Continue drafts them again"). */
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const canBuyTokens = useAccess().can("billing.manage");
  // A 402 stopped the run part way: "Buy tokens", or whom to ask.
  const nextStep = stoppedText ? outOfTokensNextStep(result.stopped, canBuyTokens) : null;
  const notDone = result.groups.reduce((sum, group) => sum + group.items.length, 0) + result.notTried.length;
  const verb = result.kind === "analyze" ? "analyzed" : "drafted";
  const title = notDone > 0 ? `${draftRunTitle(result)} · ${notDone.toLocaleString()} not ${verb}` : draftRunTitle(result);
  const retryable = onRetry && result.retryIds.length > 0;

  // A new result: bring it into view and move focus to it (the button that started it may be gone).
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    panel.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    panel.focus({ preventScroll: true });
  }, [result]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        "min-w-0 scroll-mt-24 overflow-hidden rounded-xl border bg-card text-left shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        notDone === 0 ? "border-success/30" : "border-warning/45",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span
          aria-hidden
          className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", notDone === 0 ? "bg-success-surface text-success" : "bg-warning-surface text-warning-foreground")}
        >
          {notDone === 0 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-[15px] font-semibold leading-6 text-foreground">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {result.kind === "analyze"
              ? "Each analysis shows on its review."
              : result.done > 0
                ? "Check the new drafts below, then send them."
                : "Nothing new to check yet."}
            {notDone > 0 ? ` ${notDone === 1 ? "The one not done is" : "The ones not done are"} below, with why.` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label="Close the results" onClick={onDismiss}>
          <X aria-hidden />
        </Button>
      </div>

      {result.groups.length > 0 ? (
        <div className="divide-y divide-border">
          {result.groups.map((group) => (
            <SkipGroup key={group.key} group={group} onOpenReview={onOpenReview} />
          ))}
        </div>
      ) : null}

      {stoppedText || result.notTried.length > 0 || retryable || footer ? (
        <div className="space-y-2 border-t border-border bg-muted/40 px-4 py-3 text-sm">
          {stoppedText ? (
            <div className="flex items-start gap-1.5 text-foreground">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0 space-y-2">
                <p>
                  {stoppedText}
                  {result.notTried.length > 0 ? ` ${result.notTried.length.toLocaleString()} ${result.notTried.length === 1 ? "review wasn't" : "reviews weren't"} tried.` : ""}
                  {nextStep?.kind === "ask" ? ` ${nextStep.text}` : ""}
                </p>
                {nextStep?.kind === "buy" ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={nextStep.href}>
                      <Coins aria-hidden /> {nextStep.label}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {footer}
          {retryable ? (
            <Button size="sm" variant="ai" disabled={retrying} aria-busy={retrying || undefined} onClick={() => onRetry(result.retryIds)}>
              <RotateCw aria-hidden className={cn(retrying && "animate-spin motion-reduce:animate-none")} />
              {result.kind === "analyze" ? "Analyze" : "Draft"} {result.retryIds.length === 1 ? "it" : "them"} again
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SkipGroup({ group, onOpenReview }: { group: DraftSkipGroup; onOpenReview?: ((reviewId: string) => void) | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const headingId = useId();
  const shown = expanded ? group.items : group.items.slice(0, VISIBLE);
  const hidden = group.items.length - shown.length;
  const Icon = GROUP_ICON[group.key];
  return (
    <section aria-labelledby={headingId} className="px-4 py-3">
      <h4 id={headingId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
        <StatusBadge tone={group.tone} size="sm" {...(Icon ? { icon: Icon } : {})}>
          {group.items.length.toLocaleString()}
        </StatusBadge>
        <span className="min-w-0">{group.title}</span>
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{group.hint}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {shown.map((item) => (
          <li key={item.reviewId}>
            {onOpenReview ? (
              <button
                type="button"
                onClick={() => onOpenReview(item.reviewId)}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-left text-xs font-medium text-foreground outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 break-words">{item.reviewer}</span>
                <ReviewStars value={item.rating} />
                <span className="sr-only">: open the review</span>
              </button>
            ) : (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">
                <span className="min-w-0 break-words">{item.reviewer}</span>
                <ReviewStars value={item.rating} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <Button variant="ghost" size="sm" className="mt-1.5 -ml-2" onClick={() => setExpanded(true)}>
          Show {hidden.toLocaleString()} more
        </Button>
      ) : null}
    </section>
  );
}
