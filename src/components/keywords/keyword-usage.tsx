import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquareReply, PenLine, TrendingUp, type LucideIcon } from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import type { StatusTone } from "@/components/layout/shared/module-tone";
import type { ModuleTone } from "@/components/layout/shared/module-tone";
import type { AiStatus } from "@/lib/ai/ai-status";
import { aiPostsPath, aiRepliesPath } from "@/lib/keywords/paths";
import { KEYWORD_USAGE, USAGE_COPY } from "@/lib/keywords/usage-rules";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatRunDate } from "@/lib/rankings/format";
import { cn } from "@/lib/utils";

/** A status pill for an AI tile from the shared AI status. */
function aiPill(ai: Pick<AiStatus, "state" | "blockedBy">, gbpConnected: boolean, needs: string): { tone: StatusTone; label: string } | null {
  // A client user doesn't run AI: no availability pill that reads like an invitation.
  if (ai.blockedBy === "role") return null;
  if (!gbpConnected) return { tone: "warning", label: needs };
  if (ai.state === "off") return { tone: "ai", label: "AI almost ready" };
  if (ai.state === "paused") return { tone: "ai", label: "AI paused today" };
  if (ai.state === "ready") return { tone: "success", label: "Ready" };
  return null;
}

/**
 * "Used by": the three modules that read this location's keywords, with today's rules in plain
 * words (from `usage-rules.ts`, the one source) and a way into each module.
 */
export function KeywordUsageStrip({
  locationId,
  keywords,
  gridSize,
  ai,
  gbpConnected,
  setupRequired,
  rankingActive,
  nextAutomaticRun,
}: {
  locationId: string;
  /** Tracked keywords in the saved order. */
  keywords: readonly string[];
  gridSize: number | null;
  ai: Pick<AiStatus, "state" | "blockedBy">;
  gbpConnected: boolean;
  setupRequired: boolean;
  rankingActive: boolean;
  nextAutomaticRun: string | null;
}) {
  const defaults = keywords.slice(0, KEYWORD_USAGE.postDefaultCount);
  const rankPill: { tone: StatusTone; label: string } | null = setupRequired
    ? { tone: "warning", label: "Starts after setup" }
    : rankingActive
      ? { tone: "info", label: "Measuring now" }
      : nextAutomaticRun
        ? { tone: "neutral", label: `Next run ${formatRunDate(nextAutomaticRun)}` }
        : null;

  return (
    <section aria-labelledby="keyword-usage-title">
      <h2 id="keyword-usage-title" className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        Used by
        <span className="text-sm font-normal text-muted-foreground">Your keywords power three parts of MyPageSEO.</span>
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        <UsageTile
          icon={TrendingUp}
          tone="rankings"
          title={USAGE_COPY.rankings.title}
          to={locationPath(locationId, "rankings")}
          cta="Open Rank Overview"
          pill={rankPill}
        >
          {USAGE_COPY.rankings.summary(gridSize)}
        </UsageTile>
        <UsageTile
          icon={PenLine}
          tone="ai"
          title={USAGE_COPY.posts.title}
          to={aiPostsPath(locationId)}
          cta="Open AI Posts"
          pill={aiPill(ai, gbpConnected, "Connect Google to post")}
        >
          {USAGE_COPY.posts.summary(defaults)}
        </UsageTile>
        <UsageTile
          icon={MessageSquareReply}
          tone="ai"
          title={USAGE_COPY.replies.title}
          to={aiRepliesPath(locationId)}
          cta="Open AI Review Replies"
          pill={aiPill(ai, gbpConnected, "Connect Google to reply")}
        >
          {USAGE_COPY.replies.summary}
        </UsageTile>
      </ul>
    </section>
  );
}

function UsageTile({
  icon,
  tone,
  title,
  to,
  cta,
  pill,
  children,
}: {
  icon: LucideIcon;
  tone: ModuleTone;
  title: string;
  to: string;
  cta: string;
  pill: { tone: StatusTone; label: string } | null;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "group relative flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-card",
        "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="flex items-start gap-3">
        <IconChip icon={icon} tone={tone} size="md" />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-1.5">
          <h3 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h3>
          {pill ? (
            <StatusBadge tone={pill.tone} size="sm" dot>
              {pill.label}
            </StatusBadge>
          ) : null}
        </div>
      </div>
      {/* Phones: a short row each (the whole tile stays the link); the rules show from tablets up and in the keyword sheet. */}
      <p className="mt-3 flex-1 text-sm text-muted-foreground max-md:hidden">{children}</p>
      <Link
        to={to}
        className="mt-3 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-semibold text-primary outline-hidden after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-primary-hover focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
      >
        {cta}
        <ArrowRight aria-hidden className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
