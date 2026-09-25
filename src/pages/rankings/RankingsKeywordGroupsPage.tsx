import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader } from "@/components/layout/shared/data-display";
import { KeywordGroupsTable } from "@/components/mypageseo/keyword-groups";
import { getKeywordGroups } from "@/lib/mypageseo/keyword-groups";



function KeywordGroupsPage() {
  const data = getKeywordGroups();
  return (
    <AppShell>
      <PageHeader title="Keyword Groups" description="Grouped keyword sets for reporting and analysis." />
      <KeywordGroupsTable data={data} query="" onClearSearch={() => {}} onRetry={() => {}} />
    </AppShell>
  );
}

export default KeywordGroupsPage;
