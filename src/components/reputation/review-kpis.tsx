import { CalendarDays, CheckCheck, MessageSquareDot, Send, Sparkles, Star } from "lucide-react";
import type { ReviewsSummary } from "@/api";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { useNow } from "@/hooks/use-now";
import { formatRelative } from "@/lib/datetime";
import { formatPercent, momentumTrend, noReplyCount, replyRate } from "@/lib/reviews/review-metrics";
import { useReviewMomentum } from "@/lib/reviews/use-reviews";
import { cn } from "@/lib/utils";
import { ReviewStars } from "./review-stars";

type Stats = NonNullable<ReviewsSummary["stats"]>;

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4";

/** "54 of 64 answered" with a thin bar: the reply rate as progress. */
function ReplyProgress({ stats }: { stats: Stats }) {
  const { rate, answered, total } = replyRate(stats);
  return (
    <div className="space-y-1.5">
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", rate !== null && rate >= 0.8 ? "bg-success" : "bg-primary")} style={{ width: `${(rate ?? 0) * 100}%` }} />
      </div>
      <p>
        <span className="tabular-nums">{answered.toLocaleString()}</span> of <span className="tabular-nums">{total.toLocaleString()}</span> answered
      </p>
    </div>
  );
}

function ReplyRateTile({ stats }: { stats: Stats }) {
  return <KpiTile label="Reply rate" icon={CheckCheck} tone="reputation" value={formatPercent(replyRate(stats).rate)} hint={<ReplyProgress stats={stats} />} />;
}

/** Reviews page: rating, new reviews in the last 30 days, reply rate and how many need a reply. */
export function ReviewKpis({ locationId, stats, onShowNeedsReply }: { locationId: string; stats: Stats; onShowNeedsReply?: () => void }) {
  const now = useNow(60_000);
  const momentum = useReviewMomentum(locationId);
  const recent = momentum.data;
  const trend = recent ? momentumTrend(recent) : undefined;

  return (
    <section aria-label="Review summary" className={GRID}>
      <KpiTile
        label="Rating"
        icon={Star}
        tone="reputation"
        value={stats.average_rating !== null ? stats.average_rating.toFixed(1) : "—"}
        hint={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ReviewStars value={stats.average_rating} />
            <span>
              {stats.total.toLocaleString()} {stats.total === 1 ? "review" : "reviews"}
            </span>
          </span>
        }
      />
      <KpiTile
        label="Last 30 days"
        icon={CalendarDays}
        tone="reputation"
        loading={momentum.isPending}
        value={recent ? `${recent.last30.toLocaleString()}${recent.capped ? "+" : ""}` : "—"}
        {...(trend ? { trend } : {})}
        hint={
          recent ? (
            trend && recent.previous30 !== null ? (
              `New reviews; ${recent.previous30.toLocaleString()} in the 30 days before`
            ) : recent.newestAt ? (
              <>
                New reviews; the newest <time dateTime={recent.newestAt}>{formatRelative(recent.newestAt, now)}</time>
              </>
            ) : (
              "New reviews"
            )
          ) : (
            "New reviews couldn't be counted."
          )
        }
      />
      <ReplyRateTile stats={stats} />
      {/* "Needs reply" is every review without a reply on Google (drafts included), as on the
          dashboard; "urgent" is the backend's awaiting_attention: unanswered at 1–3 stars or flagged. */}
      <KpiTile
        label="Needs reply"
        icon={MessageSquareDot}
        tone="reputation"
        value={stats.unreplied.toLocaleString()}
        hint={
          stats.unreplied === 0
            ? "Every review has a reply. Nice work."
            : stats.awaiting_attention > 0
              ? `${stats.awaiting_attention.toLocaleString()} urgent: 1–3 stars or flagged`
              : "None of them are urgent"
        }
        {...(onShowNeedsReply && stats.unreplied > 0 ? { onClick: onShowNeedsReply } : {})}
      />
    </section>
  );
}

/** AI Review Replies: reply rate, reviews waiting, drafts to check and replies sent this month. */
export function ReplyQueueKpis({
  stats,
  draftable,
  waiting: waitingCount,
  canEdit = true,
  onShowWaiting,
  onShowDrafts,
}: {
  stats: Stats;
  /** Reviews AI can draft now (`summary.ai.draftable`). */
  draftable: number;
  /** Reviews with no reply and no draft, when already counted by a list; otherwise derived from `stats`. */
  waiting?: number;
  /** `useCanEdit()`: false for a client user, whose agency drafts and sends (no "then send" for them). */
  canEdit?: boolean;
  onShowWaiting?: () => void;
  onShowDrafts?: () => void;
}) {
  const waiting = waitingCount ?? noReplyCount(stats);
  return (
    <section aria-label="Reply summary" className={GRID}>
      <ReplyRateTile stats={stats} />
      <KpiTile
        label="No reply yet"
        icon={MessageSquareDot}
        tone="reputation"
        value={waiting.toLocaleString()}
        hint={
          waiting === 0
            ? "Nothing waiting. Nice work."
            : draftable >= waiting
              ? "AI can draft every one of them"
              : `AI can draft ${draftable.toLocaleString()} of them`
        }
        {...(onShowWaiting && waiting > 0 ? { onClick: onShowWaiting } : {})}
      />
      <KpiTile
        label="Drafts to check"
        icon={Sparkles}
        tone="ai"
        value={stats.drafts_pending.toLocaleString()}
        hint={stats.drafts_pending === 0 ? "No drafts waiting" : canEdit ? "Read, edit if needed, then send" : "Waiting for your agency to send"}
        {...(onShowDrafts && stats.drafts_pending > 0 ? { onClick: onShowDrafts } : {})}
      />
      <KpiTile
        label="Sent this month"
        icon={Send}
        tone="reputation"
        value={stats.replies_sent_this_month.toLocaleString()}
        hint={stats.replies_sent_this_month === 1 ? "reply published on Google" : "replies published on Google"}
      />
    </section>
  );
}
