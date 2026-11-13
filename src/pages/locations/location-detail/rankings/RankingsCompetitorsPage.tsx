import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUp, Medal, Swords, UserPlus } from "lucide-react";
import type { RankTrackerResponse } from "@/api";
import { EmptyState, PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { TableScroll, thClass } from "@/components/layout/shared/data-table";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { AvgRankPill, BucketLegend, OverallChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { keywordsPath } from "@/lib/keywords/paths";
import { locationSetupPath } from "@/lib/locations/location-actions";
import { locationPath } from "@/lib/mypageseo/section-links";
import { formatRate, targetLabel } from "@/lib/rankings/format";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { byRank, leaderboard } from "@/lib/rankings/rank-sort";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankTracker } from "@/lib/rankings/use-rankings";
import { byText, rankKey, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** Your business against each tracked competitor: a leaderboard, then keyword by keyword. */
function RankingsCompetitorsPage() {
  const { location } = useRankingsContext();
  const { pathname, search } = useLocation();
  const [runId, setRunId] = useRunParam();
  const tracker = useRankTracker(location.location_id, runId);
  const canEdit = useCanEdit();
  // `from`: Save and Cancel come back to this page (with its run), not the default one.
  const manage = `${locationSetupPath(location.location_id)}?step=competitors&from=${encodeURIComponent(pathname + search)}`;

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        icon={Swords}
        tone="competitors"
        title="Competitors"
        description="How you rank against the nearby businesses you track, overall and keyword by keyword. Lower is better."
        run={tracker.data?.run}
        scope={tracker.data?.scope?.description}
        keywordsLink={false}
        actions={
          canEdit ? (
            <Button asChild variant="outline">
              <Link to={manage}>
                <UserPlus aria-hidden /> Manage competitors
              </Link>
            </Button>
          ) : undefined
        }
      />
      {tracker.isPending ? (
        <PageSkeleton header={false} metrics={0} rows={5} columns={6} />
      ) : tracker.isError ? (
        <RankingsError error={tracker.error} locationId={location.location_id} onRetry={() => void tracker.refetch()} onLatest={() => setRunId(undefined)} />
      ) : tracker.data.targets.length <= 1 ? (
        <EmptyState
          icon={Swords}
          tone="competitors"
          title="Compare with your competitors"
          description="Pick up to 5 nearby businesses to see who ranks above you, keyword by keyword. Their ranks show from the next ranking run."
          action={
            canEdit ? (
              <Button asChild>
                <Link to={manage}>
                  <UserPlus aria-hidden /> Add competitors
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <CompetitorsContent data={tracker.data} locationId={location.location_id} selfName={location.name} />
      )}
    </>
  );
}

function CompetitorsContent({ data, locationId, selfName }: { data: RankTrackerResponse; locationId: string; selfName: string }) {
  const name = (key: string, raw?: string | null) => targetLabel(key, selfName, raw);
  const board = leaderboard(
    data.targets,
    (target) => {
      const overall = data.overall[target.key];
      return overall ? { avgRank: overall.overallAvgRank, status: overall.status } : null;
    },
    (target) => name(target.key, target.name),
  );
  const youPlace = board.findIndex((target) => target.key === "self") + 1;
  // Head to head: you first, then the competitors in leaderboard order.
  const columns = [...board.filter((target) => target.key === "self"), ...board.filter((target) => target.key !== "self")];
  const keywords = sortRows(data.keywords, byRank((keyword) => keyword.summary.self), byText((keyword) => keyword.keyword));

  /** Keywords where `key` ranks better than you (a lower average). */
  const aheadOfYou = (key: string) =>
    data.keywords.filter((keyword) => {
      const theirs = rankKey(keyword.summary[key]?.avgRank, keyword.summary[key]?.status);
      const yours = rankKey(keyword.summary.self?.avgRank, keyword.summary.self?.status);
      return theirs !== null && (yours === null || theirs < yours);
    }).length;
  const top3 = (key: string) => {
    const values = data.keywords.map((keyword) => keyword.summary[key]?.top3Rate).filter((value): value is number => typeof value === "number");
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };

  return (
    <div className="space-y-6">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-foreground">
              <Medal aria-hidden className="size-4 text-chart-8" /> Leaderboard
            </h2>
            <p className="text-[13px] text-muted-foreground">
              You're <span className="font-semibold text-foreground">#{youPlace}</span> of {board.length} by overall average rank across {data.keywords.length} keyword
              {data.keywords.length === 1 ? "" : "s"}.
            </p>
          </div>
          {/* Why they rank ahead: their reviews, categories and posts side by side (public Google data). */}
          <Link
            to={locationPath(locationId, "gbp/comparison")}
            className="-mx-1.5 inline-flex min-h-9 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-primary underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Compare profiles <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
        {/* Phones: a stacked list (as on Rank Tracker), so the average rank is never cut at the card edge. */}
        <ol className="divide-y divide-border sm:hidden" aria-label="Leaderboard">
          {board.map((target, index) => {
            const overall = data.overall[target.key];
            const you = target.key === "self";
            const ahead = you ? null : aheadOfYou(target.key);
            return (
              <li key={target.key} className={cn("px-4 py-3", you && "bg-brand-tint/70 shadow-[inset_3px_0_0_var(--color-primary)]")}>
                <div className="flex items-center gap-3">
                  <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">#{index + 1}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn("line-clamp-2 min-w-0 break-words text-sm text-foreground", you ? "font-semibold" : "font-medium")}>{name(target.key, target.name)}</span>
                    {you ? (
                      <StatusBadge tone="brand" size="sm">
                        You
                      </StatusBadge>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <AvgRankPill value={overall?.overallAvgRank} status={overall?.status} display={overall?.display} statusText={data.status_text} />
                    <OverallChange overall={overall} neutral={!you} />
                  </span>
                </div>
                <p className="mt-1 pl-10 text-xs text-muted-foreground">
                  Top 3 {formatRate(top3(target.key))}
                  {ahead === null ? null : (
                    <>
                      {" · "}ahead of you on{" "}
                      <span className={cn("tabular-nums", ahead > 0 && "font-semibold text-foreground")}>
                        {ahead} of {data.keywords.length}
                      </span>
                    </>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
        <div className="hidden sm:block">
          <TableScroll minWidth={640} label="Leaderboard">
            <thead className="bg-surface-strong">
              <tr className="border-b border-border-strong">
                <th scope="col" className={cn(thClass, "w-14")}>#</th>
                <th scope="col" className={thClass}>Business</th>
                <th scope="col" className={cn(thClass, "text-right")}>
                  <span className="inline-flex items-center gap-1">
                    Avg. rank <InfoTip label="About the average rank">{GLOSSARY.avgRank}</InfoTip>
                  </span>
                </th>
                <th scope="col" className={thClass}>Change</th>
                <th scope="col" className={cn(thClass, "text-right")}>Top 3</th>
                <th scope="col" className={cn(thClass, "text-right")}>Ahead of you on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {board.map((target, index) => {
                const overall = data.overall[target.key];
                const you = target.key === "self";
                const ahead = you ? null : aheadOfYou(target.key);
                return (
                  <tr
                    key={target.key}
                    className={cn("transition-colors hover:bg-accent/60", you && "bg-brand-tint/70 shadow-[inset_3px_0_0_var(--color-primary)] hover:bg-brand-tint")}
                  >
                    <td className="px-4 py-3 text-sm font-semibold tabular-nums text-muted-foreground">#{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className={cn("text-sm", you ? "font-semibold text-foreground" : "font-medium text-foreground")}>{name(target.key, target.name)}</span>
                        {you ? (
                          <StatusBadge tone="brand" size="sm">
                            You
                          </StatusBadge>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AvgRankPill value={overall?.overallAvgRank} status={overall?.status} display={overall?.display} statusText={data.status_text} />
                    </td>
                    <td className="px-4 py-3">
                      <OverallChange overall={overall} neutral={!you} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">{formatRate(top3(target.key))}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {ahead === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn(ahead > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                          {ahead} of {data.keywords.length}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-4 py-3.5">
          <h2 className="text-[15px] font-semibold leading-6 text-foreground">Keyword by keyword</h2>
          <p className="text-[13px] text-muted-foreground">Each business's average rank per keyword, your best keywords first. Select a keyword for the 5 search spots and its history.</p>
        </div>
        <TableScroll minWidth={260 + columns.length * 130} label="Average rank per keyword">
          <thead className="bg-surface-strong">
            <tr className="border-b border-border-strong">
              <th scope="col" className={thClass}>Keyword</th>
              {columns.map((target) => (
                <th key={target.key} scope="col" className={cn(thClass, "text-right", target.key === "self" && "bg-brand-tint/60")}>
                  <span className={cn("ml-auto block max-w-36 truncate normal-case", target.key === "self" ? "font-semibold text-primary" : "")} title={name(target.key, target.name)}>
                    {target.key === "self" ? "You" : name(target.key, target.name)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keywords.map((keyword) => {
              const yours = rankKey(keyword.summary.self?.avgRank, keyword.summary.self?.status);
              return (
                <tr key={keyword.keyword} className="transition-colors hover:bg-accent/60">
                  <td className="px-4 py-3">
                    <Link to={keywordsPath(locationId, { keyword: keyword.keyword })} className="text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline">
                      {keyword.keyword}
                    </Link>
                  </td>
                  {columns.map((target) => {
                    const summary = keyword.summary[target.key];
                    const theirs = rankKey(summary?.avgRank, summary?.status);
                    const beatsYou = target.key !== "self" && theirs !== null && (yours === null || theirs < yours);
                    return (
                      <td key={target.key} className={cn("px-4 py-3 text-right", target.key === "self" && "bg-brand-tint/40")}>
                        <span className="inline-flex items-center gap-1.5">
                          {beatsYou ? (
                            <>
                              {/* Ink, not red: a competitor ahead is something to know, not an alarm (key under the table). */}
                              <span aria-hidden title="Ranks ahead of you" className="text-foreground">
                                <ArrowUp className="size-3.5" strokeWidth={2.5} />
                              </span>
                              <span className="sr-only">Ahead of you:</span>
                            </>
                          ) : null}
                          <AvgRankPill value={summary?.avgRank} status={summary?.status} display={summary?.display} statusText={data.status_text} className="min-w-11 text-xs" />
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border bg-surface-strong px-4 py-3">
          <BucketLegend />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowUp aria-hidden className="size-3.5 text-foreground" strokeWidth={2.5} /> ranks ahead of you for this keyword
          </p>
        </div>
      </section>
    </div>
  );
}

export default RankingsCompetitorsPage;
