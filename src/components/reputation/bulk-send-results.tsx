import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleX,
  Clock,
  Eye,
  FileX,
  History,
  Info,
  LifeBuoy,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
  Repeat2,
  SearchX,
  Send,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { SENT_REPLIES_NOTE, sendSummaryTitle, type SendGroup, type SendGroupKey, type SendIssue, type SendSummary } from "@/lib/reviews/send-results";
import { cn } from "@/lib/utils";
import { ReviewStars } from "./review-stars";

const GROUP_ICON: Record<SendGroupKey, LucideIcon> = {
  checks_failed: Ban,
  needs_review: Eye,
  reply_changed_on_google: MessageSquareWarning,
  draft_predates_reply: History,
  replaces_published_reply: Repeat2,
  deadline: Clock,
  failed: CircleX,
  deleted_on_google: Trash2,
  no_draft: FileX,
  not_found: SearchX,
  other: Info,
};

/** Where a suspended or misconfigured account goes for help (as the AI copy deck). */
const SUPPORT_PATH = "/support?new=1";

/** Reviews listed per group before "Show N more". */
const VISIBLE = 5;

/**
 * What happened to a send of several replies ("Send all", "Send selected"): "Sent 12 · Skipped 3",
 * then the reviews that weren't sent, grouped by what to do next in plain words, each with the
 * reviewer, the rating, what a check found (or what Google has) and "Open it" (scrolls to the card,
 * or pins it above the list). Shown in place of a toast until dismissed; it takes focus when a new
 * result arrives, so it's read even after the selection bar that started it has gone.
 *
 * 2026-11-17: replies Google was too slow for (`deadline`) get "Send the rest", which sends exactly
 * those again; failed sends offer Reconnect Google or contact support when their `code` says so.
 */
export function BulkSendResults({
  summary,
  onOpenReview,
  onSendRest,
  sendingRest = false,
  onDismiss,
  className,
}: {
  summary: SendSummary;
  /** "Open it": the page scrolls to the review or pins it (`?review=`). Without it, no button. */
  onOpenReview?: ((reviewId: string) => void) | undefined;
  /** "Send the rest": sends the reviews skipped as `deadline` again (`summary.resendIds`). Without it, no button. */
  onSendRest?: ((ids: string[]) => void) | undefined;
  sendingRest?: boolean;
  onDismiss: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const titleId = useId();
  const issues = summary.skipped + summary.failed;
  const critical = summary.groups.some((group) => group.tone === "critical");

  // A new result: bring it into view and move focus to it (the button that sent may be gone).
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    panel.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    panel.focus({ preventScroll: true });
  }, [summary]);

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        "min-w-0 scroll-mt-24 overflow-hidden rounded-xl border bg-card text-left shadow-card outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        issues === 0 ? "border-success/30" : critical ? "border-critical/30" : "border-warning/45",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
            issues === 0 ? "bg-success-surface text-success" : critical ? "bg-critical-surface text-critical" : "bg-warning-surface text-warning-foreground",
          )}
        >
          {issues === 0 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-[15px] font-semibold leading-6 text-foreground">
            {sendSummaryTitle(summary)}
          </h3>
          <p className="text-sm text-muted-foreground">
            {summary.sent > 0 ? SENT_REPLIES_NOTE : "Nothing was sent to Google."}
            {issues > 0 ? ` ${issues === 1 ? "The one not sent is" : "The ones not sent are"} below, with what to do.` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label="Close the results" onClick={onDismiss}>
          <X aria-hidden />
        </Button>
      </div>

      {summary.groups.length > 0 ? (
        <div className="divide-y divide-border">
          {summary.groups.map((group) => (
            <ResultGroup
              key={group.key}
              group={group}
              onOpenReview={onOpenReview}
              onSendRest={group.key === "deadline" && summary.resendIds.length > 0 ? onSendRest : undefined}
              resendIds={summary.resendIds}
              sendingRest={sendingRest}
            />
          ))}
        </div>
      ) : null}

      {summary.interrupted || summary.unchecked > 0 ? (
        <div className="space-y-1.5 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          {summary.interrupted ? (
            <p className="flex items-start gap-1.5 text-critical">
              <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{summary.interrupted}</span>
            </p>
          ) : null}
          {summary.unchecked > 0 ? (
            <p className="flex items-start gap-1.5">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                The automatic content check couldn't run on {summary.unchecked === 1 ? "one of the sent replies" : `${summary.unchecked.toLocaleString()} of the sent replies`}. Nothing else
                held {summary.unchecked === 1 ? "it" : "them"} back, so {summary.unchecked === 1 ? "it was" : "they were"} sent.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ResultGroup({
  group,
  onOpenReview,
  onSendRest,
  resendIds,
  sendingRest,
}: {
  group: SendGroup;
  onOpenReview?: ((reviewId: string) => void) | undefined;
  onSendRest?: ((ids: string[]) => void) | undefined;
  resendIds: string[];
  sendingRest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { connect } = useGbpConnect();
  const headingId = useId();
  const shown = expanded ? group.items : group.items.slice(0, VISIBLE);
  const hidden = group.items.length - shown.length;
  return (
    <section aria-labelledby={headingId} className="px-4 py-3">
      <h4 id={headingId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
        <StatusBadge tone={group.tone} icon={GROUP_ICON[group.key]} size="sm">
          {group.items.length.toLocaleString()}
        </StatusBadge>
        <span className="min-w-0">{group.title}</span>
      </h4>
      {group.hint ? <p className="mt-1 text-xs text-muted-foreground">{group.hint}</p> : null}
      <ul className="mt-2.5 space-y-2">
        {shown.map((item) => (
          <ResultRow key={item.reviewId} item={item} group={group} onOpenReview={group.openable ? onOpenReview : undefined} />
        ))}
      </ul>
      {hidden > 0 ? (
        <Button variant="ghost" size="sm" className="mt-1.5 -ml-2" onClick={() => setExpanded(true)}>
          Show {hidden.toLocaleString()} more
        </Button>
      ) : null}
      {onSendRest || group.actions.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {onSendRest ? (
            <Button size="sm" disabled={sendingRest} aria-busy={sendingRest || undefined} onClick={() => onSendRest(resendIds)}>
              {sendingRest ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <Send aria-hidden />}
              Send the rest ({resendIds.length.toLocaleString()})
            </Button>
          ) : null}
          {group.actions.includes("reconnect") ? (
            <Button size="sm" variant="outline" onClick={() => connect()}>
              <RefreshCw aria-hidden /> Reconnect Google
            </Button>
          ) : null}
          {group.actions.includes("support") ? (
            <Button asChild size="sm" variant="outline">
              <Link to={SUPPORT_PATH}>
                <LifeBuoy aria-hidden /> Contact support
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ResultRow({ item, group, onOpenReview }: { item: SendIssue; group: SendGroup; onOpenReview?: ((reviewId: string) => void) | undefined }) {
  const google = group.key === "reply_changed_on_google" || group.key === "draft_predates_reply";
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
          <span className="min-w-0 break-words">{item.reviewer}</span>
          <ReviewStars value={item.rating} />
        </p>
        {item.detail ? (
          <p className="text-sm text-foreground">
            {item.detail}
            {item.moreFindings > 0 ? <span className="text-muted-foreground"> {item.moreFindings === 1 ? "And 1 more note." : `And ${item.moreFindings} more notes.`}</span> : null}
          </p>
        ) : null}
        {item.quote ? (
          <p className="text-sm text-muted-foreground">
            {google ? "Google's reply: " : "In the draft: "}
            <q className={cn("text-foreground", google && "line-clamp-3")}>{item.quote}</q>
          </p>
        ) : null}
      </div>
      {onOpenReview ? (
        <Button size="sm" variant="outline" className="shrink-0 self-start" onClick={() => onOpenReview(item.reviewId)}>
          Open it<span className="sr-only">: the review by {item.reviewer}</span>
        </Button>
      ) : null}
    </li>
  );
}
