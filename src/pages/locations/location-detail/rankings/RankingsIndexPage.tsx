import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { RankBucket, RankTrackerResponse } from "@/api";
import { MetricCard, Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { RankTrendChart } from "@/components/ranking/rank-charts";
import { OverallChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { BUCKET_LABEL, CHANGE_LABEL_TEXT, formatAvgRank, formatRate } from "@/lib/rankings/format";
import { GLOSSARY } from "@/lib/rankings/glossary";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankRuns, useRankTracker } from "@/lib/rankings/use-rankings";

type KeywordRow = {
  keyword: string;
  current: number | null;
  previous: number | null;
  change: number | null;
  label: RankTrackerResponse["keywords"][number]["summary"][string]["changeLabel"];
  top3: number | null;
  found: number | null;
};

const BUCKET_ORDER: RankBucket[] = ["pack", "visible", "low", "invisible", "not_found", "error"];
const BUCKET_BAR: Record<RankBucket, string> = {
  pack: "bg-success",
  visible: "bg-info",
  low: "bg-warning",
  invisible: "bg-critical",
  not_found: "bg-muted-foreground/50",
  error: "bg-border",
};

/** Overview figures for the business (`self`), derived from the run's rank-tracker data. */
function summarize(data: RankTrackerResponse) {
  const rows: KeywordRow[] = data.keywords.map((keyword) => {
    const summary = keyword.summary.self;
    const current = summary?.avgRank ?? null;
    const change = summary?.change ?? null;
    return {
      keyword: keyword.keyword,
      current,
      // `change` is previous − current, so previous = current + change.
      previous: current !== null && change !== null ? Math.round((current + change) * 10) / 10 : null,
      change,
      label: summary?.changeLabel ?? null,
      top3: summary?.top3Rate ?? null,
      found: summary?.foundRate ?? null,
    };
  });
  const mean = (values: (number | null)[]) => {
    const known = values.filter((value): value is number => value !== null);
    return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
  };
  const improved = rows.filter((row) => row.label === "improved" || row.label === "entered_top_60").length;
  const declined = rows.filter((row) => row.label === "declined" || row.label === "dropped_out_of_top_60").length;
  const netChange = rows.reduce((sum, row) => sum + (row.change ?? 0), 0);
  const comparable = rows.some((row) => row.change !== null);

  const buckets = new Map<RankBucket, number>();
  for (const keyword of data.keywords) {
    for (const cell of keyword.cells) {
      const bucket = cell.byTarget.self?.bucket;
      if (bucket) buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }
  const movers = rows
    .filter((row) => row.change !== null && row.change !== 0)
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!))
    .slice(0, 5);

  return {
    rows,
    improved,
    declined,
    netChange: comparable ? Math.round(netChange * 10) / 10 : null,
    top3: mean(rows.map((row) => row.top3)),
    found: mean(rows.map((row) => row.found)),
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
        view="overview"
        title="Rank Overview"
        description="How the business ranks on Google Maps for its keywords, and how that is changing."
        run={tracker.data?.run}
        groupFilter
      />
      {tracker.isPending ? (
        <PageSkeleton />
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

  return (
    <div className="space-y-6">
      <section aria-label="Ranking summary">
        <div className="grid overflow-hidden rounded-lg border border-border bg-surface shadow-card sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border">
          <MetricCard
            label="Average rank"
            value={formatAvgRank(data.overall.self?.overallAvgRank)}
            trend={<OverallChange overall={data.overall.self} />}
            caption="Lower is better · 1 is the top result"
          />
          <MetricCard
            label="Keyword movement"
            value={`${stats.improved} up · ${stats.declined} down`}
            caption={`of ${stats.rows.length} keyword${stats.rows.length === 1 ? "" : "s"} since the previous run`}
          />
          <MetricCard
            label="Net position change"
            value={stats.netChange === null ? "—" : `${stats.netChange > 0 ? "+" : ""}${stats.netChange}`}
            caption="Positions gained (+) or lost (−), all keywords together"
          />
          <MetricCard
            label="Map pack coverage"
            value={formatRate(stats.top3)}
            caption={`Searches in the top 3 · found in ${formatRate(stats.found)}`}
          />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <TermWithTip term="Average rank">{GLOSSARY.avgRank}</TermWithTip>
          <TermWithTip term="Map pack">{GLOSSARY.top3}</TermWithTip>
          <TermWithTip term="Change">{GLOSSARY.change}</TermWithTip>
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel title="Average rank over time" description="Your business and tracked competitors, per run (lower is better).">
          <RankTrendChart runs={runs.data?.runs ?? null} selfName={selfName} />
        </Panel>
        <Panel
          title="Ranking distribution"
          description="Searches in this run by position range"
          actions={<TermWithTip term={<span className="sr-only">Distribution</span>}>{GLOSSARY.distribution}</TermWithTip>}
        >
          <div className="space-y-3.5">
            {BUCKET_ORDER.filter((bucket) => bucket !== "error" || stats.buckets.has("error")).map((bucket) => {
              const count = stats.buckets.get(bucket) ?? 0;
              return (
                <div key={bucket}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{BUCKET_LABEL[bucket]}</span>
                    <span className="font-semibold tabular">{count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${BUCKET_BAR[bucket]}`} style={{ width: `${totalCells ? (count / totalCells) * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <KeywordTable
          title="Top movers"
          tip={GLOSSARY.movers}
          rows={stats.movers}
          empty="No keyword moved since the previous run (or this is the first run)."
          action={<Button asChild variant="outline" size="sm"><Link to="keywords">All keywords <ArrowRight aria-hidden /></Link></Button>}
        />
        <KeywordTable
          title="Keyword snapshot"
          rows={stats.rows}
          empty="No keywords in this run."
          action={<Button asChild variant="outline" size="sm"><Link to="tracker">Rank Tracker <ArrowRight aria-hidden /></Link></Button>}
        />
      </div>
    </div>
  );
}

function Movement({ row }: { row: KeywordRow }) {
  if (row.label === "entered_top_60" || row.label === "dropped_out_of_top_60") {
    return <StatusBadge tone={row.label === "entered_top_60" ? "success" : "critical"}>{CHANGE_LABEL_TEXT[row.label]}</StatusBadge>;
  }
  if (row.change === null) return <span className="text-xs text-muted-foreground">New</span>;
  if (row.change === 0) return <StatusBadge>Unchanged</StatusBadge>;
  const improved = row.change > 0;
  return (
    <StatusBadge tone={improved ? "success" : "critical"}>
      {improved ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
      {Math.abs(row.change).toFixed(1)}
    </StatusBadge>
  );
}

function KeywordTable({
  title,
  tip,
  rows,
  empty,
  action,
}: {
  title: string;
  tip?: string;
  rows: KeywordRow[];
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      actions={
        <span className="flex items-center gap-2">
          {tip ? <TermWithTip term={<span className="sr-only">{title}</span>}>{tip}</TermWithTip> : null}
          {action}
        </span>
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border bg-surface-strong text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Previous</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Current</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Movement</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Top 3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.keyword}>
                  <td className="px-4 py-3 font-medium text-foreground">{row.keyword}</td>
                  <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatAvgRank(row.previous)}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular text-foreground">{formatAvgRank(row.current)}</td>
                  <td className="px-3 py-3"><Movement row={row} /></td>
                  <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(row.top3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default LocationRankingsOverviewPage;
