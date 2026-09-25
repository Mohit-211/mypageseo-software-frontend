import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { KeywordGroupSearch, KeywordGroupsTable } from "@/components/mypageseo/keyword-groups";
import { RankingsNavigation } from "@/components/mypageseo/location-workspace";
import { PageHeader } from "@/components/mypageseo/data-display";
import { getKeywordGroups } from "@/lib/mypageseo/keyword-groups";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({ q: z.string().optional() });



function LocationKeywordGroupsPage() {
  const { locationId } = useRequiredParams("locationId");
  const [{ q }, setSearch] = useTypedSearch(searchSchema);
  const navigate = useNavigate();
  const data = getKeywordGroups(locationId);
  const query = (q ?? "").slice(0, 100);
  const clearSearch = () => setSearch({});

  return (
    <>
      <RankingsNavigation locationId={locationId} activeView="groups" />
      <PageHeader title="Keyword Groups" description="Organize tracked keywords and analyze ranking performance by topic or search theme." />
      <KeywordGroupSearch value={query} disabled={data.status !== "ready"} onChange={(value) => setSearch({ q: value || undefined })} onReset={clearSearch} />
      <KeywordGroupsTable data={data} query={query} onClearSearch={clearSearch} onRetry={() => setSearch((previous) => ({ ...previous }))} />
    </>
  );
}

export default LocationKeywordGroupsPage;
