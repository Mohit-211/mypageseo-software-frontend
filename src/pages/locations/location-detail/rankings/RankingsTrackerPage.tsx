import type { RankTrackerResponse, TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { RankTrendChart } from "@/components/ranking/rank-charts";
import { AvgRank, BucketLegend, OverallChange, RankCellView, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { RankReportButton } from "@/components/report/rank-report-button";
import { formatAvgRank, formatRate, targetLabel } from "@/lib/rankings/format";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GLOSSARY, pointExplanation } from "@/lib/rankings/glossary";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankRuns, useRankTracker } from "@/lib/rankings/use-rankings";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];

/** Rank Tracker: overall average per business, the trend, groups, and each keyword at the 5 tracker points. */
function RankingsTrackerPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const tracker = useRankTracker(location.location_id, runId, group);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="tracker"
        title="Rank Tracker"
        description="Average Google Maps rank for each keyword at the center and 4 points around it."
        run={tracker.data?.run}
        groupFilter
        actions={
          tracker.data ? (
            <RankReportButton locationId={location.location_id} runId={tracker.data.run.run_id} runAt={tracker.data.run.run_at} />
          ) : null
        }
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
        <TrackerContent
          data={tracker.data}
          locationId={location.location_id}
          selfName={location.name}
          onClearGroup={() => setGroup(undefined)}
        />
      )}
    </>
  );
}

function TrackerContent({
  data,
  locationId,
  selfName,
  onClearGroup,
}: {
  data: RankTrackerResponse;
  locationId: string;
  selfName: string;
  onClearGroup: () => void;
}) {
  const self = data.overall.self;
  const competitors = data.targets.filter((target) => target.key !== "self");
  const runs = useRankRuns(locationId, 12);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Overall average rank">
          <p className="text-3xl font-semibold tabular text-foreground">{formatAvgRank(self?.overallAvgRank)}</p>
          <div className="mt-1"><OverallChange overall={self} /></div>
          <p className="mt-2 text-xs text-muted-foreground">
            Across {self?.keywords_total ?? data.keywords.length} keyword{(self?.keywords_total ?? data.keywords.length) === 1 ? "" : "s"}. Lower is better; not found counts as 61.
          </p>
          {competitors.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              {competitors.map((target) => (
                <li key={target.key} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-muted-foreground">{targetLabel(target.key, selfName, target.name)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <AvgRank value={data.overall[target.key]?.overallAvgRank} />
                    <OverallChange overall={data.overall[target.key]} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel title="Trend" description="Overall average rank per run (lower is better).">
          <RankTrendChart runs={runs.data?.runs ?? null} selfName={selfName} />
        </Panel>
      </div>

      {data.groups && data.groups.length > 0 ? (
        <Panel title="Keyword groups" description={`${selfName} per group in this run.`}>
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Group</th>
                  <th className="px-3 py-2.5 text-right font-medium">Keywords</th>
                  <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Avg. rank">{GLOSSARY.avgRank}</TermWithTip></th>
                  <th className="px-3 py-2.5 font-medium"><TermWithTip term="Change">{GLOSSARY.change}</TermWithTip></th>
                  <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Top 3">{GLOSSARY.top3}</TermWithTip></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.groups.map((group) => {
                  const summary = group.summary.self;
                  return (
                    <tr key={group.group_id} className={data.group?.group_id === group.group_id ? "bg-brand-tint/50" : undefined}>
                      <td className="px-4 py-3 font-medium text-foreground">{group.name}</td>
                      <td className="px-3 py-3 text-right tabular text-muted-foreground">
                        {group.keywords_in_run}
                        {group.keywords_in_run !== group.keywords.length ? ` of ${group.keywords.length}` : ""}
                      </td>
                      <td className="px-3 py-3 text-right"><AvgRank value={summary?.avgRank} /></td>
                      <td className="px-3 py-3"><RankChange change={summary?.change} /></td>
                      <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(summary?.top3Rate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <Panel
        title={data.group ? `Keywords in “${data.group.name}”` : "Keywords"}
        description={`${selfName} from 5 search spots: the center (C) and ${data.run.config.tracker_offset_km} km north, south, east and west (N, S, E, W). Hover a column for details.`}
      >
        {data.keywords.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None of this group's keywords were measured in this run.{" "}
            <button type="button" className="font-medium text-primary hover:underline" onClick={onClearGroup}>Show all keywords</button>
          </p>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Keyword</th>
                  <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Avg. rank">{GLOSSARY.avgRank}</TermWithTip></th>
                  <th className="px-3 py-2.5 font-medium"><TermWithTip term="Change">{GLOSSARY.change}</TermWithTip></th>
                  <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Found">{GLOSSARY.found}</TermWithTip></th>
                  <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Top 3">{GLOSSARY.top3}</TermWithTip></th>
                  {POINTS.map((point) => (
                    <th key={point} className="px-2 py-2.5 text-center font-medium"><TermWithTip term={point}>{pointExplanation(point, data.run.config.tracker_offset_km)}</TermWithTip></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.keywords.map((keyword) => {
                  const summary = keyword.summary.self;
                  return (
                    <tr key={keyword.keyword}>
                      <td className="px-4 py-3 font-medium text-foreground">{keyword.keyword}</td>
                      <td className="px-3 py-3 text-right"><AvgRank value={summary?.avgRank} /></td>
                      <td className="px-3 py-3"><RankChange change={summary?.change} label={summary?.changeLabel} /></td>
                      <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(summary?.foundRate)}</td>
                      <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(summary?.top3Rate)}</td>
                      {POINTS.map((point) => (
                        <td key={point} className="px-2 py-3 text-center">
                          <RankCellView cell={keyword.cells.find((cell) => cell.point.label === point)?.byTarget.self} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <BucketLegend />
    </div>
  );
}

export default RankingsTrackerPage;
