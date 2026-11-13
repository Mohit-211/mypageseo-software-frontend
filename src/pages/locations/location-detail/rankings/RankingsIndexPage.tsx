import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpDown, Eye, Gauge, Trophy } from "lucide-react";
import type { RankBucket, RankStatus, RankStatusText, RankSummary, RankTrackerResponse } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { TableScroll } from "@/components/layout/shared/data-table";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { InfoTip } from "@/components/layout/shared/info-tip";
import { KpiTile } from "@/components/layout/shared/kpi-tile";
import { Sparkline } from "@/components/layout/shared/sparkline";
import { RankTrendChart } from "@/components/ranking/rank-charts";
import { AvgRankPill, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { keywordsPath } from "@/lib/keywords/paths";
import { locationPath } from "@/lib/mypageseo/section-links";
import { BUCKET_LABEL, avgRankText, comparableNote, formatAvgRank, formatRate, formatRunDate } from "@/lib/rankings/format";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { byChange, byRank, changeKey } from "@/lib/rankings/rank-sort";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankRuns, useRankTracker } from "@/lib/rankings/use-rankings";
import { byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

type KeywordRow = {
  keyword: string;
  summary: RankSummary | null;
  current: number | null;
  status: RankStatus | null;
  display: string | null;
  previous: number | null;
};

const BUCKET_ORDER: RankBucket[] = ["pack", "visible", "low", "invisible", "not_found", "error"];
/** Bar fills per bucket (graphics >= 3:1; "not found" uses the control grey, never a half-transparent one). */
const BUCKET_BAR: Record<RankBucket, string> = {
  pack: "bg-success",
  visible: "bg-info",
  low: "bg-warning",
  invisible: "bg-critical",
  not_found: "bg-input",
  error: "bg-border-strong",
};

/** Rows in "Top movers": half gains, half drops when there are enough of each. */
const MOVERS = 6;

const mean = (values: (number | null | undefined)[]) => {
  const known = values.filter((value): value is number => typeof value === "number");
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
};

/** Overview figures for the business (`self`), derived from the run's rank-tracker data. */
function summarize(data: RankTrackerResponse) {
  const rows: KeywordRow[] = data.keywords.map((keyword) => {
    const summary = keyword.summary.self ?? null;
    const current = summary?.avgRank ?? null;
    const change = summary?.change ?? null;
    return {
      keyword: keyword.keyword,
      summary,
      current,
      status: summary?.status ?? null,
      display: summary?.display ?? null,
      // `change` is previous − current, so previous = current + change.
      previous: current !== null && change !== null ? Math.round((current + change) * 10) / 10 : null,
    };
  });
  const improved = rows.filter((row) => row.summary?.changeLabel === "improved" || row.summary?.changeLabel === "entered_top_60").length;
  const declined = rows.filter((row) => row.summary?.changeLabel === "declined" || row.summary?.changeLabel === "dropped_out_of_top_60").length;

  const buckets = new Map<RankBucket, number>();
  for (const keyword of data.keywords) {
    for (const cell of keyword.cells) {
      const bucket = cell.byTarget.self?.bucket;
      if (bucket) buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }
  // Up to 3 of the biggest gains and up to 3 of the biggest drops (the other side fills the slots one
  // side can't), gains first; ties by keyword A–Z. Ranking by size alone let ties hide every drop.
  const gains = sortRows(
    rows.filter((row) => (changeKey(row.summary) ?? 0) > 0),
    byChange((row) => row.summary, "desc"),
    byText((row) => row.keyword),
  );
  const drops = sortRows(
    rows.filter((row) => (changeKey(row.summary) ?? 0) < 0),
    byChange((row) => row.summary, "asc"),
    byText((row) => row.keyword),
  );
  const gainsShown = Math.min(gains.length, MOVERS - Math.min(drops.length, MOVERS / 2));
  const movers = [...gains.slice(0, gainsShown), ...drops.slice(0, MOVERS - gainsShown)];

  return {
    rows: sortRows(rows, byRank((row) => row.summary), byText((row) => row.keyword)),
    improved,
    declined,
    top3: mean(rows.map((row) => row.summary?.top3Rate)),
    found: mean(rows.map((row) => row.summary?.foundRate)),
    buckets,
    movers,
  };
}

/** Rank Overview: the headline numbers, history, distribution, top movers and a keyword snapshot. */
function LocationRankingsOverviewPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const tracker = useRankTracker(location.location_id, runId, group);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        title="Rank Overview"
        description="Where you show up on Google Maps for your keywords, and how that is changing."
        run={tracker.data?.run}
        scope={tracker.data?.scope?.description}
        groupFilter
      />
      {tracker.isPending ? (
        <PageSkeleton header={false} />
      ) : tracker.isError ? (
        <RankingsError
          error={tracker.error}
          locationId={location.location_id}
          onRetry={() => void tracker.refetch()}
          onLatest={() => setRunId(undefined)}
          onClearGroup={() => setGroup(undefined)}
        />
      ) : (
        <OverviewContent data={tracker.data} locationId={location.location_id} selfName={location.name} />
      )}
    </>
  );
}

function OverviewContent({ data, locationId, selfName }: { data: RankTrackerResponse; locationId: string; selfName: string }) {
  const runs = useRankRuns(locationId, 12);
  const stats = summarize(data);
  const totalCells = [...stats.buckets.values()].reduce((sum, count) => sum + count, 0);
  const self = data.overall.self;
  const change = self && self.comparable_keywords !== 0 ? (self.change ?? null) : null;
  const note = comparableNote(self?.comparable_keywords, self?.keywords_total);
  const previousRun = data.trend.at(-2)?.run_at ?? null;
  const trendValues = data.trend.map((entry) => entry.overallAvgRank);
  const keywordCount = self?.keywords_total ?? data.keywords.length;

  return (
    <div className="space-y-6">
      <section aria-label="Ranking summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Average rank"
          icon={Gauge}
          tone="rankings"
          to={locationPath(locationId, "rankings/tracker")}
          value={avgRankText(self?.overallAvgRank, self?.status, self?.display)}
          {...(change !== null && change !== 0
            ? { trend: { direction: change > 0 ? ("up" as const) : ("down" as const), value: Math.abs(change).toFixed(1), positive: change > 0 } }
            : {})}
          hint={
            <span className="flex items-end justify-between gap-3">
              <span>
                Lower is better, across {keywordCount} keyword{keywordCount === 1 ? "" : "s"}
                {note && change !== null ? ` (change ${note})` : ""}.
              </span>
              <Sparkline values={trendValues} lowerIsBetter className="text-chart-1" />
            </span>
          }
        />
        <KpiTile
          label="Top 3 rate"
          icon={Trophy}
          tone="rankings"
          to={locationPath(locationId, "rankings/tracker")}
          value={formatRate(stats.top3)}
          hint="Searches where you're in Google Maps' top 3, the map pack."
        />
        <KpiTile
          label="Found rate"
          icon={Eye}
          tone="rankings"
          to={locationPath(locationId, "rankings/grid")}
          value={formatRate(stats.found)}
          hint="Searches where you appear anywhere in the top 60."
        />
        <KpiTile
          label="Keyword movement"
          icon={ArrowUpDown}
          tone="rankings"
          to={keywordsPath(locationId, { sort: "change" })}
          value={
            <span className="inline-flex items-baseline gap-2">
              <span className={cn(stats.improved > 0 && "text-success")}>{stats.improved}</span>
              <span className="text-sm font-medium text-muted-foreground">improved</span>
              <span className={cn(stats.declined > 0 && "text-warning-foreground")}>{stats.declined}</span>
              <span className="text-sm font-medium text-muted-foreground">declined</span>
            </span>
          }
          hint={previousRun ? `Since the run of ${formatRunDate(previousRun)}.` : "Movement shows after the second run."}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <Panel title="Average rank over time" description="You and your tracked competitors, per run. Lower is better.">
          <RankTrendChart runs={runs.data?.runs ?? null} selfName={selfName} />
        </Panel>
        <Panel
          title="Where your searches land"
          description="Every search in this run, by position."
          actions={<InfoTip label="About this chart">{GLOSSARY.distribution}</InfoTip>}
        >
          <div className="space-y-3.5">
            {BUCKET_ORDER.filter((bucket) => bucket !== "error" || stats.buckets.has("error")).map((bucket) => {
              const count = stats.buckets.get(bucket) ?? 0;
              const share = totalCells ? count / totalCells : 0;
              return (
                <div key={bucket}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <span aria-hidden className={cn("size-2.5 rounded-full", BUCKET_BAR[bucket])} />
                      {BUCKET_LABEL[bucket]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{count}</span> · {Math.round(share * 100)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", BUCKET_BAR[bucket])} style={{ width: `${share * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* items-start: the short "Top movers" card keeps its own height next to the long snapshot. */}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <KeywordTable
          title="Top movers"
          description={
            previousRun ? `The biggest gains and drops since ${formatRunDate(previousRun)}.` : "The biggest gains and drops since the previous run."
          }
          tip={GLOSSARY.movers}
          rows={stats.movers}
          locationId={locationId}
          statusText={data.status_text}
          empty="No keyword moved since the previous run, or this is the first run."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={keywordsPath(locationId, { sort: "change" })}>
                All keyword changes <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        <KeywordTable
          title="Keyword snapshot"
          description="Every keyword in this run, best rank first."
          rows={stats.rows}
          locationId={locationId}
          statusText={data.status_text}
          empty="No keywords in this run."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={locationPath(locationId, "rankings/tracker")}>
                Rank Tracker <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}

function KeywordTable({
  title,
  description,
  tip,
  rows,
  locationId,
  empty,
  action,
  statusText,
}: {
  title: string;
  description: string;
  tip?: string;
  rows: KeywordRow[];
  locationId: string;
  empty: string;
  action?: React.ReactNode;
  statusText?: RankStatusText | undefined;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold leading-6 text-foreground">
            {title}
            {tip ? <InfoTip label={`About ${title.toLowerCase()}`}>{tip}</InfoTip> : null}
          </h2>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        // Phones keep Keyword, Now and Change (the point of "Top movers"); Before and Top 3 join from `sm`.
        <TableScroll minWidth={320} label={title}>
          <thead className="bg-surface-strong">
            <tr className="border-b border-border-strong text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">Keyword</th>
              <th scope="col" className="hidden px-3 py-2.5 text-right sm:table-cell">Before</th>
              <th scope="col" className="px-3 py-2.5 text-right">Now</th>
              <th scope="col" className="px-3 py-2.5">Change</th>
              <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">Top 3</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.keyword} className="transition-colors hover:bg-accent/60">
                <td className="px-4 py-2.5">
                  <Link
                    to={keywordsPath(locationId, { keyword: row.keyword })}
                    className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {row.keyword}
                  </Link>
                </td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                  {/* Not in the top 60 counts as 61: show it the way the ranks do. */}
                  {row.previous !== null && row.previous >= 61 ? "60+" : formatAvgRank(row.previous)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <AvgRankPill value={row.current} status={row.status} display={row.display} statusText={statusText} className="min-w-11 text-xs" />
                </td>
                <td className="px-3 py-2.5">
                  {row.summary?.change == null && !row.summary?.changeLabel ? (
                    <span className="text-xs text-muted-foreground">New</span>
                  ) : (
                    <RankChange change={row.summary?.change} label={row.summary?.changeLabel} />
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-right tabular-nums text-foreground sm:table-cell">{formatRate(row.summary?.top3Rate)}</td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}
    </section>
  );
}

export default LocationRankingsOverviewPage;
