import { useTypedSearch } from "@/hooks/use-typed-search";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { RankingsNavigation } from "@/components/location/location-workspace";
import { RankingDistribution, RankingHistory, RankingMetricSummary, RankingFilterBar, RankingOverviewLoading, RankingTable } from "@/components/ranking/ranking-overview";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState } from "@/components/layout/shared/feedback/states";
import { getRankingOverview } from "@/lib/raking/ranking-overview";
import { NoKeywordsEmpty, NoRankingDataEmpty } from "@/components/layout/shared/feedback/empty-states";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({
  period: z.string().optional(),
  comparison: z.string().optional(),
  resultType: z.string().optional(),
  top: z.coerce.number().optional(),
  group: z.string().optional(),
  movement: z.string().optional(),
});



function LocationRankingsPage() {
  const { locationId } = useRequiredParams("locationId");
  const navigate = useNavigate();
  const [, setSearch] = useTypedSearch(searchSchema); // "Retry" re-applies current search. TODO: react-query refetch once the API lands
  const data = getRankingOverview(locationId);
  return (
    <>
      <RankingsNavigation locationId={locationId} activeView="overview" />
      <PageHeader title="Rankings" description="Track local search position and movement for this location." meta={<p className="text-xs text-muted-foreground">Comparison controls become available after ranking collection begins.</p>} />
      <RankingFilterBar disabled={data.status !== "ready"} />
      {data.status === "loading" ? <RankingOverviewLoading /> : null}
      {data.status === "error" ? <ErrorState description="We couldn't load the ranking overview. Try again without leaving this location." onRetry={() => setSearch((previous) => ({ ...previous }))} /> : null}
      {data.status === "no_keywords" ? <NoKeywordsEmpty /> : null}
      {data.status === "no_data" ? <NoRankingDataEmpty /> : null}
      {data.status === "ready" ? <div className="space-y-6"><RankingMetricSummary data={data} /><div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><RankingHistory data={data} onRetry={() => setSearch((previous) => ({ ...previous }))} /><RankingDistribution data={data} /></div><div className="grid gap-6 xl:grid-cols-2"><RankingTable title="Top Movers" rows={data.topMovers} actionLabel="View all keywords" /><RankingTable title="Ranking Snapshot" rows={data.snapshot} actionLabel="Open Keywords" /></div></div> : null}
    </>
  );
}

export default LocationRankingsPage;
