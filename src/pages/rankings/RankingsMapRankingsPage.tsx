import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { MapRankingContent } from "@/components/mypageseo/map-rankings";
import { getMapRankings } from "@/lib/mypageseo/map-rankings";



function MapRankingsPage() {
  const data = getMapRankings();
  return (
    <AppShell>
      <PageHeader title="Map Rankings" description="Map pack visibility for the selected location." />
      <MapRankingContent data={data} onRetry={() => {}} />
    </AppShell>
  );
}

export default MapRankingsPage;
