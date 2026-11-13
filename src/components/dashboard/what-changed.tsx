import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileBarChart,
  History,
  ListChecks,
  MessageSquareReply,
  Star,
  Swords,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { STATUS_TONE_CLASSES, type StatusTone } from "@/components/layout/shared/module-tone";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import type { AgencyDashboardModel, BusinessDashboardModel } from "@/lib/dashboard/dashboard-data";
import type { KeywordMove } from "@/lib/dashboard/focus-data";
import { plural, signed } from "@/lib/dashboard/format";
import { urgentReplyLink, type WritingMode } from "@/lib/dashboard/replies";
import { keywordsPath } from "@/lib/keywords/paths";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useWhiteLabelAccess } from "@/lib/white-label/access";
import { cn } from "@/lib/utils";

const ROW_LINK =
  "group flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 -mx-2 outline-hidden transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring";

function Card({ description, children, className }: { description: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby="what-changed-title" className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card shadow-card", className)}>
      <header className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <IconChip icon={History} tone="dashboard" size="md" className="-mt-0.5" />
        <div className="min-w-0">
          <h2 id="what-changed-title" className="text-[15px] font-semibold leading-6 text-foreground">
            What changed
          </h2>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-5 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function GroupTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {count ? <span className="rounded-full bg-muted px-1.5 text-xs font-semibold normal-case tracking-normal text-muted-foreground">{count}</span> : null}
    </h3>
  );
}

/** One line of the digest: a small status icon and a sentence, optionally a link. */
function DigestLine({ icon: Icon, tone, children, to }: { icon: LucideIcon; tone: StatusTone; children: ReactNode; to?: string }) {
  const body = (
    <>
      <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-md", STATUS_TONE_CLASSES[tone].chip)}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-foreground">{children}</span>
      {to ? <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" /> : null}
    </>
  );
  return <li>{to ? <Link to={to} className={ROW_LINK}>{body}</Link> : <div className="flex items-center gap-3 py-2">{body}</div>}</li>;
}

/* ----------------------------------------------------------------------- business -- */

/** Keyword movement in the latest check as one thin bar: green up, grey same, amber down. */
function MovementBar({ improved, unchanged, declined }: { improved: number; unchanged: number; declined: number }) {
  const total = improved + unchanged + declined;
  if (total === 0) return null;
  const parts = [
    { key: "improved", value: improved, label: "improved", bar: "bg-success", dot: "bg-success" },
    { key: "unchanged", value: unchanged, label: "unchanged", bar: "bg-border-strong", dot: "bg-border-strong" },
    { key: "declined", value: declined, label: "declined", bar: "bg-warning", dot: "bg-warning" },
  ];
  return (
    <div>
      <GroupTitle>Keywords in the latest check</GroupTitle>
      <div
        role="img"
        aria-label={`${improved} keywords improved, ${unchanged} unchanged, ${declined} declined`}
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {parts.map((part) =>
          part.value > 0 ? <span key={part.key} className={cn("h-full first:rounded-l-full last:rounded-r-full", part.bar)} style={{ width: `${(part.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((part) => (
          <li key={part.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", part.dot)} />
            <span className="font-semibold tabular-nums text-foreground">{part.value}</span> {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoveRow({ move, locationId }: { move: KeywordMove; locationId: string }) {
  const up = move.change !== null ? move.change > 0 : move.note === "New in top 60";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <li>
      {/* Opens the keyword, over the Keywords table sorted by change (where the other moves are). */}
      <Link to={keywordsPath(locationId, { keyword: move.keyword, sort: "change" })} className={ROW_LINK}>
        <span
          className={cn(
            "inline-flex min-w-14 shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            up ? "bg-success-surface text-success" : "bg-warning-surface text-warning-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          <span className="sr-only">{up ? "Up" : "Down"}: </span>
          {move.change !== null ? Math.abs(move.change).toFixed(1) : up ? "New" : "Out"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground group-hover:text-primary">{move.keyword}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {move.note ?? <>now {move.rankText}</>}
        </span>
      </Link>
    </li>
  );
}

/**
 * The business digest: keyword movement, the biggest moves (one location in view) and the other
 * changes worth knowing, each linking to where it's explained.
 */
export function BusinessWhatChanged({
  model,
  moves,
  focusId,
  className,
}: {
  model: BusinessDashboardModel;
  moves: { up: KeywordMove[]; down: KeywordMove[] } | null;
  focusId: string | null;
  className?: string;
}) {
  const lines: ReactNode[] = [];
  const { rank, reviews, profile, citations, keyCompetitor } = model;
  if (rank?.change) {
    const better = rank.change > 0;
    lines.push(
      <DigestLine key="rank" icon={better ? TrendingUp : TrendingDown} tone={better ? "success" : "warning"} {...(focusId ? { to: locationPath(focusId, "rankings") } : {})}>
        Average rank {better ? "improved" : "slipped"} by <strong className="font-semibold">{Math.abs(rank.change).toFixed(1)}</strong> {Math.abs(rank.change) === 1 ? "place" : "places"}
      </DigestLine>,
    );
  }
  if (reviews?.available && reviews.newInRange) {
    lines.push(
      <DigestLine key="reviews" icon={Star} tone="success" {...(focusId ? { to: locationPath(focusId, "reputation") } : {})}>
        <strong className="font-semibold">{signed(reviews.newInRange)}</strong> new {reviews.newInRange === 1 ? "review" : "reviews"} in the last {model.rangeDays} days
        {reviews.ratingChange && Math.abs(reviews.ratingChange) >= 0.05 ? `, rating ${reviews.ratingChange > 0 ? "up" : "down"} ${Math.abs(reviews.ratingChange).toFixed(2)}` : ""}
      </DigestLine>,
    );
  }
  if (profile.available && profile.change) {
    lines.push(
      <DigestLine key="profile" icon={Building2} tone={profile.change > 0 ? "success" : "warning"} {...(focusId ? { to: locationPath(focusId, "gbp/audit") } : {})}>
        Profile score {profile.change > 0 ? "up" : "down"} <strong className="font-semibold">{plural(Math.abs(profile.change), "point")}</strong> since the last report
      </DigestLine>,
    );
  }
  if (citations?.available && citations.change) {
    lines.push(
      <DigestLine key="citations" icon={ListChecks} tone={citations.change > 0 ? "success" : "warning"} {...(focusId ? { to: locationPath(focusId, "citations") } : {})}>
        Citation score {citations.change > 0 ? "up" : "down"} <strong className="font-semibold">{plural(Math.abs(citations.change), "point")}</strong>
      </DigestLine>,
    );
  }
  if (keyCompetitor?.ahead) {
    lines.push(
      <DigestLine key="competitor" icon={Swords} tone="info" to={locationPath(keyCompetitor.locationId, "competitors")}>
        <strong className="font-semibold">{keyCompetitor.name}</strong> ranks ahead of {focusId ? "you" : keyCompetitor.locationName} ({keyCompetitor.rankText} vs {keyCompetitor.selfRankText})
      </DigestLine>,
    );
  }

  const movement = model.movement;
  const hasMoves = Boolean(moves && (moves.up.length > 0 || moves.down.length > 0));
  const empty = !movement && lines.length === 0 && !hasMoves;

  return (
    <Card description={`Since the last check, and in the last ${model.rangeDays} days`} className={className}>
      {empty ? (
        <EmptyState
          variant="unavailable"
          compact
          className="border-0"
          title="Nothing to compare yet"
          description="Changes show up here once a second ranking check and a Google sync have finished."
        />
      ) : (
        <>
          {movement ? <MovementBar {...movement} /> : null}
          {hasMoves && focusId && moves ? (
            <div>
              <GroupTitle>Biggest moves</GroupTitle>
              <ul>
                {[...moves.up.slice(0, 2), ...moves.down.slice(0, 2)].map((move) => (
                  <MoveRow key={`${move.keyword}-${move.change ?? move.note}`} move={move} locationId={focusId} />
                ))}
              </ul>
            </div>
          ) : null}
          {lines.length > 0 ? (
            <div>
              <GroupTitle>Also this period</GroupTitle>
              <ul>{lines}</ul>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------- agency -- */

const MAX_ROWS = 3;

function LocationLine({ to, name, sub, aside }: { to: string; name: string; sub: string | null; aside: ReactNode }) {
  return (
    <li>
      <Link to={to} className={ROW_LINK}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{name}</span>
          {sub ? <span className="block truncate text-xs text-muted-foreground">{sub}</span> : null}
        </span>
        <span className="shrink-0 text-right text-xs text-muted-foreground">{aside}</span>
      </Link>
    </li>
  );
}

function More({ total }: { total: number }) {
  return total > MAX_ROWS ? <p className="mt-1 text-xs text-muted-foreground">and {total - MAX_ROWS} more</p> : null;
}

/** What to say under an urgent-reviews row, by what the person can do about them. */
const URGENT_SUB: Record<WritingMode, string | null> = {
  ai: "Draft replies with AI",
  manual: "Reply to them",
  view: null,
};

/** The agency digest: which client locations slipped, have profile problems or urgent reviews. */
export function AgencyWhatChanged({ model, writing = "ai", className }: { model: AgencyDashboardModel; writing?: WritingMode; className?: string }) {
  const { reportsPath } = useWhiteLabelAccess();
  // Urgent: unanswered 1–3★ or flagged reviews (`awaiting_attention`).
  const urgent = model.reviews?.available ? model.reviews.byLocation.filter((row) => row.urgent > 0) : [];
  const reports = model.reports;
  const nothing = model.declines.length === 0 && model.profileIssues.length === 0 && urgent.length === 0;

  return (
    <Card description="Across your clients' locations" className={className}>
      {nothing ? (
        <EmptyState
          variant="all-done"
          compact
          className="border-0"
          title="Nothing slipped"
          description="No ranking drops, profile problems or urgent reviews across the portfolio."
        />
      ) : null}

      {model.declines.length > 0 ? (
        <div>
          <GroupTitle count={model.declines.length}>
            <TrendingDown aria-hidden className="size-3.5 text-warning" /> Rankings slipped
          </GroupTitle>
          <ul>
            {model.declines.slice(0, MAX_ROWS).map((row) => (
              <LocationLine
                key={row.locationId}
                to={locationPath(row.locationId, "rankings")}
                name={row.name}
                sub={row.clientName}
                aside={
                  <>
                    {row.change !== null && row.change < 0 ? (
                      <span className="block font-semibold tabular-nums text-warning-foreground">−{Math.abs(row.change).toFixed(1)} avg. rank</span>
                    ) : null}
                    <span className="block">{row.droppedOut > 0 ? `${row.droppedOut} left the top 60` : plural(row.declinedKeywords, "keyword") + " down"}</span>
                  </>
                }
              />
            ))}
          </ul>
          <More total={model.declines.length} />
        </div>
      ) : null}

      {model.profileIssues.length > 0 ? (
        <div>
          <GroupTitle count={model.profileIssues.length}>
            <Building2 aria-hidden className="size-3.5 text-chart-2" /> Profile issues
          </GroupTitle>
          <ul>
            {model.profileIssues.slice(0, MAX_ROWS).map((row) => (
              <LocationLine
                key={row.locationId}
                to={locationPath(row.locationId, "gbp")}
                name={row.name}
                sub={row.issues[0]?.label ?? null}
                aside={row.issues.length > 1 ? `+${row.issues.length - 1} more` : null}
              />
            ))}
          </ul>
          <More total={model.profileIssues.length} />
        </div>
      ) : null}

      {urgent.length > 0 ? (
        <div>
          <GroupTitle count={urgent.length}>
            <MessageSquareReply aria-hidden className="size-3.5 text-warning" /> Urgent reviews
          </GroupTitle>
          <ul>
            {urgent.slice(0, MAX_ROWS).map((row) => (
              <LocationLine
                key={row.locationId}
                to={urgentReplyLink(writing, row.locationId).to}
                name={row.name}
                sub={row.suspicious > 0 ? `${row.suspicious} with suspicious signs` : URGENT_SUB[writing]}
                aside={<span className="font-semibold text-warning-foreground">{row.urgent.toLocaleString()} urgent</span>}
              />
            ))}
          </ul>
          <More total={urgent.length} />
        </div>
      ) : null}

      {reports ? (
        <div className="mt-auto border-t border-border pt-4">
          <Link to={reportsPath} className={cn(ROW_LINK, "py-1.5")}>
            <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-md", STATUS_TONE_CLASSES.brand.chip)}>
              <FileBarChart className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground group-hover:text-primary">Reports</span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                <StatusBadge tone={reports.ready > 0 ? "success" : "neutral"} size="sm" icon={CheckCircle2}>
                  {reports.ready} ready
                </StatusBadge>
                <StatusBadge tone={reports.scheduled > 0 ? "info" : "neutral"} size="sm">
                  {plural(reports.scheduled, "monthly email")}
                </StatusBadge>
                {reports.failed > 0 ? (
                  <StatusBadge tone="critical" size="sm">
                    {reports.failed} failed
                  </StatusBadge>
                ) : null}
              </span>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" />
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
