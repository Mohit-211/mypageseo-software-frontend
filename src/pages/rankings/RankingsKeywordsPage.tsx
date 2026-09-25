import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { KeywordRankingsTable } from "@/components/mypageseo/keyword-rankings";
import { getKeywordRankings } from "@/lib/mypageseo/keyword-rankings";



function KeywordsPage() {
  const data = getKeywordRankings();
  return (
    <AppShell>
      <PageHeader title="Keywords" description="Tracked keywords and current local positions." />
      <KeywordRankingsTable data={data} sort="keyword" order="asc" page={1} pageCount={1} onSort={() => {}} onPageChange={() => {}} onClearFilters={() => {}} onRetry={() => {}} />
    </AppShell>
  );
}

export default KeywordsPage;
