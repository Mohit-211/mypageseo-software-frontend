import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { PageHeader } from "@/components/mypageseo/data-display";
import { LocalGridFilterBar, LocalSearchGridContent, type LocalGridFilters } from "@/components/mypageseo/local-search-grid";
import { RankingsNavigation } from "@/components/mypageseo/location-workspace";
import { getLocalSearchGrid } from "@/lib/mypageseo/local-search-grid";
import { useTypedSearch } from "@/hooks/use-typed-search";
import { useRequiredParams } from "@/hooks/use-required-params";

const searchSchema = z.object({ keyword: z.string().optional(), gridSize: z.string().optional(), radius: z.string().optional(), searchType: z.string().optional(), scanDate: z.string().optional(), compare: z.string().optional() });



function LocalSearchGridPage() {
  const { locationId } = useRequiredParams("locationId");
  const [search, setSearch] = useTypedSearch(searchSchema);
  const navigate = useNavigate();
  const data = getLocalSearchGrid(locationId);
  const values: LocalGridFilters = { keyword: search.keyword ?? data.selectedKeyword?.id ?? "", gridSize: search.gridSize ?? data.gridSize ?? "", radius: search.radius ?? data.radius ?? "", searchType: search.searchType ?? data.searchType ?? "", scanDate: search.scanDate ?? data.scanDate ?? "", compare: search.compare ?? data.comparisonDate ?? "" };
  const updateFilter = (field: keyof LocalGridFilters, value: string) => setSearch((previous) => ({ ...previous, [field]: value || undefined }));
  return <><RankingsNavigation locationId={locationId} activeView="grid" /><PageHeader title="Local Search Grid" description="See local ranking performance across multiple geographic search points around this location." /><LocalGridFilterBar data={data} values={values} onChange={updateFilter} /><LocalSearchGridContent data={data} onRetry={() => setSearch((previous) => ({ ...previous }))} /></>;
}

export default LocalSearchGridPage;
