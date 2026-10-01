import { useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import type { RankTrackerResponse, TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { KeywordHistoryChart } from "@/components/ranking/rank-charts";
import { EditKeywordsButton } from "@/components/ranking/keyword-controls";
import { AvgRank, BucketLegend, RankCellView, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { formatRate, targetLabel } from "@/lib/rankings/format";
import { TermWithTip } from "@/components/layout/shared/info-tip";
import { GLOSSARY, pointExplanation } from "@/lib/rankings/glossary";
import { useGroupParam, useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useKeywordHistory, useRankTracker } from "@/lib/rankings/use-rankings";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];

/** Each keyword with every tracked business at the 5 tracker points, plus its history. */
function LocationKeywordsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const [group, setGroup] = useGroupParam();
  const tracker = useRankTracker(location.location_id, runId, group);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="keywords"
        title="Keywords"
        description="Every tracked keyword, for your business and each tracked competitor."
        run={tracker.data?.run}
        groupFilter
        actions={<EditKeywordsButton locationId={location.location_id} />}
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
        <div className="space-y-4">
          {tracker.data.keywords.length === 0 ? (
            <Panel><p className="text-sm text-muted-foreground">No keywords of this group were measured in this run.</p></Panel>
          ) : (
            tracker.data.keywords.map((keyword) => (
              <KeywordPanel key={keyword.keyword} data={tracker.data} keyword={keyword} locationId={location.location_id} selfName={location.name} />
            ))
          )}
          <BucketLegend />
        </div>
      )}
    </>
  );
}

function KeywordPanel({
  data,
  keyword,
  locationId,
  selfName,
}: {
  data: RankTrackerResponse;
  keyword: RankTrackerResponse["keywords"][number];
  locationId: string;
  selfName: string;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const history = useKeywordHistory(locationId, showHistory ? keyword.keyword : null);

  return (
    <Panel
      title={keyword.keyword}
      actions={
        <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((open) => !open)}>
          <LineChart aria-hidden /> History <ChevronDown aria-hidden className={showHistory ? "rotate-180 transition-transform" : "transition-transform"} />
        </Button>
      }
    >
      <div className="-m-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Business</th>
              <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Avg. rank">{GLOSSARY.avgRank}</TermWithTip></th>
              <th className="px-3 py-2.5 font-medium"><TermWithTip term="Change">{GLOSSARY.change}</TermWithTip></th>
              <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Found">{GLOSSARY.found}</TermWithTip></th>
              <th className="px-3 py-2.5 text-right font-medium"><TermWithTip term="Top 3">{GLOSSARY.top3}</TermWithTip></th>
              {POINTS.map((point) => <th key={point} className="px-2 py-2.5 text-center font-medium"><TermWithTip term={point}>{pointExplanation(point, data.run.config.tracker_offset_km)}</TermWithTip></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.targets.map((target) => {
              const summary = keyword.summary[target.key];
              return (
                <tr key={target.key} className={target.key === "self" ? "bg-brand-tint/50" : undefined}>
                  <td className="px-4 py-3 font-medium text-foreground">{targetLabel(target.key, selfName, target.name)}</td>
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
      {showHistory ? (
        <div className="mt-8 border-t border-border pt-4">
          {history.isError ? (
            <p className="text-sm text-muted-foreground">The history for this keyword couldn't be loaded.</p>
          ) : (
            <KeywordHistoryChart history={history.data} loading={history.isPending} selfName={selfName} />
          )}
        </div>
      ) : null}
    </Panel>
  );
}

export default LocationKeywordsPage;
