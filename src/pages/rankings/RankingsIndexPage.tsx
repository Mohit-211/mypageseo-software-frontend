import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { RankingDistribution, RankingHistory, RankingMetricSummary, RankingTable } from "@/components/raking/ranking-overview";
import { getRankingOverview } from "@/lib/raking-lib/ranking-overview";



function RankOverviewPage() {
  const data = getRankingOverview();
  return (
    <AppShell>
      <PageHeader title="Rank Overview" description="Local ranking performance across tracked keywords." />
      <div className="space-y-6">
        <RankingMetricSummary data={data} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <RankingHistory data={data} onRetry={() => {}} />
          <RankingDistribution data={data} />
        </div>
        <RankingTable title="Top movers" rows={data.topMovers} />
        <RankingTable title="Keyword snapshot" rows={data.snapshot} />
      </div>
    </AppShell>
  );
}

export default RankOverviewPage;
