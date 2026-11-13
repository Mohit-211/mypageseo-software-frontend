/**
 * Where a review's reply stands (Phase 25a adds Google's moderation and reviews deleted on Google):
 * - `ReplyStateBadge`: one pill: Replied, Waiting for Google, Rejected by Google, Not sent, a draft,
 *   Needs reply, or Deleted on Google.
 * - `ReplyOnGoogle`: the reply people see (`sent`) or will see once Google approves it (`pending`).
 * - `RejectedReply`: the reply Google rejected (not public) with Google's reason.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Ban, Check, CornerDownRight, EyeOff, Hourglass, MessageSquare, PenLine, Sparkles } from "lucide-react";
import type { Review } from "@/api";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { formatDateTime } from "@/lib/datetime";
import { whenLabel } from "@/lib/reviews/draft-view";
import { REPLY_STATE_COPY } from "@/lib/reviews/reply-checks";
import { SENT_REPLIES_NOTE } from "@/lib/reviews/send-results";
import { cn } from "@/lib/utils";

/** Where the reply stands, as one pill. Suspicious reviews skip "Needs reply": they should be reported, not answered. */
export function ReplyStateBadge({ review, aiDraft }: { review: Review; aiDraft: boolean }) {
  if (review.deleted_on_google_at) {
    return (
      <StatusBadge tone="neutral" icon={EyeOff} size="sm">
        Deleted on Google
      </StatusBadge>
    );
  }
  switch (review.reply_state) {
    case "sent":
      return (
        <StatusBadge tone="success" icon={Check} size="sm">
          Replied
        </StatusBadge>
      );
    case "pending":
    case "rejected": {
      const copy = REPLY_STATE_COPY[review.reply_state];
      return (
        <StatusBadge tone={copy?.tone ?? "info"} icon={review.reply_state === "pending" ? Hourglass : Ban} size="sm">
          {copy?.label ?? (review.reply_state === "pending" ? "Waiting for Google" : "Rejected by Google")}
        </StatusBadge>
      );
    }
    case "failed":
      return (
        <StatusBadge tone="critical" icon={AlertTriangle} size="sm">
          Not sent
        </StatusBadge>
      );
    case "draft":
      return aiDraft ? (
        <StatusBadge tone="ai" icon={Sparkles} size="sm">
          AI draft ready
        </StatusBadge>
      ) : (
        <StatusBadge tone="info" icon={PenLine} size="sm">
          Draft saved
        </StatusBadge>
      );
    default:
      return review.flag_level === "suspicious" ? null : (
        <StatusBadge tone="warning" icon={MessageSquare} size="sm">
          Needs reply
        </StatusBadge>
      );
  }
}

/**
 * The reply on Google. `pending`: Google reviews every reply before it shows, so it says so; otherwise
 * the published reply. `children`: actions under it (e.g. "Edit reply").
 */
export function ReplyOnGoogle({
  review,
  text,
  now,
  children,
  className,
}: {
  review: Review;
  text: string;
  now?: number;
  children?: ReactNode;
  className?: string;
}) {
  const pending = review.reply_state === "pending";
  const at = review.sent_at ?? (typeof review.reply === "object" ? (review.reply?.update_time ?? null) : null);
  return (
    <div className={cn("mt-4", className)}>
      <div className={cn("rounded-lg border-l-[3px] px-3.5 py-2.5", pending ? "border-info/70 bg-info-surface" : "border-primary/60 bg-surface-strong")}>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-foreground">
          {pending ? <Hourglass aria-hidden className="size-3.5 text-info" /> : <CornerDownRight aria-hidden className="size-3.5 text-primary" />}
          {pending ? "Your reply is waiting for Google" : "Your reply"}
          {at ? (
            <time dateTime={at} title={formatDateTime(at)} className="font-normal text-muted-foreground">
              · {pending ? "sent " : ""}
              {whenLabel(at, now)}
            </time>
          ) : null}
        </p>
        {pending ? <p className="mt-1 text-xs text-muted-foreground">{SENT_REPLIES_NOTE}</p> : null}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{text}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The reply Google rejected: not public, the review counts as unanswered. `children`: "Write a new reply"
 * actions; `canReply` false (a read-only user) leaves out the line that asks for a new reply.
 */
export function RejectedReply({
  rejected,
  canReply = true,
  children,
  className,
}: {
  rejected: { text: string | null; reason: string | null; checkedAt: string | null };
  canReply?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-4 rounded-lg border border-critical/25 bg-critical-surface/70 px-3.5 py-3", className)}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-semibold text-foreground">
        <Ban aria-hidden className="size-4 text-critical" />
        Google rejected your reply
        {rejected.checkedAt ? (
          <time dateTime={rejected.checkedAt} title={formatDateTime(rejected.checkedAt)} className="text-xs font-normal text-muted-foreground">
            · {formatDateTime(rejected.checkedAt, "")}
          </time>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-foreground">
        <span className="font-medium">Google's reason:</span> {rejected.reason ?? "Google didn't say why."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        It isn't public, so the review still counts as unanswered.{canReply ? " Write a new reply and send it." : ""}
      </p>
      {rejected.text ? (
        <figure className="mt-2.5 rounded-md border border-border bg-card px-3 py-2">
          <figcaption className="text-xs font-medium text-muted-foreground">The rejected reply</figcaption>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{rejected.text}</p>
        </figure>
      ) : null}
      {children}
    </div>
  );
}
