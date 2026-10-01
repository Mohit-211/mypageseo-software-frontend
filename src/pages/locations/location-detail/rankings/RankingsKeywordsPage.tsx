import type { TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { AvgRank, BucketLegend, RankCellView, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { formatRate, targetLabel } from "@/lib/rankings/format";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankTracker } from "@/lib/rankings/use-rankings";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];

/** Each keyword with every tracked business at the 5 tracker points (rank-tracker data). */
function LocationKeywordsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const tracker = useRankTracker(location.location_id, runId);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="keywords"
        title="Keywords"
        description="Every tracked keyword, for your business and each tracked competitor."
        run={tracker.data?.run}
      />
      {tracker.isPending ? (
        <PageSkeleton />
      ) : tracker.isError ? (
        <RankingsError error={tracker.error} locationId={location.location_id} onRetry={() => void tracker.refetch()} onLatest={() => setRunId(undefined)} />
      ) : (
        <div className="space-y-4">
          {tracker.data.keywords.map((keyword) => (
            <Panel key={keyword.keyword} title={keyword.keyword}>
              <div className="-m-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Business</th>
                      <th className="px-3 py-2.5 text-right font-medium">Avg. rank</th>
                      <th className="px-3 py-2.5 font-medium">Change</th>
                      <th className="px-3 py-2.5 text-right font-medium">Found</th>
                      <th className="px-3 py-2.5 text-right font-medium">Top 3</th>
                      {POINTS.map((point) => <th key={point} className="px-2 py-2.5 text-center font-medium">{point}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tracker.data.targets.map((target) => {
                      const summary = keyword.summary[target.key];
                      return (
                        <tr key={target.key} className={target.key === "self" ? "bg-brand-tint/50" : undefined}>
                          <td className="px-4 py-3 font-medium text-foreground">{targetLabel(target.key, location.name)}</td>
                          <td className="px-3 py-3 text-right"><AvgRank value={summary?.avgRank} /></td>
                          <td className="px-3 py-3"><RankChange change={summary?.change} label={summary?.changeLabel} /></td>
                          <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(summary?.foundRate)}</td>
                          <td className="px-3 py-3 text-right tabular text-muted-foreground">{formatRate(summary?.top3Rate)}</td>
                          {POINTS.map((point) => (
                            <td key={point} className="px-2 py-3 text-center">
                              <RankCellView cell={keyword.cells.find((cell) => cell.point.label === point)?.byTarget[target.key]} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
          <BucketLegend />
        </div>
      )}
    </>
  );
}

export default LocationKeywordsPage;
