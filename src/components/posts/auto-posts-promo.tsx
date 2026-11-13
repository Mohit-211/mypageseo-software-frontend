import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Repeat } from "lucide-react";
import { StatusBadge } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { Button } from "@/components/ui/button";
import { useAiStatus } from "@/lib/ai/ai-status";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatPostMoment } from "@/lib/posts/post-format";
import { PLANNER_PAUSED_TITLE, autoPostsState, plannerPausedReason, seriesProblem } from "@/lib/posts/series-planner";
import { usePostSeries } from "@/lib/posts/use-posts";

/**
 * A slim AI card on the Posts page: whether auto-posts run for this location, when the next AI post
 * is due, and a way into AI Posts, where auto-posts now live (they used to be a tab here).
 *
 * Phase 25a: while the server's planner writes nothing for the account (`planner` isn't `on`), it says
 * "Automatic AI posts are paused" and why, never a next AI post.
 */
export function AutoPostsPromo({ locationId, gbpConnected = true }: { locationId: string; gbpConnected?: boolean }) {
  const ai = useAiStatus(locationId);
  const list = usePostSeries(locationId);
  const series = list.data?.series ?? [];
  const { active, pausedBy, nextSlot: next } = autoPostsState(series);
  const problems = series.filter((entry) => seriesProblem(entry)).length;
  const running = active.length > 0;

  return (
    <section
      aria-label="Auto-posts"
      className="flex flex-col gap-3 rounded-xl border border-ai/20 bg-ai-surface px-4 py-3.5 shadow-card sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconChip icon={Repeat} tone="ai" className="mt-0.5" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {running ? (pausedBy ? PLANNER_PAUSED_TITLE : "Auto-posts are on") : gbpConnected ? "Let AI keep your profile active" : "AI can post for you once Google is connected"}
            {ai.state === "off" ? (
              <StatusBadge tone="ai" size="sm">
                AI almost ready
              </StatusBadge>
            ) : null}
            {problems > 0 ? (
              <StatusBadge tone="warning" icon={AlertTriangle} size="sm">
                {problems === 1 ? "1 series needs attention" : `${problems} series need attention`}
              </StatusBadge>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">
            {running
              ? pausedBy
                ? `${plannerPausedReason(pausedBy)} ${active.length === 1 ? "Your series is saved." : `Your ${active.length} series are saved.`}`
                : `${active.length === 1 ? "1 series" : `${active.length} series`} running${next ? ` · next AI post ${formatPostMoment(next, { weekday: true })}` : ""}.`
              : gbpConnected
                ? "Choose days and topics once. AI writes each post in your voice and publishes it on schedule."
                : "Meanwhile, AI Posts can suggest ideas and write drafts for you to publish later."}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 self-start text-ai hover:border-ai/40 hover:bg-card hover:text-ai sm:self-center">
        <Link to={locationPath(locationId, "ai/posts", gbpConnected || running || problems > 0 ? "#auto" : "#ideas")}>
          {running || problems > 0 ? "Manage in AI Posts" : gbpConnected ? "Set up auto-posts" : "Open AI Posts"} <ArrowRight aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
