import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileText, LoaderCircle } from "lucide-react";
import { createReport, isApiError, type RankTrackerResponse, type TrackerPointLabel } from "@/api";
import { Panel } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { AvgRank, BucketLegend, RankCellView, RankChange, RankingsError, RankingsPageHeader } from "@/components/ranking/rank-ui";
import { Button } from "@/components/ui/button";
import { formatAvgRank, formatRate, formatRunDate, targetLabel } from "@/lib/rankings/format";
import { useRankingsContext, useRunParam } from "@/lib/rankings/rankings-context";
import { useRankTracker } from "@/lib/rankings/use-rankings";

const POINTS: TrackerPointLabel[] = ["C", "N", "S", "E", "W"];
const REPORT_ERRORS: Record<string, string> = {
  no_rank_run: "A report needs a finished ranking run.",
  read_only: "Your access is read-only, so you can't create reports.",
};

/** Rank Tracker: overall average per target, the trend, and each keyword at the 5 tracker points. */
function LocationRankingsPage() {
  const { location } = useRankingsContext();
  const [runId, setRunId] = useRunParam();
  const tracker = useRankTracker(location.location_id, runId);

  return (
    <>
      <RankingsPageHeader
        locationId={location.location_id}
        view="overview"
        title="Rank Tracker"
        description="Average Google Maps rank for each keyword at the center and 4 points around it."
        run={tracker.data?.run}
        actions={tracker.data ? <ReportButton locationId={location.location_id} /> : null}
      />
      {tracker.isPending ? (
        <PageSkeleton />
      ) : tracker.isError ? (
        <RankingsError
          error={tracker.error}
          locationId={location.location_id}
          onRetry={() => void tracker.refetch()}
          onLatest={() => setRunId(undefined)}
        />
      ) : (
        <TrackerContent data={tracker.data} selfName={location.name} />
      )}
    </>
  );
}

function ReportButton({ locationId }: { locationId: string }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const create = async () => {
    setCreating(true);
    try {
      const report = await createReport({ location_id: locationId, type: "rank_tracker" });
      navigate(`/locations/${locationId}/reports/${report.report_id}`);
    } catch (err) {
      const reason = isApiError(err) ? err.reason : undefined;
      toast.error((reason && REPORT_ERRORS[reason]) ?? "The report couldn't be created. Try again.");
    } finally {
      setCreating(false);
    }
  };
  return (
    <Button size="sm" disabled={creating} onClick={() => void create()}>
      {creating ? <LoaderCircle aria-hidden className="animate-spin" /> : <FileText aria-hidden />} Create report
    </Button>
  );
}

function TrackerContent({ data, selfName }: { data: RankTrackerResponse; selfName: string }) {
  const self = data.overall.self;
  const competitors = data.targets.filter((target) => target.key !== "self");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Overall average rank">
          <p className="text-3xl font-semibold tabular text-foreground">{formatAvgRank(self?.overallAvgRank)}</p>
          <div className="mt-1"><RankChange change={self?.change} /></div>
          <p className="mt-2 text-xs text-muted-foreground">
            Across {data.keywords.length} keyword{data.keywords.length === 1 ? "" : "s"}. Lower is better; not found counts as 61.
          </p>
          {competitors.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              {competitors.map((target) => (
                <li key={target.key} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{targetLabel(target.key)}</span>
                  <span className="flex items-center gap-2">
                    <AvgRank value={data.overall[target.key]?.overallAvgRank} />
                    <RankChange change={data.overall[target.key]?.change} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <TrendPanel trend={data.trend} />
      </div>

      <Panel title="Keywords" description={`${selfName} at each tracker point (C = center; N, S, E, W = ${data.run.config.tracker_offset_km} km out).`}>
        <div className="-m-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-surface-strong text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Keyword</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg. rank</th>
                <th className="px-3 py-2.5 font-medium">Change</th>
                <th className="px-3 py-2.5 text-right font-medium">Found</th>
                <th className="px-3 py-2.5 text-right font-medium">Top 3</th>
                {POINTS.map((point) => (
                  <th key={point} className="px-2 py-2.5 text-center font-medium">{point}</th>
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
      </Panel>
      <BucketLegend />
    </div>
  );
}

function TrendPanel({ trend }: { trend: RankTrackerResponse["trend"] }) {
  const points = trend.map((entry) => ({ label: formatRunDate(entry.run_at), value: entry.overallAvgRank }));
  return (
    <Panel title="Trend" description="Overall average rank over the last 12 runs (lower is better).">
      {points.length < 2 ? (
        <p className="text-sm text-muted-foreground">The trend appears after the second run.</p>
      ) : (
        <div className="h-48" role="img" aria-label={`Average rank trend: ${points.map((p) => `${p.label} ${p.value ?? "no data"}`).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              {/* Rank 1 is best, so the axis is reversed. */}
              <YAxis reversed allowDecimals={false} domain={[1, "auto"]} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip formatter={(value) => [formatAvgRank(value as number), "Avg. rank"]} />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

export default LocationRankingsPage;
