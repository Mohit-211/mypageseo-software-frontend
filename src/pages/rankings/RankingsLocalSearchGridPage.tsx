import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { LocalSearchGridContent } from "@/components/ranking/local-search-grid";
import { getLocalSearchGrid } from "@/lib/raking/local-search-grid";



function LocalSearchGridPage() {
  const data = getLocalSearchGrid();
  return (
    <AppShell>
      <PageHeader title="Local Search Grid" description="Geo-grid ranking coverage around the location." />
      <LocalSearchGridContent data={data} onRetry={() => {}} />
    </AppShell>
  );
}

export default LocalSearchGridPage;
