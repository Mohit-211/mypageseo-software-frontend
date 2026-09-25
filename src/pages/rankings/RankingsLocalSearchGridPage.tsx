import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader } from "@/components/mypageseo/data-display";
import { LocalSearchGridContent } from "@/components/mypageseo/local-search-grid";
import { getLocalSearchGrid } from "@/lib/mypageseo/local-search-grid";



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
