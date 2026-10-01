import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { AvgRank, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { targetLabel } from "@/lib/rankings/format";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankTracker } from "@/lib/rankings/use-rankings";

/** Your business against each tracked competitor: overall and per keyword average rank. */
function RankingsCompetitorsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const tracker = useRankTracker(location.location_id, runId);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="competitors"
        title="Competitor rankings"
        description="Average rank of your business and each tracked competitor (lower is better)."
        run={tracker.data?.run}
      />
      {tracker.isPending ? (
        <PageSkeleton />
      ) : tracker.isError ? (
        <RankingsError error={tracker.error} locationId={location.location_id} onRetry={() => void tracker.refetch()} onLatest={() => setRunId(undefined)} />
      ) : tracker.data.targets.length <= 1 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">No competitors are tracked for this location. Add them in the location's setup.</p>
        </Panel>
      ) : (
        <Panel>
          <div className="-m-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Business</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overall</th>
                  {tracker.data.keywords.map((keyword) => (
                    <th key={keyword.keyword} className="px-3 py-2.5 text-right font-medium">{keyword.keyword}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tracker.data.targets.map((target) => (
                  <tr key={target.key} className={target.key === "self" ? "bg-brand-tint/50" : undefined}>
                    <td className="px-4 py-3 font-medium text-foreground">{targetLabel(target.key, location.name)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        <AvgRank value={tracker.data.overall[target.key]?.overallAvgRank} />
                        <RankChange change={tracker.data.overall[target.key]?.change} />
                      </span>
                    </td>
                    {tracker.data.keywords.map((keyword) => (
                      <td key={keyword.keyword} className="px-3 py-3 text-right"><AvgRank value={keyword.summary[target.key]?.avgRank} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

export default RankingsCompetitorsPage;
